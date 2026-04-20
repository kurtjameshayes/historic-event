from __future__ import annotations

import hashlib
import logging
import threading
import time
from datetime import datetime, timezone
from queue import Queue

from .agents.comparator import run_comparator
from .models import (
    get_session,
    get_comparison,
    update_comparison,
    get_events,
    get_edges,
    upsert_prompt_memory_entries,
    get_prompt_memory,
)
from .services.prompt_memory import (
    GLOBAL_PROMPT_MEMORY_SCOPE,
    collapse_prompt_memory,
)

logger = logging.getLogger(__name__)

_comparison_queues: dict[str, list[Queue]] = {}
_comp_lock = threading.Lock()


def register_comparison_queue(comparison_id: str) -> Queue:
    q: Queue = Queue()
    with _comp_lock:
        _comparison_queues.setdefault(comparison_id, []).append(q)
    return q


def unregister_comparison_queue(comparison_id: str, q: Queue):
    with _comp_lock:
        queues = _comparison_queues.get(comparison_id, [])
        if q in queues:
            queues.remove(q)


def _emit_comparison(comparison_id: str, event_type: str, data: dict):
    payload = {"event": event_type, "data": data}
    with _comp_lock:
        for q in _comparison_queues.get(comparison_id, []):
            q.put(payload)


def build_comparison_scope_key(query_a: str, query_b: str) -> str:
    combined = " ".join((query_a or "").lower().split()) + "|" + " ".join((query_b or "").lower().split())
    digest = hashlib.sha256(combined.encode("utf-8")).hexdigest()[:16]
    return f"comparison:{digest}"


def _persist_comparison_prompt_memory(
    db,
    comparison_id: str,
    query_a: str,
    query_b: str,
    analysis: dict,
):
    """Distill comparison analysis into prompt memory entries for future comparisons."""
    scope_key = build_comparison_scope_key(query_a, query_b)
    entries: list[dict] = []

    source = {"type": "comparator", "comparison_id": comparison_id}

    for sim in analysis.get("similarities", [])[:5]:
        text = f"Comparison pattern ({sim.get('category', 'general')}): {sim.get('description', '')}"
        entries.append({
            "scope_key": scope_key,
            "target": "comparator",
            "category": "similarity_pattern",
            "text": text,
            "metadata": {"category": sim.get("category", "")},
            "source": source,
        })

    for diff in analysis.get("differences", [])[:5]:
        text = f"Divergence ({diff.get('category', 'general')}): {diff.get('description', '')}"
        entries.append({
            "scope_key": scope_key,
            "target": "comparator",
            "category": "difference_pattern",
            "text": text,
            "metadata": {"category": diff.get("category", "")},
            "source": source,
        })

    if analysis.get("summary"):
        entries.append({
            "scope_key": GLOBAL_PROMPT_MEMORY_SCOPE,
            "target": "comparator",
            "category": "comparison_guidance",
            "text": "When comparing historical timelines, prioritize structural causal parallels over superficial date coincidences.",
            "source": source,
        })

    if entries:
        saved = upsert_prompt_memory_entries(db, entries)
        logger.info("Persisted %d comparison prompt memory entries", len(saved))


class ComparisonWatcher:
    """Polls both sessions until complete, then runs the comparison agent."""

    def __init__(self, comparison_id: str, session_id_a: str, session_id_b: str, db):
        self.comparison_id = comparison_id
        self.session_id_a = session_id_a
        self.session_id_b = session_id_b
        self.db = db

    def run(self):
        try:
            self._watch_and_compare()
        except Exception:
            logger.exception("ComparisonWatcher fatal error for %s", self.comparison_id)
            update_comparison(self.db, self.comparison_id, {"status": "ERROR"})
            _emit_comparison(self.comparison_id, "error", {
                "message": "Unexpected error during comparison",
                "recoverable": False,
            })

    def _watch_and_compare(self):
        _emit_comparison(self.comparison_id, "phase_change", {
            "phase": "RESEARCHING",
            "message": "Waiting for both timelines to complete research",
        })

        terminal_states = {"COMPLETE", "ERROR"}
        poll_interval = 3

        while True:
            session_a = get_session(self.db, self.session_id_a)
            session_b = get_session(self.db, self.session_id_b)

            if not session_a or not session_b:
                update_comparison(self.db, self.comparison_id, {"status": "ERROR"})
                _emit_comparison(self.comparison_id, "error", {
                    "message": "One or both sessions not found",
                    "recoverable": False,
                })
                return

            status_a = session_a.get("status", "")
            status_b = session_b.get("status", "")

            _emit_comparison(self.comparison_id, "session_progress", {
                "session_a": {"id": self.session_id_a, "status": status_a},
                "session_b": {"id": self.session_id_b, "status": status_b},
            })

            if status_a in terminal_states and status_b in terminal_states:
                break

            time.sleep(poll_interval)

        if status_a == "ERROR" or status_b == "ERROR":
            update_comparison(self.db, self.comparison_id, {"status": "ERROR"})
            _emit_comparison(self.comparison_id, "error", {
                "message": "One or both research sessions ended with an error",
                "recoverable": True,
            })
            return

        update_comparison(self.db, self.comparison_id, {"status": "COMPARING"})
        _emit_comparison(self.comparison_id, "phase_change", {
            "phase": "COMPARING",
            "message": "Both timelines complete. Running comparison analysis...",
        })

        events_a = get_events(self.db, self.session_id_a)
        edges_a = get_edges(self.db, self.session_id_a)
        threads_a = session_a.get("causal_threads", [])

        events_b = get_events(self.db, self.session_id_b)
        edges_b = get_edges(self.db, self.session_id_b)
        threads_b = session_b.get("causal_threads", [])

        comp_scope = build_comparison_scope_key(
            session_a.get("query", ""),
            session_b.get("query", ""),
        )
        memory_entries = (
            get_prompt_memory(self.db, comp_scope, "comparator", limit=10)
            + get_prompt_memory(self.db, GLOBAL_PROMPT_MEMORY_SCOPE, "comparator", limit=10)
        )
        prompt_memory = collapse_prompt_memory(memory_entries, "comparator")

        try:
            analysis = run_comparator(
                query_a=session_a.get("query", ""),
                query_b=session_b.get("query", ""),
                threads_a=threads_a,
                events_a=events_a,
                edges_a=edges_a,
                threads_b=threads_b,
                events_b=events_b,
                edges_b=edges_b,
                prompt_memory=prompt_memory,
            )
        except Exception:
            logger.exception("Comparison agent failed for %s", self.comparison_id)
            update_comparison(self.db, self.comparison_id, {"status": "ERROR"})
            _emit_comparison(self.comparison_id, "error", {
                "message": "Comparison analysis failed",
                "recoverable": True,
            })
            return

        update_comparison(self.db, self.comparison_id, {
            "status": "COMPLETE",
            "analysis": analysis,
            "completed_at": datetime.now(timezone.utc),
        })

        _persist_comparison_prompt_memory(
            self.db,
            self.comparison_id,
            session_a.get("query", ""),
            session_b.get("query", ""),
            analysis,
        )

        _emit_comparison(self.comparison_id, "complete", {
            "comparison_id": self.comparison_id,
            "similarities_count": len(analysis.get("similarities", [])),
            "differences_count": len(analysis.get("differences", [])),
        })


def start_comparison_watcher(
    comparison_id: str,
    session_id_a: str,
    session_id_b: str,
    db,
) -> threading.Thread:
    watcher = ComparisonWatcher(comparison_id, session_id_a, session_id_b, db)
    t = threading.Thread(target=watcher.run, daemon=True)
    t.start()
    return t
