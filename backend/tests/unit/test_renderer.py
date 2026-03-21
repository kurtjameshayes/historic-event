from __future__ import annotations

import pytest
from unittest.mock import patch

from app.agents.renderer import generate_narrative, MAX_EVENTS_FOR_NARRATIVE


class TestGenerateNarrative:
    @patch("app.agents.renderer.call_llm")
    def test_returns_narrative_string(self, mock_llm):
        mock_llm.return_value = "The fall of the Berlin Wall was a pivotal event..."

        result = generate_narrative(
            query="What caused the Fall of the Berlin Wall?",
            target_event={"name": "Fall of Berlin Wall", "date": "1989-11-09"},
            threads=[{"id": "t1", "name": "Political", "description": "Political factors"}],
            events=[{"id": "e1", "title": "Event 1", "date": "1989-01-01", "timestamp": 0, "thread_id": "t1", "description": "Desc", "is_target": False}],
            edges=[{"from_event_id": "e1", "to_event_id": "e1", "confidence": 0.9, "reasoning": "causal"}],
        )

        assert isinstance(result, str)
        assert len(result) > 0

    @patch("app.agents.renderer.call_llm")
    def test_calls_llm_with_parse_json_false(self, mock_llm):
        mock_llm.return_value = "Narrative text"

        generate_narrative("query", {}, [], [], [])
        _, kwargs = mock_llm.call_args
        assert kwargs.get("parse_json") is False

    @patch("app.agents.renderer.call_llm")
    def test_caps_events(self, mock_llm):
        mock_llm.return_value = "Narrative"

        events = [
            {"id": f"e{i}", "title": f"Event {i}", "date": "2000-01-01", "timestamp": i, "thread_id": "t1", "description": "desc"}
            for i in range(MAX_EVENTS_FOR_NARRATIVE + 50)
        ]

        generate_narrative("query", {}, [], events, [])
        mock_llm.assert_called_once()

    @patch("app.agents.renderer.call_llm")
    def test_includes_target_event_in_prompt(self, mock_llm):
        mock_llm.return_value = "Narrative"

        generate_narrative(
            "query",
            {"name": "Berlin Wall Fall", "date": "1989-11-09"},
            [], [], [],
        )
        call_args = mock_llm.call_args[0][1]
        assert "Berlin Wall Fall" in call_args
