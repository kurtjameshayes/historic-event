from __future__ import annotations

"""
Confidence scoring (Design Doc Section 8) and coverage threshold (Section 9).
"""
import statistics


QUALITY_SCORES = {
    "primary": 1.0,
    "academic": 1.0,
    "secondary": 0.7,
    "tertiary": 0.4,
    "opinion": 0.2,
}

# Confidence scoring weights (Section 8)
W_SOURCE_COUNT = 0.25
W_SOURCE_QUALITY = 0.30
W_AGREEMENT = 0.25
W_EXTRACTION = 0.20

# Coverage threshold weights (Section 9)
W_THREAD_COV = 0.30
W_TEMPORAL_COV = 0.25
W_EDGE_CONF = 0.25
W_BALANCE = 0.20


def source_count_score(count: int) -> float:
    if count >= 3:
        return 1.0
    if count == 2:
        return 0.6
    if count == 1:
        return 0.3
    return 0.0


def source_quality_score(sources: list[dict]) -> float:
    if not sources:
        return 0.0
    scores = [QUALITY_SCORES.get(s.get("quality", "tertiary"), 0.4) for s in sources]
    return sum(scores) / len(scores)


def compute_confidence(
    sources: list[dict],
    agreement: float = 1.0,
    extraction_confidence: float = 0.8,
) -> float:
    """Compute composite confidence score for a causal edge."""
    sc = source_count_score(len(sources))
    sq = source_quality_score(sources)
    return (
        W_SOURCE_COUNT * sc
        + W_SOURCE_QUALITY * sq
        + W_AGREEMENT * agreement
        + W_EXTRACTION * extraction_confidence
    )


def compute_coverage(
    threads: list[dict],
    events: list[dict],
    edges: list[dict],
    total_timespan_years: float | None = None,
) -> float:
    """Compute overall coverage score (Section 9). Returns 0.0-1.0."""
    if not threads:
        return 0.0

    # Thread coverage: proportion of threads with >= 3 events and >= 2 edges
    thread_scores = []
    for t in threads:
        tid = t["id"]
        t_events = [e for e in events if e.get("thread_id") == tid]
        t_edges = [ed for ed in edges if ed.get("thread_id") == tid]
        thread_scores.append(1.0 if len(t_events) >= 3 and len(t_edges) >= 2 else 0.0)
    thread_cov = sum(thread_scores) / len(thread_scores) if thread_scores else 0.0

    # Temporal coverage (simplified): check for large gaps per thread
    temporal_cov = 1.0
    if total_timespan_years and total_timespan_years > 0:
        max_gap_ratio = 0.2
        gap_penalties = 0
        total_checks = 0
        for t in threads:
            tid = t["id"]
            t_events = sorted(
                [e for e in events if e.get("thread_id") == tid],
                key=lambda e: e.get("timestamp", 0),
            )
            if len(t_events) < 2:
                gap_penalties += 1
                total_checks += 1
                continue
            for i in range(1, len(t_events)):
                total_checks += 1
                ts_diff = t_events[i].get("timestamp", 0) - t_events[i - 1].get("timestamp", 0)
                gap_years = ts_diff / (365.25 * 24 * 3600 * 1000) if ts_diff > 0 else 0
                if gap_years / total_timespan_years > max_gap_ratio:
                    gap_penalties += 1
        temporal_cov = 1.0 - (gap_penalties / total_checks) if total_checks > 0 else 0.5

    # Edge confidence: mean confidence across all edges
    confidences = [ed.get("confidence", 0.5) for ed in edges]
    edge_conf = sum(confidences) / len(confidences) if confidences else 0.0

    # Balance: inverse of coefficient of variation of events per thread
    events_per_thread = []
    for t in threads:
        count = len([e for e in events if e.get("thread_id") == t["id"]])
        events_per_thread.append(count)
    if len(events_per_thread) >= 2 and sum(events_per_thread) > 0:
        mean_ept = statistics.mean(events_per_thread)
        stdev_ept = statistics.stdev(events_per_thread)
        cv = stdev_ept / mean_ept if mean_ept > 0 else 1.0
        balance = max(0.0, 1.0 - cv)
    else:
        balance = 0.5

    return (
        W_THREAD_COV * thread_cov
        + W_TEMPORAL_COV * temporal_cov
        + W_EDGE_CONF * edge_conf
        + W_BALANCE * balance
    )
