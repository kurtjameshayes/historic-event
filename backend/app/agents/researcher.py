from __future__ import annotations

import logging
import uuid
from difflib import SequenceMatcher

from ..services.llm import call_llm
from ..services.search import search_combined
from ..services.scoring import compute_confidence
from ..prompts.researcher import RESEARCHER_SYSTEM, build_researcher_prompt

logger = logging.getLogger(__name__)


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _deduplicate_events(events: list[dict]) -> list[dict]:
    """Merge near-duplicate events by fuzzy matching on title + date."""
    unique = []
    for ev in events:
        dup = False
        for existing in unique:
            if (
                _similarity(ev.get("title", ""), existing.get("title", "")) > 0.8
                and _similarity(ev.get("date", ""), existing.get("date", "")) > 0.6
            ):
                for src in ev.get("sources", []):
                    if src not in existing.get("sources", []):
                        existing.setdefault("sources", []).append(src)
                dup = True
                break
        if not dup:
            unique.append(ev)
    return unique


def _parse_date_to_timestamp(date_str: str) -> int:
    """Best-effort parse of a date string to epoch milliseconds for timeline positioning."""
    import re
    from datetime import datetime

    date_str = date_str.strip()

    iso_match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if iso_match:
        try:
            dt = datetime(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass

    year_month = re.match(r"(\d{4})-(\d{2})", date_str)
    if year_month:
        try:
            dt = datetime(int(year_month.group(1)), int(year_month.group(2)), 1)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass

    year_match = re.search(r"\b(\d{4})\b", date_str)
    if year_match:
        try:
            dt = datetime(int(year_match.group(1)), 6, 15)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass

    decade_match = re.match(r"(\d{3})0s", date_str)
    if decade_match:
        try:
            dt = datetime(int(decade_match.group(1) + "5"), 6, 15)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass

    return 0


def _score_source_relevance(source: dict, thread_name: str, thread_desc: str, queries: list[str]) -> float:
    """Rate a source 0-1 by how well it matches the thread topic."""
    title = source.get("title", "")
    snippet = (source.get("content") or "")[:500]
    text = f"{title} {snippet}".lower()

    name_sim = _similarity(title, thread_name)
    desc_sim = _similarity(snippet[:200], thread_desc) if thread_desc else 0.0
    query_sim = max((_similarity(title, q) for q in queries), default=0.0) if queries else 0.0

    content = source.get("raw_content") or source.get("content", "")
    length_bonus = min(len(content) / 5000, 1.0) * 0.15

    thread_tokens = set(thread_name.lower().split())
    token_hits = sum(1 for tok in thread_tokens if tok in text) / max(len(thread_tokens), 1)

    return 0.30 * name_sim + 0.20 * desc_sim + 0.20 * query_sim + 0.15 * token_hits + length_bonus


def research_thread(
    thread: dict,
    existing_events: list[dict] | None = None,
    on_progress: callable | None = None,
    max_sources: int = 5,
    prompt_memory: list[str] | None = None,
) -> dict:
    """Execute research for a single causal thread. Returns events and edges."""
    thread_id = thread["id"]
    thread_name = thread["name"]
    thread_desc = thread.get("description", "")
    queries = thread.get("search_queries", [])

    all_events: list[dict] = []
    all_edges: list[dict] = []
    all_sources: list[dict] = []

    viable_sources: list[dict] = []
    for query in queries:
        logger.info("Researching thread '%s' with query: %s", thread_name, query)
        search_results = search_combined(query)

        if not search_results:
            alt_query = f"{query} history causes"
            logger.info("No results, trying alternative: %s", alt_query)
            search_results = search_combined(alt_query)
        if not search_results:
            alt_query = f"{thread_name} historical events timeline"
            logger.info("Still no results, trying: %s", alt_query)
            search_results = search_combined(alt_query)

        for result in search_results:
            content = result.get("raw_content") or result.get("content", "")
            if not content or len(content.strip()) < 100:
                continue
            viable_sources.append(result)

    for src in viable_sources:
        src["_relevance"] = _score_source_relevance(src, thread_name, thread_desc, queries)
    viable_sources.sort(key=lambda s: s["_relevance"], reverse=True)

    if max_sources > 0:
        viable_sources = viable_sources[:max_sources]

    total_sources = len(viable_sources)

    for source_idx, result in enumerate(viable_sources, 1):
        content = result.get("raw_content") or result.get("content", "")
        relevance = result.pop("_relevance", 0.0)

        all_sources.append({
            "url": result.get("url", ""),
            "title": result.get("title", ""),
            "quality": "secondary",
            "relevance": round(relevance, 3),
            "excerpt": content[:200],
        })

        if on_progress:
            on_progress(source_idx, total_sources, result.get("title", "")[:80])

        try:
            extraction = call_llm(
                RESEARCHER_SYSTEM,
                build_researcher_prompt(
                    thread_name, thread_desc, content,
                    result.get("url", ""), result.get("title", ""),
                    prompt_memory,
                ),
            )
        except Exception:
            logger.exception("LLM extraction failed for source: %s", result.get("url", ""))
            continue

        for ev in extraction.get("events", []):
            ev["thread_id"] = thread_id
            ev["id"] = f"e-{uuid.uuid4().hex[:8]}"
            ev["timestamp"] = _parse_date_to_timestamp(ev.get("date", ""))
            ev.setdefault("sources", []).append({
                "url": result.get("url", ""),
                "title": result.get("title", ""),
                "quality": ev.pop("source_quality", "secondary"),
                "excerpt": content[:200],
            })
            all_events.append(ev)

        for edge in extraction.get("causal_edges", []):
            edge["thread_id"] = thread_id
            edge["id"] = f"ed-{uuid.uuid4().hex[:8]}"
            all_edges.append(edge)

    all_events = _deduplicate_events(all_events)

    # Resolve edge title references to event IDs
    event_title_to_id = {ev["title"]: ev["id"] for ev in all_events}
    if existing_events:
        for ev in existing_events:
            event_title_to_id[ev["title"]] = ev["id"]

    resolved_edges = []
    for edge in all_edges:
        from_title = edge.pop("from_event_title", "")
        to_title = edge.pop("to_event_title", "")

        from_id = event_title_to_id.get(from_title)
        to_id = event_title_to_id.get(to_title)

        if not from_id:
            for title, eid in event_title_to_id.items():
                if _similarity(from_title, title) > 0.7:
                    from_id = eid
                    break
        if not to_id:
            for title, eid in event_title_to_id.items():
                if _similarity(to_title, title) > 0.7:
                    to_id = eid
                    break

        if from_id and to_id and from_id != to_id:
            source_events = [ev for ev in all_events if ev["id"] in (from_id, to_id)]
            all_src = []
            for sev in source_events:
                all_src.extend(sev.get("sources", []))

            edge["from_event_id"] = from_id
            edge["to_event_id"] = to_id
            edge["confidence"] = compute_confidence(
                all_src,
                agreement=1.0,
                extraction_confidence=edge.pop("extraction_confidence", 0.8),
            )
            edge.setdefault("reasoning", "")
            resolved_edges.append(edge)

    logger.info(
        "Thread '%s' research complete: %d events, %d edges from %d sources",
        thread_name, len(all_events), len(resolved_edges), len(all_sources),
    )

    return {
        "thread_id": thread_id,
        "events": all_events,
        "causal_edges": resolved_edges,
        "raw_sources": all_sources,
    }
