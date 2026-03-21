from __future__ import annotations

import pytest
from app.services.prompt_memory import (
    build_query_scope_key,
    distill_prompt_memory_entries,
    collapse_prompt_memory,
    GLOBAL_PROMPT_MEMORY_SCOPE,
    PROMPT_MEMORY_LIMITS,
)


class TestBuildQueryScopeKey:
    def test_returns_prefixed_hash(self):
        key = build_query_scope_key("What caused WW2?")
        assert key.startswith("query:")
        assert len(key) > len("query:")

    def test_normalization(self):
        k1 = build_query_scope_key("  What  caused   WW2?  ")
        k2 = build_query_scope_key("what caused ww2?")
        assert k1 == k2

    def test_different_queries_different_keys(self):
        k1 = build_query_scope_key("What caused WW2?")
        k2 = build_query_scope_key("What caused the French Revolution?")
        assert k1 != k2

    def test_empty_query(self):
        key = build_query_scope_key("")
        assert key.startswith("query:")


class TestDistillPromptMemoryEntries:
    def test_empty_critique(self):
        result = distill_prompt_memory_entries("query", {})
        assert result == []

    def test_missing_threads(self):
        critique = {
            "missing_threads": [
                {
                    "suggested_name": "Economic",
                    "rationale": "Economic factors missing",
                    "search_queries": ["economic causes"],
                }
            ]
        }
        entries = distill_prompt_memory_entries("test query", critique)
        assert len(entries) > 0
        targets = {e["target"] for e in entries}
        assert "planner" in targets

    def test_temporal_gaps(self):
        critique = {
            "temporal_gaps": [
                {"thread_id": "t1", "start_date": "1900", "end_date": "1910", "severity": "high"}
            ]
        }
        entries = distill_prompt_memory_entries("test query", critique)
        assert len(entries) > 0
        categories = {e["category"] for e in entries}
        assert "temporal_gaps" in categories or "temporal_gap_detail" in categories

    def test_weak_links(self):
        critique = {
            "weak_links": [
                {"edge_id": "e1", "reason": "insufficient evidence", "current_confidence": 0.3}
            ]
        }
        entries = distill_prompt_memory_entries("test query", critique)
        assert len(entries) > 0

    def test_contradictions(self):
        critique = {
            "contradictions": [
                {
                    "event_ids": ["e1", "e2"],
                    "description": "sources disagree",
                    "resolution_suggestion": "check primary sources",
                }
            ]
        }
        entries = distill_prompt_memory_entries("test query", critique)
        assert len(entries) > 0

    def test_recommendations(self):
        critique = {"recommendations": ["Do more research on X", "Check source Y"]}
        entries = distill_prompt_memory_entries("test query", critique)
        assert any(e["category"] == "recommendation" for e in entries)

    def test_deduplication(self):
        critique = {
            "recommendations": ["same recommendation", "same recommendation"]
        }
        entries = distill_prompt_memory_entries("test query", critique)
        keys = [(e["scope_key"], e["target"], e["category"], e["text"]) for e in entries if e["category"] == "recommendation"]
        assert len(keys) == len(set(keys))

    def test_combined_critique(self):
        critique = {
            "missing_threads": [{"suggested_name": "Social", "rationale": "missing", "search_queries": []}],
            "temporal_gaps": [{"thread_id": "t1", "start_date": "1900", "end_date": "1910", "severity": "low"}],
            "weak_links": [{"edge_id": "e1", "reason": "weak", "current_confidence": 0.2}],
            "recommendations": ["investigate further"],
        }
        entries = distill_prompt_memory_entries("test query", critique)
        assert len(entries) > 3


class TestCollapsePromptMemory:
    def test_empty(self):
        assert collapse_prompt_memory([], "planner") == []

    def test_respects_limit(self):
        entries = [{"text": f"Entry {i}"} for i in range(20)]
        result = collapse_prompt_memory(entries, "planner")
        assert len(result) <= PROMPT_MEMORY_LIMITS["planner"]

    def test_deduplicates(self):
        entries = [{"text": "same text"}, {"text": "same text"}, {"text": "different"}]
        result = collapse_prompt_memory(entries, "planner")
        assert len(result) == 2

    def test_skips_empty_text(self):
        entries = [{"text": ""}, {"text": "   "}, {"text": "valid"}]
        result = collapse_prompt_memory(entries, "researcher")
        assert result == ["valid"]

    def test_normalizes_whitespace(self):
        entries = [{"text": "  some   spaced   text  "}]
        result = collapse_prompt_memory(entries, "critic")
        assert result == ["some spaced text"]
