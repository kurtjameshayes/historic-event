from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock, call

from app.agents.researcher import (
    research_thread,
    _similarity,
    _deduplicate_events,
    _parse_date_to_timestamp,
    _score_source_relevance,
)


class TestSimilarity:
    def test_identical_strings(self):
        assert _similarity("hello", "hello") == 1.0

    def test_completely_different(self):
        assert _similarity("abc", "xyz") < 0.5

    def test_case_insensitive(self):
        assert _similarity("Hello", "hello") == 1.0

    def test_similar_strings(self):
        score = _similarity("Fall of Berlin Wall", "Fall of the Berlin Wall")
        assert score > 0.8


class TestDeduplicateEvents:
    def test_no_duplicates(self):
        events = [
            {"title": "Gorbachev Becomes General Secretary", "date": "1985-03-01"},
            {"title": "Hungary Opens Border with Austria", "date": "1989-05-02"},
        ]
        result = _deduplicate_events(events)
        assert len(result) == 2

    def test_merges_duplicates(self):
        events = [
            {"title": "Fall of Berlin Wall", "date": "1989-11-09", "sources": [{"url": "src1"}]},
            {"title": "Fall of the Berlin Wall", "date": "1989-11-09", "sources": [{"url": "src2"}]},
        ]
        result = _deduplicate_events(events)
        assert len(result) == 1
        assert len(result[0]["sources"]) == 2

    def test_keeps_different_dates(self):
        events = [
            {"title": "Similar Event", "date": "1989-01-01"},
            {"title": "Similar Event", "date": "2000-01-01"},
        ]
        result = _deduplicate_events(events)
        assert len(result) == 2

    def test_empty_list(self):
        assert _deduplicate_events([]) == []


class TestParseDateToTimestamp:
    def test_iso_date(self):
        ts = _parse_date_to_timestamp("1989-11-09")
        assert ts > 0

    def test_year_month(self):
        ts = _parse_date_to_timestamp("1989-11")
        assert ts > 0

    def test_year_only(self):
        ts = _parse_date_to_timestamp("1989")
        assert ts > 0

    def test_decade(self):
        ts = _parse_date_to_timestamp("1980s")
        assert ts > 0

    def test_invalid_date(self):
        ts = _parse_date_to_timestamp("not a date")
        assert ts == 0

    def test_empty_string(self):
        assert _parse_date_to_timestamp("") == 0

    def test_ordering(self):
        ts1 = _parse_date_to_timestamp("1985-01-01")
        ts2 = _parse_date_to_timestamp("1989-11-09")
        assert ts1 < ts2


class TestScoreSourceRelevance:
    def test_relevant_source(self):
        source = {"title": "Berlin Wall History", "content": "The Berlin Wall was a barrier...", "raw_content": "The Berlin Wall was a barrier that divided Berlin..."}
        score = _score_source_relevance(source, "Political", "Political factors around Berlin Wall", ["Berlin Wall political causes"])
        assert 0.0 <= score <= 1.0

    def test_irrelevant_source(self):
        source = {"title": "Cooking recipes", "content": "How to make pasta", "raw_content": "Boil water..."}
        score = _score_source_relevance(source, "Political", "Political factors", ["Berlin Wall causes"])
        assert score < 0.5

    def test_empty_source(self):
        source = {"title": "", "content": ""}
        score = _score_source_relevance(source, "Test", "Test desc", [])
        assert score >= 0.0


class TestResearchThread:
    @patch("app.agents.researcher.call_llm")
    @patch("app.agents.researcher.search_combined")
    def test_returns_events_and_edges(self, mock_search, mock_llm):
        mock_search.return_value = [
            {"url": "http://ex.com", "title": "Source 1", "content": "Content about history", "raw_content": "Content about history of events" * 50},
        ]
        mock_llm.return_value = {
            "events": [
                {"title": "Gorbachev Rises to Power", "date": "1985-03-01", "description": "Leadership change"},
                {"title": "Hungary Opens Border Fence", "date": "1989-05-02", "description": "Border opening"},
            ],
            "causal_edges": [
                {"from_event_title": "Gorbachev Rises to Power", "to_event_title": "Hungary Opens Border Fence", "reasoning": "Reform emboldened Hungary", "extraction_confidence": 0.8},
            ],
        }

        thread = {"id": "t1", "name": "Political", "description": "Political factors", "search_queries": ["political causes"]}
        result = research_thread(thread)

        assert len(result["events"]) == 2
        assert len(result["causal_edges"]) == 1
        assert result["thread_id"] == "t1"

    @patch("app.agents.researcher.call_llm")
    @patch("app.agents.researcher.search_combined")
    def test_assigns_thread_id_to_events(self, mock_search, mock_llm):
        mock_search.return_value = [
            {"url": "http://ex.com", "title": "Src", "content": "x" * 200, "raw_content": "x" * 200},
        ]
        mock_llm.return_value = {
            "events": [{"title": "Ev", "date": "1989-01-01", "description": "Desc"}],
            "causal_edges": [],
        }

        thread = {"id": "t-test", "name": "Test", "search_queries": ["test"]}
        result = research_thread(thread)
        assert result["events"][0]["thread_id"] == "t-test"

    @patch("app.agents.researcher.call_llm")
    @patch("app.agents.researcher.search_combined")
    def test_no_search_results(self, mock_search, mock_llm):
        mock_search.return_value = []

        thread = {"id": "t1", "name": "Test", "search_queries": ["noresults"]}
        result = research_thread(thread)
        assert result["events"] == []
        assert result["causal_edges"] == []
        mock_llm.assert_not_called()

    @patch("app.agents.researcher.call_llm")
    @patch("app.agents.researcher.search_combined")
    def test_calls_progress_callback(self, mock_search, mock_llm):
        mock_search.return_value = [
            {"url": "http://ex.com", "title": "Src", "content": "x" * 200, "raw_content": "x" * 200},
        ]
        mock_llm.return_value = {"events": [], "causal_edges": []}

        progress_calls = []
        thread = {"id": "t1", "name": "Test", "search_queries": ["test"]}
        research_thread(thread, on_progress=lambda idx, total, title: progress_calls.append((idx, total)))

        assert len(progress_calls) == 1
        assert progress_calls[0] == (1, 1)

    @patch("app.agents.researcher.call_llm")
    @patch("app.agents.researcher.search_combined")
    def test_respects_max_sources(self, mock_search, mock_llm):
        mock_search.return_value = [
            {"url": f"http://ex{i}.com", "title": f"Src {i}", "content": "x" * 200, "raw_content": "x" * 200}
            for i in range(10)
        ]
        mock_llm.return_value = {"events": [], "causal_edges": []}

        thread = {"id": "t1", "name": "Test", "search_queries": ["test"]}
        research_thread(thread, max_sources=2)
        assert mock_llm.call_count == 2

    @patch("app.agents.researcher.call_llm")
    @patch("app.agents.researcher.search_combined")
    def test_handles_llm_failure_gracefully(self, mock_search, mock_llm):
        mock_search.return_value = [
            {"url": "http://ex.com", "title": "Src", "content": "x" * 200, "raw_content": "x" * 200},
        ]
        mock_llm.side_effect = Exception("LLM error")

        thread = {"id": "t1", "name": "Test", "search_queries": ["test"]}
        result = research_thread(thread)
        assert result["events"] == []
