from __future__ import annotations

import json
import logging

from ..services.llm import call_llm
from ..prompts.comparator import COMPARATOR_SYSTEM, build_comparator_prompt

logger = logging.getLogger(__name__)

MAX_EVENTS_PER_SIDE = 80
MAX_EDGES_PER_SIDE = 120
MAX_PROMPT_CHARS = 500_000


def _build_dag_json(threads: list[dict], events: list[dict], edges: list[dict]) -> str:
    capped_events = sorted(events, key=lambda e: e.get("timestamp", 0))[:MAX_EVENTS_PER_SIDE]
    event_ids = {e.get("id") for e in capped_events}
    capped_edges = [
        ed for ed in edges
        if ed.get("from_event_id") in event_ids and ed.get("to_event_id") in event_ids
    ][:MAX_EDGES_PER_SIDE]

    dag_data = {
        "threads": [
            {"id": t.get("id", ""), "name": t.get("name", ""), "description": t.get("description", "")[:120]}
            for t in threads
        ],
        "events": [
            {
                "id": e.get("id", ""),
                "title": e.get("title", ""),
                "date": e.get("date", ""),
                "thread_id": e.get("thread_id", ""),
                "description": e.get("description", "")[:150],
            }
            for e in capped_events
        ],
        "edges": [
            {
                "from_event_id": ed.get("from_event_id", ""),
                "to_event_id": ed.get("to_event_id", ""),
                "confidence": ed.get("confidence", 0),
                "reasoning": ed.get("reasoning", "")[:120],
            }
            for ed in capped_edges
        ],
    }
    return json.dumps(dag_data, default=str)


def run_comparator(
    query_a: str,
    query_b: str,
    threads_a: list[dict],
    events_a: list[dict],
    edges_a: list[dict],
    threads_b: list[dict],
    events_b: list[dict],
    edges_b: list[dict],
    prompt_memory: list[str] | None = None,
) -> dict:
    """Compare two timelines and return structured analysis."""
    dag_a_json = _build_dag_json(threads_a, events_a, edges_a)
    dag_b_json = _build_dag_json(threads_b, events_b, edges_b)

    combined_len = len(dag_a_json) + len(dag_b_json)
    if combined_len > MAX_PROMPT_CHARS:
        logger.warning("Combined DAG JSON too large (%d chars), reducing events", combined_len)
        dag_a_json = _build_dag_json(threads_a, events_a[:40], edges_a)
        dag_b_json = _build_dag_json(threads_b, events_b[:40], edges_b)

    user_prompt = build_comparator_prompt(query_a, query_b, dag_a_json, dag_b_json, prompt_memory)
    result = call_llm(COMPARATOR_SYSTEM, user_prompt, max_tokens=4096)

    result.setdefault("similarities", [])
    result.setdefault("differences", [])
    result.setdefault("summary", "")

    logger.info(
        "Comparison complete: %d similarities, %d differences",
        len(result["similarities"]),
        len(result["differences"]),
    )

    return result
