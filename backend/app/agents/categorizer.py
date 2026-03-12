from __future__ import annotations

import json
import logging
import statistics
import uuid
from collections import defaultdict

from ..services.llm import call_llm
from ..prompts.categorizer import CATEGORIZER_SYSTEM, build_categorizer_prompt

logger = logging.getLogger(__name__)

MIN_CLUSTER_SIZE = 2
MAX_CLUSTER_SIZE = 8
GAP_MULTIPLIER = 2.0


def _cluster_by_temporal_gap(events: list[dict]) -> list[list[dict]]:
    """Split a sorted list of events into clusters based on temporal gaps."""
    if len(events) <= MAX_CLUSTER_SIZE:
        return [events] if events else []

    timestamps = [e.get("timestamp", 0) for e in events]
    gaps = [timestamps[i + 1] - timestamps[i] for i in range(len(timestamps) - 1)]

    if not gaps or all(g == 0 for g in gaps):
        return _split_evenly(events)

    non_zero_gaps = [g for g in gaps if g > 0]
    if not non_zero_gaps:
        return _split_evenly(events)

    median_gap = statistics.median(non_zero_gaps)
    threshold = median_gap * GAP_MULTIPLIER

    clusters: list[list[dict]] = [[events[0]]]
    for i, event in enumerate(events[1:], start=0):
        if gaps[i] > threshold and len(clusters[-1]) >= MIN_CLUSTER_SIZE:
            clusters.append([event])
        else:
            clusters[-1].append(event)

    merged = _enforce_size_limits(clusters)
    return merged


def _split_evenly(events: list[dict]) -> list[list[dict]]:
    """Fall back to roughly equal splits when gap detection is not useful."""
    n = len(events)
    target = min(MAX_CLUSTER_SIZE, max(MIN_CLUSTER_SIZE, n // 3))
    clusters = []
    for i in range(0, n, target):
        chunk = events[i : i + target]
        if chunk:
            clusters.append(chunk)
    if len(clusters) > 1 and len(clusters[-1]) < MIN_CLUSTER_SIZE:
        clusters[-2].extend(clusters.pop())
    return clusters


def _enforce_size_limits(clusters: list[list[dict]]) -> list[list[dict]]:
    """Merge tiny clusters and split oversized ones."""
    merged: list[list[dict]] = []
    for cl in clusters:
        if merged and len(merged[-1]) + len(cl) <= MAX_CLUSTER_SIZE and len(cl) < MIN_CLUSTER_SIZE:
            merged[-1].extend(cl)
        elif len(cl) > MAX_CLUSTER_SIZE:
            for sub in _split_evenly(cl):
                merged.append(sub)
        else:
            merged.append(cl)
    if merged and len(merged[-1]) < MIN_CLUSTER_SIZE and len(merged) > 1:
        merged[-2].extend(merged.pop())
    return merged


def _build_cluster_payload(
    thread_map: dict[str, dict],
    thread_clusters: dict[str, list[list[dict]]],
) -> tuple[list[dict], dict[str, list[str]]]:
    """Build compact cluster data for the LLM and a mapping of cluster_id -> event_ids."""
    payload = []
    cluster_event_map: dict[str, list[str]] = {}

    for thread_id, clusters in thread_clusters.items():
        thread_name = thread_map.get(thread_id, {}).get("name", thread_id)
        for ci, cluster in enumerate(clusters):
            cluster_id = f"{thread_id}_c{ci}"
            event_ids = [e.get("id", "") for e in cluster]
            cluster_event_map[cluster_id] = event_ids
            payload.append({
                "cluster_id": cluster_id,
                "thread_name": thread_name,
                "events": [
                    {"title": e.get("title", ""), "date": e.get("date", "")}
                    for e in cluster
                ],
            })

    return payload, cluster_event_map


def categorize_events(threads: list[dict], events: list[dict]) -> list[dict]:
    """
    Group events by thread, cluster temporally, and use one LLM call to
    generate meaningful subtopic names. Returns a list of subtopic dicts.
    """
    if not events:
        return []

    thread_map = {t["id"]: t for t in threads}

    by_thread: dict[str, list[dict]] = defaultdict(list)
    for ev in events:
        tid = ev.get("thread_id")
        if tid:
            by_thread[tid].append(ev)

    thread_clusters: dict[str, list[list[dict]]] = {}
    for tid, thread_events in by_thread.items():
        sorted_events = sorted(thread_events, key=lambda e: e.get("timestamp", 0))
        thread_clusters[tid] = _cluster_by_temporal_gap(sorted_events)

    payload, cluster_event_map = _build_cluster_payload(thread_map, thread_clusters)

    if not payload:
        return []

    cluster_json = json.dumps(payload, default=str)
    logger.info("Categorizing %d clusters across %d threads", len(payload), len(thread_clusters))

    try:
        llm_result = call_llm(
            CATEGORIZER_SYSTEM,
            build_categorizer_prompt(cluster_json),
            max_tokens=2048,
            parse_json=True,
        )
    except Exception:
        logger.exception("LLM categorization failed, using fallback names")
        llm_result = []

    name_map: dict[str, dict] = {}
    if isinstance(llm_result, list):
        for item in llm_result:
            cid = item.get("cluster_id", "")
            if cid:
                name_map[cid] = item

    subtopics: list[dict] = []
    for thread_id, clusters in thread_clusters.items():
        thread_name = thread_map.get(thread_id, {}).get("name", thread_id)
        for ci, cluster in enumerate(clusters):
            cluster_id = f"{thread_id}_c{ci}"
            event_ids = cluster_event_map.get(cluster_id, [])
            dates = [e.get("date", "") for e in cluster if e.get("date")]

            llm_info = name_map.get(cluster_id, {})
            name = llm_info.get("name", f"{thread_name} - Period {ci + 1}")
            description = llm_info.get("description", "")

            subtopics.append({
                "id": str(uuid.uuid4()),
                "thread_id": thread_id,
                "name": name,
                "description": description,
                "event_ids": event_ids,
                "date_range": {
                    "start": dates[0] if dates else "",
                    "end": dates[-1] if dates else "",
                },
                "order": ci,
            })

    logger.info("Generated %d subtopics", len(subtopics))
    return subtopics
