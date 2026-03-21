from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock

from app.services.search import tavily_search, wikipedia_search, search_combined, _query_hash


class TestQueryHash:
    def test_deterministic(self):
        assert _query_hash("test query") == _query_hash("test query")

    def test_case_insensitive(self):
        assert _query_hash("Test Query") == _query_hash("test query")

    def test_trims_whitespace(self):
        assert _query_hash("  test  ") == _query_hash("test")


class TestTavilySearch:
    @patch("app.services.search.get_db")
    @patch("app.services.search._get_tavily")
    def test_returns_results(self, mock_get_tavily, mock_get_db):
        mock_get_db.return_value = None
        mock_client = MagicMock()
        mock_client.search.return_value = {
            "results": [
                {"url": "http://example.com", "title": "Test", "content": "Body", "raw_content": "Raw body"}
            ]
        }
        mock_get_tavily.return_value = mock_client

        results = tavily_search("test query")
        assert len(results) == 1
        assert results[0]["url"] == "http://example.com"
        assert results[0]["title"] == "Test"

    @patch("app.services.search.get_db")
    @patch("app.services.search._get_tavily")
    def test_returns_empty_on_exception(self, mock_get_tavily, mock_get_db):
        mock_get_db.return_value = None
        mock_get_tavily.return_value.search.side_effect = Exception("API error")

        results = tavily_search("test query")
        assert results == []

    @patch("app.services.search.get_db")
    @patch("app.services.search.get_cached_search")
    def test_uses_cache(self, mock_cache, mock_get_db):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_cache.return_value = {
            "results": [{"url": "cached", "title": "Cached Result", "content": "cached"}]
        }

        results = tavily_search("test query")
        assert results[0]["url"] == "cached"


class TestWikipediaSearch:
    @patch("app.services.search.get_db")
    @patch("app.services.search.wikipedia")
    def test_returns_results(self, mock_wiki, mock_get_db):
        mock_get_db.return_value = None
        mock_wiki.search.return_value = ["Test Article"]
        mock_page = MagicMock()
        mock_page.url = "http://wiki.example.com"
        mock_page.title = "Test Article"
        mock_page.summary = "Summary text"
        mock_page.content = "Full content" * 100
        mock_wiki.page.return_value = mock_page

        results = wikipedia_search("test query")
        assert len(results) == 1
        assert results[0]["title"] == "Test Article"

    @patch("app.services.search.get_db")
    @patch("app.services.search.wikipedia")
    def test_handles_disambiguation(self, mock_wiki, mock_get_db):
        import wikipedia as real_wiki
        mock_get_db.return_value = None
        mock_wiki.search.return_value = ["Ambiguous"]
        mock_wiki.DisambiguationError = real_wiki.DisambiguationError
        mock_wiki.PageError = real_wiki.PageError
        mock_wiki.page.side_effect = real_wiki.DisambiguationError("Ambiguous", ["A", "B"])

        results = wikipedia_search("ambiguous query")
        assert results == []

    @patch("app.services.search.get_db")
    @patch("app.services.search.wikipedia")
    def test_handles_search_exception(self, mock_wiki, mock_get_db):
        mock_get_db.return_value = None
        mock_wiki.search.side_effect = Exception("Network error")

        results = wikipedia_search("test query")
        assert results == []


class TestSearchCombined:
    @patch("app.services.search.wikipedia_search")
    @patch("app.services.search.tavily_search")
    def test_merges_results(self, mock_tavily, mock_wiki):
        mock_tavily.return_value = [{"url": "tavily1", "title": "T1"}]
        mock_wiki.return_value = [{"url": "wiki1", "title": "W1"}]

        results = search_combined("test query")
        assert len(results) == 2
        assert results[0]["url"] == "tavily1"
        assert results[1]["url"] == "wiki1"

    @patch("app.services.search.wikipedia_search")
    @patch("app.services.search.tavily_search")
    def test_handles_empty_results(self, mock_tavily, mock_wiki):
        mock_tavily.return_value = []
        mock_wiki.return_value = []

        results = search_combined("test query")
        assert results == []
