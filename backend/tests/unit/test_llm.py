from __future__ import annotations

import json
import pytest
from unittest.mock import patch, MagicMock

from app.services.llm import call_llm, _repair_json


class TestRepairJson:
    def test_strip_markdown_fences(self):
        text = '```json\n{"key": "value"}\n```'
        assert json.loads(_repair_json(text)) == {"key": "value"}

    def test_strip_plain_fences(self):
        text = '```\n{"key": "value"}\n```'
        assert json.loads(_repair_json(text)) == {"key": "value"}

    def test_fix_trailing_commas_object(self):
        text = '{"key": "value",}'
        assert json.loads(_repair_json(text)) == {"key": "value"}

    def test_fix_trailing_commas_array(self):
        text = '["a", "b",]'
        assert json.loads(_repair_json(text)) == ["a", "b"]

    def test_already_valid_json(self):
        text = '{"key": "value"}'
        assert json.loads(_repair_json(text)) == {"key": "value"}

    def test_whitespace_stripping(self):
        text = '   {"key": "value"}   '
        assert json.loads(_repair_json(text)) == {"key": "value"}


class TestCallLlm:
    @patch("app.services.llm._get_client")
    def test_returns_parsed_json(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"result": "ok"}')]
        mock_get_client.return_value.messages.create.return_value = mock_response

        result = call_llm("system", "user")
        assert result == {"result": "ok"}

    @patch("app.services.llm._get_client")
    def test_returns_raw_string_when_parse_json_false(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="plain text response")]
        mock_get_client.return_value.messages.create.return_value = mock_response

        result = call_llm("system", "user", parse_json=False)
        assert result == "plain text response"

    @patch("app.services.llm._get_client")
    def test_repairs_json_with_fences(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='```json\n{"key": "value"}\n```')]
        mock_get_client.return_value.messages.create.return_value = mock_response

        result = call_llm("system", "user")
        assert result == {"key": "value"}

    @patch("app.services.llm._get_client")
    def test_retries_on_api_status_error(self, mock_get_client):
        import anthropic

        mock_client = mock_get_client.return_value
        error = anthropic.APIStatusError(
            message="overloaded", response=MagicMock(status_code=529), body={}
        )
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"ok": true}')]
        mock_client.messages.create.side_effect = [error, mock_response]

        with patch("app.services.llm.time.sleep"):
            result = call_llm("system", "user", retries=2)
        assert result == {"ok": True}

    @patch("app.services.llm._get_client")
    def test_raises_after_all_retries_exhausted(self, mock_get_client):
        import anthropic

        mock_client = mock_get_client.return_value
        error = anthropic.APIStatusError(
            message="overloaded", response=MagicMock(status_code=529), body={}
        )
        mock_client.messages.create.side_effect = [error, error]

        with patch("app.services.llm.time.sleep"):
            with pytest.raises(anthropic.APIStatusError):
                call_llm("system", "user", retries=2)

    @patch("app.services.llm._get_client")
    def test_retries_on_invalid_json_then_succeeds(self, mock_get_client):
        mock_client = mock_get_client.return_value
        bad_response = MagicMock()
        bad_response.content = [MagicMock(text="not json at all {{{")]
        good_response = MagicMock()
        good_response.content = [MagicMock(text='{"fixed": true}')]
        mock_client.messages.create.side_effect = [bad_response, good_response]

        result = call_llm("system", "user", retries=2)
        assert result == {"fixed": True}
