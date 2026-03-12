from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from queue import Queue

from .agents.planner import run_planner
from .agents.researcher import research_thread
from .agents.critic import run_critic
from .agents.renderer import generate_narrative
from .agents.categorizer import categorize_events
from .services.scoring import compute_coverage
from .models import (
    update_session,
    append_reasoning,
    upsert_event,
    upsert_edge,
    get_events,
    get_edges,
)

logger = logging.getLogger(__name__)

# Global registry of per-session SSE queues
_session_queues: dict[str, list[Queue]] = {}
_lock = threading.Lock()


def register_sse_queue(session_id: str) -> Queue:
    q: Queue = Queue()
    with _lock:
        _session_queues.setdefault(session_id, []).append(q)
    return q


def unregister_sse_queue(session_id: str, q: Queue):
    with _lock:
        queues = _session_queues.get(session_id, [])
        if q in queues:
            queues.remove(q)


def _emit(session_id: str, event_type: str, data: dict):
    """Push an SSE event to all registered queues for this session."""
    payload = {"event": event_type, "data": data}
    with _lock:
        for q in _session_queues.get(session_id, []):
            q.put(payload)


def _emit_reasoning(session_id: str, db, agent: str, msg: str, msg_type: str = "info"):
    entry = {"agent": agent, "type": msg_type, "msg": msg}
    append_reasoning(db, session_id, entry)
    _emit(session_id, "reasoning", {"agent": agent, "message": msg, "type": msg_type})


