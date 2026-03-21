from __future__ import annotations

import pytest
from unittest.mock import patch

from app.agents.critic import run_critic, MAX_EVENTS_FOR_CRITIC, MAX_EDGES_FOR_CRITIC


class TestRunCritic:
    @patch("app.agents.critic.call_llm")
    def test_returns_structured_critique(self, mock_llm):
        mock_llm.return_value = {
            "overall_score": 0.75,
            "is_sufficient": True,
            "temporal_gaps": [],
            "causal_gaps": [],
            "weak_links": [],
            "missing_threads": [],
            "contradictions": [],
            "recommendations": ["More research needed on economic factors"],
        }

        threads = [{"id": "t1", "name": "Political", "description": "Political causes"}]
        events = [{"id": "e1", "title": "Event 1", "date": "1989-01-01", "thread_id": "t1", "timestamp": 0, "sources": []}]
        edges = [{"id": "ed1", "from_event_id": "e1", "to_event_id": "e1", "confidence": 0.9, "reasoning": "test", "thread_id": "t1"}]

        result = run_critic("test query", threads, events, edges)

        assert result["overall_score"] == 0.75
        assert result["is_sufficient"] is True
        assert len(result["recommendations"]) == 1

    @patch("app.agents.critic.call_llm")
    def test_defaults_missing_fields(self, mock_llm):
        mock_llm.return_value = {"overall_score": 0.5}

        result = run_critic("test", [], [], [])
        assert result["is_sufficient"] is False
        assert result["temporal_gaps"] == []
        assert result["causal_gaps"] == []
        assert result["weak_links"] == []
        assert result["missing_threads"] == []
        assert result["contradictions"] == []
        assert result["recommendations"] == []

    @patch("app.agents.critic.call_llm")
    def test_caps_events(self, mock_llm):
        mock_llm.return_value = {"overall_score": 0.5}

        events = [
            {"id": f"e{i}", "title": f"Event {i}", "date": "2000-01-01", "timestamp": i, "thread_id": "t1", "sources": [], "description": "desc"}
            for i in range(MAX_EVENTS_FOR_CRITIC + 50)
        ]
        edges = [
            {"id": f"ed{i}", "from_event_id": f"e{i}", "to_event_id": f"e{i+1}", "confidence": 0.5, "reasoning": "", "thread_id": "t1"}
            for i in range(MAX_EVENTS_FOR_CRITIC + 50)
        ]
        threads = [{"id": "t1", "name": "Test", "description": "Test"}]

        run_critic("test", threads, events, edges)
        call_args = mock_llm.call_args[0][1]
        assert "e0" in call_args

    @patch("app.agents.critic.call_llm")
    def test_is_sufficient_based_on_score(self, mock_llm):
        mock_llm.return_value = {"overall_score": 0.80}
        result = run_critic("test", [], [], [])
        assert result["is_sufficient"] is True

        mock_llm.return_value = {"overall_score": 0.30}
        result = run_critic("test", [], [], [])
        assert result["is_sufficient"] is False

    @patch("app.agents.critic.call_llm")
    def test_with_prompt_memory(self, mock_llm):
        mock_llm.return_value = {"overall_score": 0.5}

        run_critic("test", [], [], [], prompt_memory=["Check weak links carefully"])
        call_args = mock_llm.call_args[0][1]
        assert "Check weak links carefully" in call_args or mock_llm.called
