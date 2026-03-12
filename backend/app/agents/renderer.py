from __future__ import annotations

import json
import logging

from ..services.llm import call_llm  # noqa: F401 - json used in dag_data construction
from ..prompts.narrator import NARRATOR_SYSTEM, build_narrator_prompt

logger = logging.getLogger(__name__)


MAX_EVENTS_FOR_NARRATIVE = 80
MAX_EDGES_FOR_NARRATIVE = 120
MAX_PROMPT_CHARS = 600_000


def generate_narrative(
    query: str,
    target_event: dict,
    threads: list[dict],
    events: list[dict],
    edges: list[dict],
) -> str:
    """Generate a prose narrative from the final DAG."""
    sorted_events = sorted(events, key=lambda e: e.get("timestamp", 0))[:MAX_EVENTS_FOR_NARRATIVE]
    event_ids = {e.get("id") for e in sorted_events}
    filtered_edges = [
        ed for ed in edges
        if ed.get("from_event_id") in event_ids and ed.get("to_event_id") in event_ids
    ][:MAX_EDGES_FOR_NARRATIVE]

    dag_data = {
        "target_event": target_event,
        "threads": [{"id": t["id"], "name": t["name"], "description": t.get("description", "")[:150]} for t in threads],
        "events": [
            {
                "id": e.get("id", ""),
                "title": e.get("title", ""),
                "date": e.get("date", ""),
                "thread_id": e.get("thread_id", ""),
                "description": e.get("description", "")[:200],
                "is_target": e.get("is_target", False),
            }
            for e in sorted_events
        ],
        "edges": [
            {
                "from_event_id": ed.get("from_event_id", ""),
                "to_event_id": ed.get("to_event_id", ""),
                "reasoning": ed.get("reasoning", "")[:120],
                "confidence": ed.get("confidence", 0),
            }
            for ed in filtered_edges
        ],
    }
    dag_json = json.dumps(dag_data, default=str)

    if len(dag_json) > MAX_PROMPT_CHARS:
        logger.warning("DAG JSON too large (%d chars), truncating events", len(dag_json))
        dag_data["events"] = dag_data["events"][:40]
        kept_ids = {e["id"] for e in dag_data["events"]}
        dag_data["edges"] = [ed for ed in dag_data["edges"] if ed["from_event_id"] in kept_ids and ed["to_event_id"] in kept_ids]
        dag_json = json.dumps(dag_data, default=str)

    narrative = call_llm(
        NARRATOR_SYSTEM,
        build_narrator_prompt(query, dag_json),
        max_tokens=4096,
        parse_json=False,
    )

    logger.info("Generated narrative of %d characters", len(narrative))
    return narrative
