from __future__ import annotations

import hashlib

GLOBAL_PROMPT_MEMORY_SCOPE = "global"
PROMPT_MEMORY_LIMITS = {
    "planner": 8,
    "researcher": 6,
    "critic": 8,
}


def build_query_scope_key(query: str) -> str:
    normalized = " ".join((query or "").lower().split())
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"query:{digest}"


def _append_entries(
    entries: list[dict],
    *,
    scope_key: str,
    targets: tuple[str, ...],
    category: str,
    text: str,
    metadata: dict | None = None,
):
    compact_text = " ".join((text or "").split())
    if not compact_text:
        return

    for target in targets:
        entries.append({
            "scope_key": scope_key,
            "target": target,
            "category": category,
            "text": compact_text,
            "metadata": metadata or {},
        })


def distill_prompt_memory_entries(query: str, critique: dict) -> list[dict]:
    query_scope = build_query_scope_key(query)
    entries: list[dict] = []

    if critique.get("missing_threads"):
        _append_entries(
            entries,
            scope_key=GLOBAL_PROMPT_MEMORY_SCOPE,
            targets=("planner",),
            category="missing_threads",
            text="When the review identifies a missing causal dimension, create a dedicated thread for it instead of overloading an existing thread.",
        )
        for mt in critique["missing_threads"][:5]:
            suggested_queries = ", ".join(mt.get("search_queries", [])[:3])
            suggestion = f"Add or preserve a thread for '{mt.get('suggested_name', 'missing dimension')}'. {mt.get('rationale', '').strip()}"
            if suggested_queries:
                suggestion += f" Suggested searches: {suggested_queries}."
            _append_entries(
                entries,
                scope_key=query_scope,
                targets=("planner",),
                category="missing_thread_suggestion",
                text=suggestion,
                metadata={"thread_name": mt.get("suggested_name", "")},
            )

    if critique.get("temporal_gaps"):
        _append_entries(
            entries,
            scope_key=GLOBAL_PROMPT_MEMORY_SCOPE,
            targets=("planner", "researcher", "critic"),
            category="temporal_gaps",
            text="Treat long timeline gaps as a signal to refine search coverage before declaring the investigation complete.",
        )
        for gap in critique["temporal_gaps"][:5]:
            _append_entries(
                entries,
                scope_key=query_scope,
                targets=("planner", "researcher", "critic"),
                category="temporal_gap_detail",
                text=(
                    f"Review the chronology for thread {gap.get('thread_id', '?')} and fill the gap from "
                    f"{gap.get('start_date', '?')} to {gap.get('end_date', '?')} "
                    f"(severity: {gap.get('severity', '?')})."
                ),
                metadata={"thread_id": gap.get("thread_id", "")},
            )

    if critique.get("weak_links"):
        _append_entries(
            entries,
            scope_key=GLOBAL_PROMPT_MEMORY_SCOPE,
            targets=("researcher", "critic"),
            category="weak_links",
            text="Re-check weak causal links with corroborating sources before treating them as reliable edges.",
        )
        for weak_link in critique["weak_links"][:5]:
            _append_entries(
                entries,
                scope_key=query_scope,
                targets=("researcher", "critic"),
                category="weak_link_detail",
                text=(
                    f"Revisit weak causal link {weak_link.get('edge_id', '?')} because "
                    f"{weak_link.get('reason', 'its support is thin')} "
                    f"(confidence: {weak_link.get('current_confidence', '?')})."
                ),
                metadata={"edge_id": weak_link.get("edge_id", "")},
            )

    if critique.get("contradictions"):
        _append_entries(
            entries,
            scope_key=GLOBAL_PROMPT_MEMORY_SCOPE,
            targets=("researcher", "critic"),
            category="contradictions",
            text="When sources disagree on causation, preserve the disagreement explicitly and seek evidence that clarifies the conflict.",
        )
        for contradiction in critique["contradictions"][:5]:
            _append_entries(
                entries,
                scope_key=query_scope,
                targets=("researcher", "critic"),
                category="contradiction_detail",
                text=(
                    f"Track the contradiction involving events {', '.join(contradiction.get('event_ids', [])[:4]) or '?'}: "
                    f"{contradiction.get('description', 'sources disagree')}. "
                    f"Suggested resolution: {contradiction.get('resolution_suggestion', 'seek clearer evidence')}."
                ),
            )

    for recommendation in critique.get("recommendations", [])[:6]:
        _append_entries(
            entries,
            scope_key=query_scope,
            targets=("planner", "researcher", "critic"),
            category="recommendation",
            text=recommendation,
        )

    deduped: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()
    for entry in entries:
        key = (
            entry["scope_key"],
            entry["target"],
            entry["category"],
            entry["text"],
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)

    return deduped


def collapse_prompt_memory(entries: list[dict], target: str) -> list[str]:
    limit = PROMPT_MEMORY_LIMITS.get(target, 6)
    selected: list[str] = []
    seen: set[str] = set()

    for entry in entries:
        text = " ".join((entry.get("text") or "").split())
        if not text or text in seen:
            continue
        seen.add(text)
        selected.append(text)
        if len(selected) >= limit:
            break

    return selected
