from __future__ import annotations

import logging

from ..services.llm import call_llm
from ..prompts.planner import PLANNER_SYSTEM, build_planner_prompt

logger = logging.getLogger(__name__)

THREAD_COLORS = [
    "bg-blue-500 border-blue-600 text-blue-800",
    "bg-green-500 border-green-600 text-green-800",
    "bg-amber-500 border-amber-600 text-amber-800",
    "bg-purple-500 border-purple-600 text-purple-800",
    "bg-rose-500 border-rose-600 text-rose-800",
    "bg-cyan-500 border-cyan-600 text-cyan-800",
]


def run_planner(query: str, critique: dict | None = None) -> dict:
    """Decompose a query into causal threads. Returns planner output dict."""
    user_prompt = build_planner_prompt(query, critique)
    result = call_llm(PLANNER_SYSTEM, user_prompt)

    for i, thread in enumerate(result.get("causal_threads", [])):
        if "color" not in thread:
            thread["color"] = THREAD_COLORS[i % len(THREAD_COLORS)]
        if "status" not in thread:
            thread["status"] = "pending"

    logger.info(
        "Planner identified target '%s' with %d threads",
        result.get("target_event", {}).get("name", "?"),
        len(result.get("causal_threads", [])),
    )
    return result
