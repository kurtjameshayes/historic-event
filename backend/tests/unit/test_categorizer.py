from __future__ import annotations

import pytest
from unittest.mock import patch

from app.agents.categorizer import (
    categorize_events,
    _cluster_by_temporal_gap,
    _split_evenly,
    _enforce_size_limits,
    MIN_CLUSTER_SIZE,
    MAX_CLUSTER_SIZE,
)


class TestClusterByTemporalGap:
    def test_small_list_returns_single_cluster(self):
        events = [{"timestamp": i * 1000} for i in range(3)]
        result = _cluster_by_temporal_gap(events)
        assert len(result) == 1
        assert len(result[0]) == 3

    def test_empty_list(self):
        assert _cluster_by_temporal_gap([]) == []

    def test_large_list_with_gaps(self):
        events = (
            [{"timestamp": i * 100} for i in range(5)]
            + [{"timestamp": 100000 + i * 100} for i in range(5)]
        )
        result = _cluster_by_temporal_gap(events)
        assert len(result) >= 2

    def test_uniform_timestamps(self):
        events = [{"timestamp": 0} for _ in range(12)]
        result = _cluster_by_temporal_gap(events)
        assert all(len(c) <= MAX_CLUSTER_SIZE for c in result)


class TestSplitEvenly:
    def test_small_list(self):
        events = [{"timestamp": i} for i in range(3)]
        result = _split_evenly(events)
        assert sum(len(c) for c in result) == 3

    def test_respects_cluster_size(self):
        events = [{"timestamp": i} for i in range(20)]
        result = _split_evenly(events)
        for cluster in result:
            assert len(cluster) <= MAX_CLUSTER_SIZE

    def test_merges_tiny_trailing_cluster(self):
        events = [{"timestamp": i} for i in range(7)]
        result = _split_evenly(events)
        for cluster in result:
            assert len(cluster) >= MIN_CLUSTER_SIZE


class TestEnforceSizeLimits:
    def test_merges_small_clusters(self):
        clusters = [[{"x": 1}], [{"x": 2}, {"x": 3}]]
        result = _enforce_size_limits(clusters)
        total_items = sum(len(c) for c in result)
        assert total_items == 3
        assert len(result) <= 2

    def test_splits_oversized_clusters(self):
        big_cluster = [{"x": i} for i in range(15)]
        result = _enforce_size_limits([big_cluster])
        assert all(len(c) <= MAX_CLUSTER_SIZE for c in result)


class TestCategorizeEvents:
    def test_empty_events(self):
        assert categorize_events([], []) == []

    @patch("app.agents.categorizer.call_llm")
    def test_returns_subtopics(self, mock_llm):
        mock_llm.return_value = [
            {"cluster_id": "t1_c0", "name": "Early Events", "description": "The beginning"}
        ]

        threads = [{"id": "t1", "name": "Political"}]
        events = [
            {"id": "e1", "thread_id": "t1", "timestamp": 1000, "title": "Event 1", "date": "1989-01-01"},
            {"id": "e2", "thread_id": "t1", "timestamp": 2000, "title": "Event 2", "date": "1989-06-01"},
            {"id": "e3", "thread_id": "t1", "timestamp": 3000, "title": "Event 3", "date": "1989-11-01"},
        ]

        result = categorize_events(threads, events)
        assert len(result) >= 1
        assert result[0]["thread_id"] == "t1"
        assert "name" in result[0]
        assert "event_ids" in result[0]
        assert "date_range" in result[0]

    @patch("app.agents.categorizer.call_llm")
    def test_fallback_on_llm_failure(self, mock_llm):
        mock_llm.side_effect = Exception("LLM failed")

        threads = [{"id": "t1", "name": "Political"}]
        events = [
            {"id": "e1", "thread_id": "t1", "timestamp": 1000, "title": "Ev1", "date": "1989-01-01"},
            {"id": "e2", "thread_id": "t1", "timestamp": 2000, "title": "Ev2", "date": "1989-06-01"},
        ]

        result = categorize_events(threads, events)
        assert len(result) >= 1
        assert "Political" in result[0]["name"]

    @patch("app.agents.categorizer.call_llm")
    def test_multiple_threads(self, mock_llm):
        mock_llm.return_value = []

        threads = [{"id": "t1", "name": "Political"}, {"id": "t2", "name": "Economic"}]
        events = [
            {"id": "e1", "thread_id": "t1", "timestamp": 1000, "title": "Ev1", "date": "1989-01-01"},
            {"id": "e2", "thread_id": "t1", "timestamp": 2000, "title": "Ev2", "date": "1989-06-01"},
            {"id": "e3", "thread_id": "t2", "timestamp": 1500, "title": "Ev3", "date": "1989-03-01"},
            {"id": "e4", "thread_id": "t2", "timestamp": 2500, "title": "Ev4", "date": "1989-08-01"},
        ]

        result = categorize_events(threads, events)
        thread_ids = {st["thread_id"] for st in result}
        assert "t1" in thread_ids
        assert "t2" in thread_ids

    @patch("app.agents.categorizer.call_llm")
    def test_subtopic_has_required_fields(self, mock_llm):
        mock_llm.return_value = []

        threads = [{"id": "t1", "name": "Test"}]
        events = [
            {"id": "e1", "thread_id": "t1", "timestamp": 1000, "title": "Ev1", "date": "1989-01-01"},
            {"id": "e2", "thread_id": "t1", "timestamp": 2000, "title": "Ev2", "date": "1989-06-01"},
        ]

        result = categorize_events(threads, events)
        for st in result:
            assert "id" in st
            assert "thread_id" in st
            assert "name" in st
            assert "description" in st
            assert "event_ids" in st
            assert "date_range" in st
            assert "order" in st
