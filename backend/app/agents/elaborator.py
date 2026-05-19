from __future__ import annotations

import logging

from ..services.llm import call_llm
from ..prompts.elaborator import ELABORATOR_SYSTEM, build_elaborator_prompt

logger = logging.getLogger(__name__)


def elaborate_event(
    query: str,
    event: dict,
    thread: dict | None,
    subtopic: dict | None,
    sibling_events: list[dict] | None,
) -> str:
    """Generate a 4-6 paragraph deep-dive on a single event in the context of its subtopic.

    Returns a plain-text string (paragraphs separated by double newlines).
    """
    sources = event.get("sources") or []
    prompt = build_elaborator_prompt(
        query=query,
        event=event,
        thread=thread,
        subtopic=subtopic,
        sibling_events=sibling_events,
        sources=sources,
    )

    try:
        raw = call_llm(
            ELABORATOR_SYSTEM,
            prompt,
            max_tokens=2048,
            parse_json=False,
        )
    except Exception:
        logger.exception("Event elaboration failed for event '%s'", event.get("title", ""))
        raise

    if not isinstance(raw, str):
        raw = str(raw)
    return raw.strip()
