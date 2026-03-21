from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock
from queue import Queue

from app.orchestrator import (
    Orchestrator,
    register_sse_queue,
    unregister_sse_queue,
    _emit,
    start_orchestrator,
)
from app.models import create_session, get_session


class TestSSEQueueManagement:
    def test_register_and_unregister(self):
        q = register_sse_queue("test-session-1")
        assert isinstance(q, Queue)
        unregister_sse_queue("test-session-1", q)

    def test_emit_to_queue(self):
        q = register_sse_queue("test-session-2")
        _emit("test-session-2", "phase_change", {"phase": "PLAN"})
        payload = q.get_nowait()
        assert payload["event"] == "phase_change"
        assert payload["data"]["phase"] == "PLAN"
        unregister_sse_queue("test-session-2", q)

    def test_emit_to_multiple_queues(self):
        q1 = register_sse_queue("test-session-3")
        q2 = register_sse_queue("test-session-3")
        _emit("test-session-3", "reasoning", {"message": "test"})
        assert not q1.empty()
        assert not q2.empty()
        unregister_sse_queue("test-session-3", q1)
        unregister_sse_queue("test-session-3", q2)

    def test_unregister_nonexistent_queue(self):
        q = Queue()
        unregister_sse_queue("nonexistent", q)


class TestOrchestrator:
    @patch("app.orchestrator.generate_narrative")
    @patch("app.orchestrator.categorize_events")
    @patch("app.orchestrator.run_critic")
    @patch("app.orchestrator.research_thread")
    @patch("app.orchestrator.run_planner")
    def test_full_loop_completes(
        self, mock_planner, mock_researcher, mock_critic, mock_categorizer, mock_narrative, mock_db
    ):
        session_id, _ = create_session(mock_db, "What caused WW2?", {
            "max_cycles": 1, "max_depth": 1, "max_sources_per_thread": 3, "max_threads": 3, "coverage_threshold": 0.5,
        })

        mock_planner.return_value = {
            "target_event": {"name": "World War 2", "approximate_date": "1939"},
            "causal_threads": [
                {"id": "t1", "name": "Political", "description": "Political causes", "priority": 5, "search_queries": ["ww2 political causes"]},
            ],
        }
        mock_researcher.return_value = {
            "thread_id": "t1",
            "events": [
                {"id": "e1", "title": "Treaty of Versailles", "date": "1919-06-28", "timestamp": 0, "description": "Peace treaty", "thread_id": "t1", "sources": []},
            ],
            "causal_edges": [],
            "raw_sources": [{"url": "http://example.com", "title": "Source"}],
        }
        mock_critic.return_value = {
            "overall_score": 0.8, "is_sufficient": True,
            "temporal_gaps": [], "causal_gaps": [], "weak_links": [],
            "missing_threads": [], "contradictions": [], "recommendations": [],
        }
        mock_categorizer.return_value = []
        mock_narrative.return_value = "WW2 was caused by..."

        orch = Orchestrator(session_id, "What caused WW2?", {
            "max_cycles": 1, "max_depth": 1, "max_sources_per_thread": 3, "max_threads": 3, "coverage_threshold": 0.5,
        }, mock_db)
        orch.run()

        session = get_session(mock_db, session_id)
        assert session["status"] == "COMPLETE"
        assert session["narrative"] == "WW2 was caused by..."
        mock_planner.assert_called_once()
        mock_researcher.assert_called_once()
        mock_critic.assert_called_once()

    @patch("app.orchestrator.generate_narrative")
    @patch("app.orchestrator.categorize_events")
    @patch("app.orchestrator.run_critic")
    @patch("app.orchestrator.research_thread")
    @patch("app.orchestrator.run_planner")
    def test_loops_until_coverage_met(
        self, mock_planner, mock_researcher, mock_critic, mock_categorizer, mock_narrative, mock_db
    ):
        session_id, _ = create_session(mock_db, "Test", {
            "max_cycles": 3, "max_depth": 1, "max_sources_per_thread": 3, "max_threads": 3, "coverage_threshold": 0.8,
        })

        mock_planner.return_value = {
            "target_event": {"name": "Test Event"},
            "causal_threads": [{"id": "t1", "name": "Thread 1", "priority": 5, "search_queries": ["q1"]}],
        }
        mock_researcher.return_value = {
            "thread_id": "t1", "events": [], "causal_edges": [], "raw_sources": [],
        }
        mock_critic.side_effect = [
            {"overall_score": 0.3, "is_sufficient": False, "temporal_gaps": [], "causal_gaps": [], "weak_links": [], "missing_threads": [], "contradictions": [], "recommendations": ["more research"]},
            {"overall_score": 0.9, "is_sufficient": True, "temporal_gaps": [], "causal_gaps": [], "weak_links": [], "missing_threads": [], "contradictions": [], "recommendations": []},
        ]
        mock_categorizer.return_value = []
        mock_narrative.return_value = "narrative"

        orch = Orchestrator(session_id, "Test", {
            "max_cycles": 3, "max_depth": 1, "max_sources_per_thread": 3, "max_threads": 3, "coverage_threshold": 0.8,
        }, mock_db)
        orch.run()

        assert mock_planner.call_count == 2
        assert mock_critic.call_count == 2

    @patch("app.orchestrator.run_planner")
    def test_handles_planner_failure(self, mock_planner, mock_db):
        session_id, _ = create_session(mock_db, "Test", {"max_cycles": 1, "coverage_threshold": 0.5})
        mock_planner.side_effect = Exception("Planner broke")

        orch = Orchestrator(session_id, "Test", {"max_cycles": 1, "coverage_threshold": 0.5}, mock_db)
        orch.run()

        session = get_session(mock_db, session_id)
        assert session["status"] in ("ERROR", "COMPLETE")

    @patch("app.orchestrator.generate_narrative")
    @patch("app.orchestrator.categorize_events")
    @patch("app.orchestrator.run_critic")
    @patch("app.orchestrator.research_thread")
    @patch("app.orchestrator.run_planner")
    def test_emits_sse_events(
        self, mock_planner, mock_researcher, mock_critic, mock_categorizer, mock_narrative, mock_db
    ):
        session_id, _ = create_session(mock_db, "Test", {
            "max_cycles": 1, "coverage_threshold": 0.5,
        })

        q = register_sse_queue(session_id)

        mock_planner.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [{"id": "t1", "name": "Thread 1", "priority": 5, "search_queries": ["q"]}],
        }
        mock_researcher.return_value = {
            "thread_id": "t1", "events": [], "causal_edges": [], "raw_sources": [],
        }
        mock_critic.return_value = {
            "overall_score": 0.9, "is_sufficient": True,
            "temporal_gaps": [], "causal_gaps": [], "weak_links": [],
            "missing_threads": [], "contradictions": [], "recommendations": [],
        }
        mock_categorizer.return_value = []
        mock_narrative.return_value = "narrative"

        orch = Orchestrator(session_id, "Test", {
            "max_cycles": 1, "coverage_threshold": 0.5,
        }, mock_db)
        orch.run()

        events_received = []
        while not q.empty():
            events_received.append(q.get_nowait())

        event_types = [e["event"] for e in events_received]
        assert "phase_change" in event_types
        assert "complete" in event_types
        unregister_sse_queue(session_id, q)


class TestStartOrchestrator:
    @patch("app.orchestrator.Orchestrator")
    def test_returns_thread(self, mock_orch_cls, mock_db):
        mock_instance = MagicMock()
        mock_orch_cls.return_value = mock_instance

        thread = start_orchestrator("session-1", "query", {}, mock_db)
        assert thread is not None
        mock_orch_cls.assert_called_once_with("session-1", "query", {}, mock_db)
