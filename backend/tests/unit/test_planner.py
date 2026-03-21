from __future__ import annotations

import pytest
from unittest.mock import patch

from app.agents.planner import run_planner, THREAD_COLORS


class TestRunPlanner:
    @patch("app.agents.planner.call_llm")
    def test_returns_plan_with_threads(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Fall of Berlin Wall", "approximate_date": "1989-11-09"},
            "causal_threads": [
                {"id": "t-pol", "name": "Political", "description": "Political factors", "priority": 5, "search_queries": ["Gorbachev reforms"]},
                {"id": "t-eco", "name": "Economic", "description": "Economic factors", "priority": 3, "search_queries": ["GDR economy"]},
            ],
        }

        result = run_planner("What caused the Fall of the Berlin Wall?")
        assert result["target_event"]["name"] == "Fall of Berlin Wall"
        assert len(result["causal_threads"]) == 2

    @patch("app.agents.planner.call_llm")
    def test_assigns_colors(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [
                {"id": "t1", "name": "Thread 1"},
                {"id": "t2", "name": "Thread 2"},
            ],
        }

        result = run_planner("test query")
        for thread in result["causal_threads"]:
            assert "color" in thread
            assert thread["color"] in THREAD_COLORS

    @patch("app.agents.planner.call_llm")
    def test_assigns_pending_status(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [{"id": "t1", "name": "Thread 1"}],
        }

        result = run_planner("test query")
        assert result["causal_threads"][0]["status"] == "pending"

    @patch("app.agents.planner.call_llm")
    def test_preserves_existing_color(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [
                {"id": "t1", "name": "Thread 1", "color": "custom-color"},
            ],
        }

        result = run_planner("test query")
        assert result["causal_threads"][0]["color"] == "custom-color"

    @patch("app.agents.planner.call_llm")
    def test_with_critique_feedback(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [{"id": "t1", "name": "New Thread"}],
        }
        critique = {
            "missing_threads": [{"suggested_name": "Social", "rationale": "Missing social dimension"}],
            "recommendations": ["Add a social thread"],
        }

        result = run_planner("test query", critique=critique)
        mock_llm.assert_called_once()
        call_args = mock_llm.call_args
        assert "CRITIC FEEDBACK" in call_args[0][1]

    @patch("app.agents.planner.call_llm")
    def test_with_prompt_memory(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [],
        }

        run_planner("test query", prompt_memory=["Remember to add economic thread"])
        call_args = mock_llm.call_args
        assert "PROMPT GUIDANCE" in call_args[0][1]

    @patch("app.agents.planner.call_llm")
    def test_handles_empty_threads(self, mock_llm):
        mock_llm.return_value = {
            "target_event": {"name": "Test"},
            "causal_threads": [],
        }

        result = run_planner("test query")
        assert result["causal_threads"] == []
