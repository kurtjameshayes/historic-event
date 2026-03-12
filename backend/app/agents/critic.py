from __future__ import annotations

import json
import logging

from ..services.llm import call_llm
from ..prompts.critic import CRITIC_SYSTEM, build_critic_prompt

logger = logging.getLogger(__name__)


MAX_EVENTS_FOR_CRITIC = 100
MAX_EDGES_FOR_CRITIC = 150
MAX_PROMPT_CHARS = 600_000


def run_critic(query: str, threads: list[dict], events: list[dict], edges: list[dict]) -> dict:
    """Evaluate the current DAG and return a structured critique."""
    capped_events = sorted(events, key=lambda e: e.get("timestamp", 0))[:MAX_EVENTS_FOR_CRITIC]
    event_ids = {e.get("id") for e in capped_events}
    capped_edges = [
        ed for ed in edges
        if ed.get("from_event_id") in event_ids and ed.get("to_event_id") in event_ids
    ][:MAX_EDGES_FOR_CRITIC]

    dag_data = {
        "threads": [{"id": t.get("id", ""), "name": t.get("name", ""), "description": t.get("description", "")[:120]} for t in threads],
        "events": [
            {
                "id": e.get("id", ""),
                "title": e.get("title", ""),
                "date": e.get("date", ""),
                "thread_id": e.get("thread_id", ""),
                "description": e.get("description", "")[:150],
                "source_count": len(e.get("sources", [])),
            }
            for e in capped_events
        ],
        "edges": [
            {
                "id": ed.get("id", ""),
                "from_event_id": ed.get("from_event_id", ""),
                "to_event_id": ed.get("to_event_id", ""),
                "confidence": ed.get("confidence", 0),
                "reasoning": ed.get("reasoning", "")[:120],
                "thread_id": ed.get("thread_id", ""),
            }
            for ed in capped_edges
        ],
    }
    dag_json = json.dumps(dag_data, default=str)

    if len(dag_json) > MAX_PROMPT_CHARS:
        logger.warning("Critic DAG JSON too large (%d chars), truncating", len(dag_json))
        dag_data["events"] = dag_data["events"][:50]
        kept_ids = {e["id"] for e in dag_data["events"]}
        dag_data["edges"] = [ed for ed in dag_data["edges"] if ed["from_event_id"] in kept_ids and ed["to_event_id"] in kept_ids]
        dag_json = json.dumps(dag_data, default=str)

    result = call_llm(CRITIC_SYSTEM, build_critic_prompt(query, dag_json), max_tokens=4096)

    result.setdefault("overall_score", 0.0)
    result.setdefault("is_sufficient", result["overall_score"] >= 0.70)
    result.setdefault("temporal_gaps", [])
    result.setdefault("causal_gaps", [])
    result.setdefault("weak_links", [])
    result.setdefault("missing_threads", [])
    result.setdefault("contradictions", [])
    result.setdefault("recommendations", [])

    logger.info(
        "Critic evaluation: score=%.2f, sufficient=%s, gaps=%d, weak_links=%d, missing_threads=%d",
        result["overall_score"],
        result["is_sufficient"],
        len(result["temporal_gaps"]) + len(result["causal_gaps"]),
        len(result["weak_links"]),
        len(result["missing_threads"]),
    )

    return result
