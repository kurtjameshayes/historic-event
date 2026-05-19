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
    get_event,
    update_event_detail,
    update_session,
    clear_session_data,
    increment_session_critic_run_seq,
    create_comparison,
    get_comparison,
    list_comparisons,
    add_comparison_suggestion,
    add_comparison_prompt_change,
)
from ..orchestrator import start_orchestrator, register_sse_queue, unregister_sse_queue
from ..comparison_orchestrator import (
    start_comparison_watcher,
    register_comparison_queue,
    unregister_comparison_queue,
)

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)

MAX_QUERY_LENGTH = 500
MAX_ATTACHMENT_CONTEXT_LENGTH = 20_000
MAX_CYCLES_LIMIT = 10
MAX_THREADS_LIMIT = 10
MAX_SOURCES_LIMIT = 10

ALLOWED_MIME_TYPES = {
    "application/pdf": ("pdf", "parse_pdf"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ("docx", "parse_docx"),
    "image/jpeg": ("image", "parse_image"),
    "image/png": ("image", "parse_image"),
    "image/gif": ("image", "parse_image"),
    "image/webp": ("image", "parse_image"),
}
EXTENSION_TO_MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


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


@api_bp.route("/parse-attachment", methods=["POST"])
def parse_attachment():
    """Parse a file or URL and return extracted text.

    Accepts either:
      - multipart/form-data with a `file` field (PDF, DOCX, or image)
      - application/json with a `url` field
    Returns: { text, name, type }
    """
    from ..services.attachment_parser import parse_pdf, parse_docx, parse_image, crawl_url
    import os

    if request.content_type and request.content_type.startswith("multipart/form-data"):
        if "file" not in request.files:
            return jsonify({"error": "No file field in request"}), 400
        f = request.files["file"]
        filename = f.filename or "attachment"
        ext = os.path.splitext(filename)[1].lower()

        mime = f.content_type or ""
        if not mime or mime == "application/octet-stream":
            mime = EXTENSION_TO_MIME.get(ext, "")

        if mime not in ALLOWED_MIME_TYPES:
            return jsonify({"error": f"Unsupported file type: {mime or ext!r}. Allowed: PDF, DOCX, JPEG, PNG, GIF, WebP"}), 415

        file_bytes = f.read()
        if len(file_bytes) > 20 * 1024 * 1024:
            return jsonify({"error": "File too large. Maximum size is 20 MB"}), 413

        attachment_type, _ = ALLOWED_MIME_TYPES[mime]
        try:
            if attachment_type == "pdf":
                text = parse_pdf(file_bytes)
            elif attachment_type == "docx":
                text = parse_docx(file_bytes)
            else:
                text = parse_image(file_bytes, mime)
        except Exception as e:
            logger.exception("Error parsing attachment %s", filename)
            return jsonify({"error": f"Failed to parse file: {e}"}), 500

        return jsonify({"text": text, "name": filename, "type": attachment_type})

    if request.is_json:
        body = request.get_json()
        url = (body or {}).get("url", "").strip()
        if not url:
            return jsonify({"error": "url is required"}), 400
        try:
            text = crawl_url(url)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.exception("Error crawling URL %s", url)
            return jsonify({"error": f"Failed to crawl URL: {e}"}), 500
        return jsonify({"text": text, "name": url, "type": "url"})

    return jsonify({"error": "Request must be multipart/form-data (file) or application/json (url)"}), 415


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

    attachment_context = (body.get("attachment_context") or "").strip()
    if len(attachment_context) > MAX_ATTACHMENT_CONTEXT_LENGTH:
        return jsonify({"error": f"attachment_context must be at most {MAX_ATTACHMENT_CONTEXT_LENGTH} characters"}), 400

    enriched_query = query
    if attachment_context:
        enriched_query = f"{query}\n\n--- Attached Context ---\n{attachment_context}"

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
        session_id, query_id = create_session(db, enriched_query, config)
    except PyMongoError as e:
        return jsonify({"error": "Database unavailable. Please configure MONGODB_URI in backend/.env with a valid MongoDB connection string."}), 503

    start_orchestrator(session_id, enriched_query, config, db)

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


@api_bp.route("/sessions/<session_id>/events/<event_id>/detail", methods=["GET"])
def get_event_detail(session_id: str, event_id: str):
    """Return an in-depth multi-paragraph deep-dive for a single event.

    Generated lazily via the elaborator agent and cached on the event document
    so subsequent requests return instantly.
    """
    db = get_db()
    session = get_session(db, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    event = get_event(db, event_id)
    if not event or str(event.get("session_id")) != session_id:
        return jsonify({"error": "event not found"}), 404

    cached = (event.get("detail") or "").strip()
    if cached and not request.args.get("regenerate"):
        return jsonify({"detail": cached, "cached": True})

    from ..agents.elaborator import elaborate_event

    threads = session.get("causal_threads", []) or []
    subtopics = session.get("subtopics", []) or []
    thread = next((t for t in threads if t.get("id") == event.get("thread_id")), None)

    subtopic = None
    sibling_events: list[dict] = []
    event_subtopic_id = event.get("subtopic_id")
    if event_subtopic_id:
        subtopic = next((s for s in subtopics if s.get("id") == event_subtopic_id), None)

    if subtopic is None:
        for s in subtopics:
            if event_id in (s.get("event_ids") or []):
                subtopic = s
                break

    if subtopic:
        sibling_ids = set(subtopic.get("event_ids") or [])
        if sibling_ids:
            all_events = get_events(db, session_id)
            sibling_events = [
                e for e in all_events
                if e.get("id") in sibling_ids and e.get("id") != event_id
            ]
            sibling_events.sort(key=lambda e: e.get("timestamp", 0))

    query = session.get("query", "")

    try:
        detail = elaborate_event(
            query=query,
            event=event,
            thread=thread,
            subtopic=subtopic,
            sibling_events=sibling_events,
        )
    except Exception as e:
        logger.exception("Failed to elaborate event %s", event_id)
        return jsonify({"error": "Failed to generate event detail. Please try again."}), 502

    if not detail:
        return jsonify({"error": "Elaborator returned empty content"}), 502

    try:
        update_event_detail(db, event_id, detail)
    except PyMongoError:
        logger.warning("Failed to persist event detail for %s; returning generated content anyway", event_id)

    return jsonify({"detail": detail, "cached": False})


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


# --------------- Comparisons ---------------

@api_bp.route("/comparisons", methods=["POST"])
def create_new_comparison():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    body = request.get_json()
    if body is None:
        return jsonify({"error": "Invalid JSON body"}), 400

    query_a = (body.get("query_a") or "").strip()
    query_b = (body.get("query_b") or "").strip()
    if not query_a or not query_b:
        return jsonify({"error": "query_a and query_b are required"}), 400
    if len(query_a) > MAX_QUERY_LENGTH or len(query_b) > MAX_QUERY_LENGTH:
        return jsonify({"error": f"Each query must be at most {MAX_QUERY_LENGTH} characters"}), 400

    context_a = (body.get("attachment_context_a") or "").strip()
    context_b = (body.get("attachment_context_b") or "").strip()
    if len(context_a) > MAX_ATTACHMENT_CONTEXT_LENGTH or len(context_b) > MAX_ATTACHMENT_CONTEXT_LENGTH:
        return jsonify({"error": f"attachment_context must be at most {MAX_ATTACHMENT_CONTEXT_LENGTH} characters"}), 400

    enriched_a = f"{query_a}\n\n--- Attached Context ---\n{context_a}" if context_a else query_a
    enriched_b = f"{query_b}\n\n--- Attached Context ---\n{context_b}" if context_b else query_b

    config = {
        "max_depth": min(int(body.get("max_depth", 1)), MAX_CYCLES_LIMIT),
        "max_cycles": min(int(body.get("max_cycles", 2)), MAX_CYCLES_LIMIT),
        "max_sources_per_thread": min(int(body.get("max_sources_per_thread", 3)), MAX_SOURCES_LIMIT),
        "max_threads": min(int(body.get("max_threads", 5)), MAX_THREADS_LIMIT),
        "coverage_threshold": Config.DEFAULT_COVERAGE_THRESHOLD,
        "focus_threads": [],
    }

    db = get_db()
    try:
        session_id_a, _ = create_session(db, enriched_a, config)
        session_id_b, _ = create_session(db, enriched_b, config)
        comparison_id = create_comparison(db, enriched_a, enriched_b, session_id_a, session_id_b)
    except PyMongoError:
        return jsonify({"error": "Database unavailable. Please configure MONGODB_URI in backend/.env"}), 503

    start_orchestrator(session_id_a, enriched_a, config, db)
    start_orchestrator(session_id_b, enriched_b, config, db)
    start_comparison_watcher(comparison_id, session_id_a, session_id_b, db)

    return jsonify({
        "comparison_id": comparison_id,
        "session_id_a": session_id_a,
        "session_id_b": session_id_b,
    }), 201


@api_bp.route("/comparisons", methods=["GET"])
def list_all_comparisons():
    db = get_db()
    skip = request.args.get("skip", 0, type=int)
    limit = request.args.get("limit", 50, type=int)
    comparisons = list_comparisons(db, limit=limit, skip=skip)
    return jsonify(comparisons)


@api_bp.route("/comparisons/<comparison_id>", methods=["GET"])
def get_comparison_detail(comparison_id: str):
    db = get_db()
    comp = get_comparison(db, comparison_id)
    if not comp:
        return jsonify({"error": "comparison not found"}), 404

    session_a = get_session(db, comp["session_id_a"])
    session_b = get_session(db, comp["session_id_b"])

    events_a = get_events(db, comp["session_id_a"]) if session_a else []
    edges_a = get_edges(db, comp["session_id_a"]) if session_a else []
    events_b = get_events(db, comp["session_id_b"]) if session_b else []
    edges_b = get_edges(db, comp["session_id_b"]) if session_b else []

    for ev_list in (events_a, events_b):
        for ev in ev_list:
            ev.pop("session_id", None)
    for edge_list in (edges_a, edges_b):
        for edge in edge_list:
            edge.pop("session_id", None)

    def _build_dag(session, events, edges):
        if not session:
            return None
        return {
            "target_event": session.get("target_event", {}),
            "threads": session.get("causal_threads", []),
            "events": events,
            "edges": edges,
            "subtopics": session.get("subtopics", []),
            "narrative": session.get("narrative", ""),
        }

    comp["dag_a"] = _build_dag(session_a, events_a, edges_a)
    comp["dag_b"] = _build_dag(session_b, events_b, edges_b)

    return jsonify(comp)


@api_bp.route("/comparisons/<comparison_id>/stream", methods=["GET"])
def stream_comparison(comparison_id: str):
    db = get_db()
    comp = get_comparison(db, comparison_id)
    if not comp:
        return jsonify({"error": "comparison not found"}), 404

    q = register_comparison_queue(comparison_id)

    def generate():
        try:
            status = comp.get("status", "")
            if status in ("COMPLETE", "ERROR"):
                evt = "complete" if status == "COMPLETE" else "error"
                data = json.dumps({
                    "comparison_id": comparison_id,
                    "status": status,
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
                        break
                except Empty:
                    fresh = get_comparison(db, comparison_id)
                    if fresh and fresh.get("status") in ("COMPLETE", "ERROR"):
                        evt = "complete" if fresh["status"] == "COMPLETE" else "error"
                        d = json.dumps({
                            "comparison_id": comparison_id,
                            "status": fresh["status"],
                        }, default=str)
                        yield f"event: {evt}\ndata: {d}\n\n"
                        break
                    yield ": heartbeat\n\n"
        finally:
            unregister_comparison_queue(comparison_id, q)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@api_bp.route("/comparisons/<comparison_id>/suggestions", methods=["POST"])
def submit_comparison_suggestion(comparison_id: str):
    db = get_db()
    comp = get_comparison(db, comparison_id)
    if not comp:
        return jsonify({"error": "comparison not found"}), 404

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    body = request.get_json()
    if body is None:
        return jsonify({"error": "Invalid JSON body"}), 400
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400

    add_comparison_suggestion(db, comparison_id, text)
    return jsonify({"status": "saved"}), 201


@api_bp.route("/comparisons/<comparison_id>/prompt-changes", methods=["POST"])
def submit_comparison_prompt_change(comparison_id: str):
    db = get_db()
    comp = get_comparison(db, comparison_id)
    if not comp:
        return jsonify({"error": "comparison not found"}), 404

    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    body = request.get_json()
    if body is None:
        return jsonify({"error": "Invalid JSON body"}), 400

    original = (body.get("original") or "").strip()
    revised = (body.get("revised") or "").strip()
    reason = (body.get("reason") or "").strip()
    if not revised:
        return jsonify({"error": "revised is required"}), 400

    add_comparison_prompt_change(db, comparison_id, original, revised, reason)
    return jsonify({"status": "saved"}), 201