class Orchestrator:
    def __init__(self, session_id: str, query: str, config: dict, db):
        self.session_id = session_id
        self.query = query
        self.config = config
        self.db = db
        self.max_cycles = config.get("max_cycles", 5)
        self.max_depth = config.get("max_depth", 3)
        self.coverage_threshold = config.get("coverage_threshold", 0.70)
        self.threads: list[dict] = []
        self.target_event: dict = {}
        self.cycle = 0

    def run(self):
        try:
            self._run_loop()
        except Exception:
            logger.exception("Orchestrator fatal error for session %s", self.session_id)
            update_session(self.db, self.session_id, {"status": "ERROR"})
            _emit(self.session_id, "error", {"message": "Unexpected error in research loop", "recoverable": False})

    def _run_loop(self):
        critique = None

        while self.cycle < self.max_cycles:
            self.cycle += 1
            update_session(self.db, self.session_id, {"current_cycle": self.cycle})

            # ---- PLAN phase ----
            self._set_phase("PLAN")
            _emit_reasoning(self.session_id, self.db, "Planner", f"Initiating Plan Phase (Cycle {self.cycle})", "phase")
            _emit_reasoning(self.session_id, self.db, "Planner", f'Decomposing query "{self.query}"', "info")

            try:
                plan = run_planner(self.query, critique)
            except Exception:
                logger.exception("Planner failed on cycle %d", self.cycle)
                _emit_reasoning(self.session_id, self.db, "Planner", "Planner failed, aborting cycle", "warning")
                break

            self.target_event = plan.get("target_event", {})
            new_threads = plan.get("causal_threads", [])

            if self.cycle == 1:
                self.threads = new_threads
            else:
                existing_ids = {t["id"] for t in self.threads}
                for nt in new_threads:
                    if nt["id"] not in existing_ids:
                        self.threads.append(nt)
                    else:
                        for i, t in enumerate(self.threads):
                            if t["id"] == nt["id"]:
                                self.threads[i]["search_queries"] = nt.get("search_queries", t.get("search_queries", []))
                                self.threads[i]["priority"] = nt.get("priority", t.get("priority", 3))
                                break

            update_session(self.db, self.session_id, {
                "target_event": self.target_event,
                "causal_threads": self.threads,
            })

            thread_names = [t["name"] for t in self.threads]
            _emit_reasoning(
                self.session_id, self.db, "Planner",
                f"Identified {len(self.threads)} target threads: {', '.join(thread_names)}",
                "success",
            )

            for t in self.threads:
                _emit(self.session_id, "thread_update", {
                    "thread_id": t["id"],
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "color": t.get("color", ""),
                    "status": "pending",
                    "events_found": 0,
                    "message": f"Thread queued for research",
                })

            # ---- RESEARCH phase ----
            self._set_phase("RESEARCH")
            _emit_reasoning(self.session_id, self.db, "Orchestrator", "Transitioning to Research Phase", "phase")

            sorted_threads = sorted(self.threads, key=lambda t: t.get("priority", 3), reverse=True)
            existing_events = get_events(self.db, self.session_id)

            for thread in sorted_threads:
                _emit(self.session_id, "thread_update", {
                    "thread_id": thread["id"],
                    "name": thread["name"],
                    "description": thread.get("description", ""),
                    "color": thread.get("color", ""),
                    "status": "investigating",
                    "events_found": 0,
                    "message": f"Researching thread",
                })

                for sq in thread.get("search_queries", [])[:3]:
                    _emit_reasoning(
                        self.session_id, self.db, "Research",
                        f'Executing search: "{sq}"', "info",
                    )

                def _on_source_progress(idx, total, title, _sid=self.session_id, _db=self.db, _tname=thread["name"]):
                    _emit_reasoning(_sid, _db, "Research", f"[{_tname}] Analyzing source {idx}/{total}: {title}", "info")

                try:
                    result = research_thread(thread, existing_events, on_progress=_on_source_progress)
                except Exception:
                    logger.exception("Research failed for thread %s", thread["id"])
                    _emit_reasoning(
                        self.session_id, self.db, "Research",
                        f"Research failed for thread '{thread['name']}', skipping", "warning",
                    )
                    _emit(self.session_id, "thread_update", {
                        "thread_id": thread["id"],
                        "name": thread["name"],
                        "description": thread.get("description", ""),
                        "color": thread.get("color", ""),
                        "status": "error",
                        "events_found": 0,
                        "message": "Research failed",
                    })
                    continue

                id_map = {}
                for ev in result.get("events", []):
                    old_id = ev.pop("id", None)
                    new_id = upsert_event(self.db, self.session_id, ev)
                    if old_id:
                        id_map[old_id] = new_id

                for edge in result.get("causal_edges", []):
                    edge["from_event_id"] = id_map.get(edge.get("from_event_id", ""), edge.get("from_event_id", ""))
                    edge["to_event_id"] = id_map.get(edge.get("to_event_id", ""), edge.get("to_event_id", ""))
                    upsert_edge(self.db, self.session_id, edge)

                n_events = len(result.get("events", []))
                n_edges = len(result.get("causal_edges", []))
                n_sources = len(result.get("raw_sources", []))

                _emit_reasoning(
                    self.session_id, self.db, "Research",
                    f"Found {n_sources} relevant sources for '{thread['name']}'", "success",
                )
                _emit_reasoning(
                    self.session_id, self.db, "Research",
                    f"Extracted {n_events} events and {n_edges} causal edges", "success",
                )
                _emit(self.session_id, "thread_update", {
                    "thread_id": thread["id"],
                    "name": thread["name"],
                    "description": thread.get("description", ""),
                    "color": thread.get("color", ""),
                    "status": "complete",
                    "events_found": n_events,
                    "message": f"Research complete: {n_events} events, {n_edges} edges",
                })

                existing_events = get_events(self.db, self.session_id)

            # ---- EVALUATE phase ----
            self._set_phase("EVALUATE")
            _emit_reasoning(self.session_id, self.db, "Orchestrator", "Transitioning to Evaluate Phase", "phase")
            _emit_reasoning(self.session_id, self.db, "Critic", "Assembling DAG and evaluating for gaps and contradictions", "info")

            all_events = get_events(self.db, self.session_id)
            all_edges = get_edges(self.db, self.session_id)

            try:
                critique = run_critic(self.query, self.threads, all_events, all_edges)
            except Exception:
                logger.exception("Critic failed on cycle %d", self.cycle)
                _emit_reasoning(self.session_id, self.db, "Critic", "Critic evaluation failed", "warning")
                critique = {"overall_score": 0.0, "is_sufficient": False, "recommendations": []}

            score = critique.get("overall_score", 0.0)
            gap_count = len(critique.get("temporal_gaps", [])) + len(critique.get("causal_gaps", []))
            weak_count = len(critique.get("weak_links", []))

            for gap in critique.get("temporal_gaps", []):
                _emit_reasoning(
                    self.session_id, self.db, "Critic",
                    f"Temporal Gap: {gap.get('thread_id', '?')} from {gap.get('start_date', '?')} to {gap.get('end_date', '?')}",
                    "warning",
                )
            for wl in critique.get("weak_links", []):
                _emit_reasoning(
                    self.session_id, self.db, "Critic",
                    f"Weak Link: {wl.get('reason', 'unknown reason')} (confidence: {wl.get('current_confidence', '?')})",
                    "warning",
                )

            _emit(self.session_id, "critique", {
                "overall_score": score,
                "gap_count": gap_count,
                "recommendation_count": len(critique.get("recommendations", [])),
            })

            local_cov = compute_coverage(self.threads, all_events, all_edges)
            effective_score = max(score, local_cov)

            if effective_score >= self.coverage_threshold:
                _emit_reasoning(
                    self.session_id, self.db, "Critic",
                    f"Coverage threshold of {self.coverage_threshold:.2f} met (Current: {effective_score:.2f})",
                    "success",
                )
                break
            elif self.cycle >= self.max_cycles:
                _emit_reasoning(
                    self.session_id, self.db, "Orchestrator",
                    f"Max cycles ({self.max_cycles}) reached with score {effective_score:.2f}. Proceeding to render.",
                    "warning",
                )
                break
            else:
                _emit_reasoning(
                    self.session_id, self.db, "Orchestrator",
                    f"Transitioning to Adapt Phase (Cycle {self.cycle + 1})",
                    "phase",
                )
                for rec in critique.get("recommendations", [])[:3]:
                    _emit_reasoning(self.session_id, self.db, "Planner", f"Adapting: {rec}", "info")

        # ---- CATEGORIZE phase ----
        self._set_phase("CATEGORIZE")
        _emit_reasoning(self.session_id, self.db, "Orchestrator", "Transitioning to Categorize Phase", "phase")
        _emit_reasoning(self.session_id, self.db, "Categorizer", "Clustering events into subtopics", "info")

        all_events = get_events(self.db, self.session_id)

        try:
            subtopics = categorize_events(self.threads, all_events)
        except Exception:
            logger.exception("Categorization failed")
            subtopics = []
            _emit_reasoning(self.session_id, self.db, "Categorizer", "Categorization failed, skipping subtopics", "warning")

        update_session(self.db, self.session_id, {"subtopics": subtopics})

        from bson import ObjectId as _OID
        for st in subtopics:
            for eid in st["event_ids"]:
                try:
                    self.db.events.update_one(
                        {"_id": _OID(eid)},
                        {"$set": {"subtopic_id": st["id"]}},
                    )
                except Exception:
                    pass

        _emit_reasoning(
            self.session_id, self.db, "Categorizer",
            f"Organized events into {len(subtopics)} subtopics across {len(self.threads)} threads",
            "success",
        )

        # ---- RENDER phase ----
        self._set_phase("RENDER")
        _emit_reasoning(self.session_id, self.db, "Orchestrator", "Transitioning to Finalizing Phase", "phase")
        _emit_reasoning(self.session_id, self.db, "Renderer", "Generating Interactive DAG and Narrative Summary", "info")

        all_events = get_events(self.db, self.session_id)
        all_edges = get_edges(self.db, self.session_id)

        # Mark the target event
        target_name = self.target_event.get("name", "").lower()
        for ev in all_events:
            if target_name and target_name in ev.get("title", "").lower():
                ev["is_target"] = True
                from bson import ObjectId as _OID
                self.db.events.update_one({"_id": _OID(ev["id"])}, {"$set": {"is_target": True}})
                break

        try:
            narrative = generate_narrative(self.query, self.target_event, self.threads, all_events, all_edges)
        except Exception:
            logger.exception("Narrative generation failed")
            narrative = "Narrative generation failed. Please review the timeline visualization for causal analysis."
            _emit_reasoning(self.session_id, self.db, "Renderer", "Narrative generation failed", "warning")

        update_session(self.db, self.session_id, {
            "status": "COMPLETE",
            "narrative": narrative,
            "completed_at": datetime.now(timezone.utc),
        })

        _emit_reasoning(self.session_id, self.db, "Orchestrator", "Research session complete.", "success")
        _emit(self.session_id, "complete", {
            "session_id": self.session_id,
            "event_count": len(all_events),
            "edge_count": len(all_edges),
            "final_score": critique.get("overall_score", 0.0) if critique else 0.0,
        })

    def _set_phase(self, phase: str):
        update_session(self.db, self.session_id, {"status": phase})
        _emit(self.session_id, "phase_change", {
            "phase": phase,
            "cycle": self.cycle,
            "message": f"Entering {phase} phase",
        })


def start_orchestrator(session_id: str, query: str, config: dict, db) -> threading.Thread:
    orch = Orchestrator(session_id, query, config, db)
    t = threading.Thread(target=orch.run, daemon=True)
    t.start()
    return t
