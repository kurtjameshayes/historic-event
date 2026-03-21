from __future__ import annotations

import json
import logging
from queue import Empty

from bson.errors import InvalidId
from flask import Blueprint, Response, jsonify, request, stream_with_context
from pymongo.errors import PyMongoError

from .. import get_db
from ..config import Config
from ..models import (
    create_session,
    get_session,
    list_sessions,
    get_events,
    get_edges,
    update_session,
    clear_session_data,
    increment_session_critic_run_seq,
)
from ..orchestrator import start_orchestrator, register_sse_queue, unregister_sse_queue

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)

MAX_QUERY_LENGTH = 500
MAX_CYCLES_LIMIT = 10
MAX_THREADS_LIMIT = 10
MAX_SOURCES_LIMIT = 10


@api_bp.errorhandler(InvalidId)
def handle_invalid_id(e):
    return jsonify({"error": "Invalid ID format"}), 400


@api_bp.errorhandler(PyMongoError)
def handle_mongo_error(e):
    logger.error("MongoDB error: %s", e)
    return jsonify({"error": "Database unavailable. Check MONGODB_URI in backend/.env"}), 503


@api_bp.errorhandler(RuntimeError)
def handle_runtime_error(e):
    if "MongoDB" in str(e):
        return jsonify({"error": str(e)}), 503
    raise e


@api_bp.route("/sessions", methods=["POST"])
def create_new_session():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    body = request.get_json()
    if body is None:
        return jsonify({"error": "Invalid JSON body"}), 400
    query = body.get("query", "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    if len(query) > MAX_QUERY_LENGTH:
        return jsonify({"error": f"query must be at most {MAX_QUERY_LENGTH} characters"}), 400

    config = {
        "max_depth": min(int(body.get("max_depth", 1)), MAX_CYCLES_LIMIT),
        "max_cycles": min(int(body.get("max_cycles", 2)), MAX_CYCLES_LIMIT),
        "max_sources_per_thread": min(int(body.get("max_sources_per_thread", 3)), MAX_SOURCES_LIMIT),
        "max_threads": min(int(body.get("max_threads", 5)), MAX_THREADS_LIMIT),
        "coverage_threshold": Config.DEFAULT_COVERAGE_THRESHOLD,
        "focus_threads": body.get("focus_threads", []),
    }

    db = get_db()
    try:
        session_id, query_id = create_session(db, query, config)
    except PyMongoError as e:
        return jsonify({"error": "Database unavailable. Please configure MONGODB_URI in backend/.env with a valid MongoDB connection string."}), 503

    start_orchestrator(session_id, query, config, db)

    return jsonify({"session_id": session_id, "query_id": query_id}), 201


@api_bp.route("/sessions", methods=["GET"])
def list_all_sessions():
    db = get_db()
    search = request.args.get("search", "").strip() or None
    skip = request.args.get("skip", 0, type=int)
    limit = request.args.get("limit", 50, type=int)
    sessions = list_sessions(db, limit=limit, skip=skip, search=search)
    return jsonify(sessions)


@api_bp.route("/sessions/<session_id>", methods=["GET"])
def get_session_detail(session_id: str):
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404
    return jsonify(session)


@api_bp.route("/sessions/<session_id>/stream", methods=["GET"])
def stream_session(session_id: str):
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    q = register_sse_queue(session_id)

    def generate():
        try:
            status = session.get("status", "")
            if status in ("COMPLETE", "ERROR"):
                evt = "complete" if status == "COMPLETE" else "error"
                data = json.dumps({
                    "session_id": session_id,
                    "event_count": 0,
                    "edge_count": 0,
                    "final_score": 0.0,
                }, default=str) if evt == "complete" else json.dumps({
                    "message": "Session ended with an error",
                    "recoverable": False,
                }, default=str)
                yield f"event: {evt}\ndata: {data}\n\n"
                return

            while True:
                try:
                    payload = q.get(timeout=30)
                    event_type = payload.get("event", "message")
                    data = json.dumps(payload.get("data", {}), default=str)
                    yield f"event: {event_type}\ndata: {data}\n\n"

                    if event_type in ("complete", "error"):
                        if event_type == "error" and not payload.get("data", {}).get("recoverable", False):
                            break
                        if event_type == "complete":
                            break
                except Empty:
                    fresh = get_session(db, session_id)
                    if fresh and fresh.get("status") in ("COMPLETE", "ERROR"):
                        evt = "complete" if fresh["status"] == "COMPLETE" else "error"
                        d = json.dumps({
                            "session_id": session_id,
                            "event_count": 0,
                            "edge_count": 0,
                            "final_score": 0.0,
                        }, default=str) if evt == "complete" else json.dumps({
                            "message": "Session ended with an error",
                            "recoverable": False,
                        }, default=str)
                        yield f"event: {evt}\ndata: {d}\n\n"
                        break
                    yield ": heartbeat\n\n"
        finally:
            unregister_sse_queue(session_id, q)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@api_bp.route("/sessions/<session_id>/timeline", methods=["GET"])
def get_timeline(session_id: str):
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    events = get_events(db, session_id)
    edges = get_edges(db, session_id)
    threads = session.get("causal_threads", [])

    for ev in events:
        if "session_id" in ev:
            del ev["session_id"]

    for edge in edges:
        if "session_id" in edge:
            del edge["session_id"]

    return jsonify({
        "target_event": session.get("target_event", {}),
        "threads": threads,
        "events": events,
        "edges": edges,
        "subtopics": session.get("subtopics", []),
        "narrative": session.get("narrative", ""),
    })


@api_bp.route("/sessions/<session_id>/narrative", methods=["GET"])
def get_narrative(session_id: str):
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    return jsonify({"narrative": session.get("narrative", "")})


@api_bp.route("/sessions/<session_id>/restart", methods=["POST"])
def restart_investigation(session_id: str):
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    status = session.get("status", "")
    if status not in ("COMPLETE", "ERROR"):
        return jsonify({"error": f"Cannot restart session with status '{status}'. Only COMPLETE or ERROR sessions can be restarted."}), 409

    clear_session_data(db, session_id)
    next_run_seq = increment_session_critic_run_seq(db, session_id)
    update_session(db, session_id, {
        "status": "PLAN",
        "current_cycle": 0,
        "critic_run_seq": next_run_seq,
        "causal_threads": [],
        "narrative": None,
        "subtopics": [],
        "reasoning_trace": [],
        "last_critique_id": None,
        "completed_at": None,
    })

    config = session.get("config", {})
    start_orchestrator(session_id, session["query"], config, db)

    return jsonify({"status": "restarted", "session_id": session_id})


@api_bp.route("/sessions/<session_id>/deepen", methods=["POST"])
def deepen_investigation(session_id: str):
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    status = session.get("status", "")
    if status not in ("COMPLETE", "ERROR"):
        return jsonify({"error": f"Cannot deepen session with status '{status}'. Only COMPLETE or ERROR sessions can be deepened."}), 409

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    body = request.get_json()
    if body is None:
        return jsonify({"error": "Invalid JSON body"}), 400
    thread_id = body.get("thread_id")
    if not thread_id:
        return jsonify({"error": "thread_id is required"}), 400

    config = session.get("config", {})
    config["max_cycles"] = 2
    config["focus_threads"] = [thread_id]

    update_session(db, session_id, {"status": "RESEARCH"})
    start_orchestrator(session_id, session["query"], config, db)

    return jsonify({"status": "deepening", "session_id": session_id})
