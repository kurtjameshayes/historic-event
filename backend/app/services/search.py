from __future__ import annotations

import hashlib
import logging

import wikipedia
from tavily import TavilyClient

from ..config import Config
from .. import get_db
from ..models import get_cached_search, cache_search

logger = logging.getLogger(__name__)

_tavily: TavilyClient | None = None


def _get_tavily() -> TavilyClient:
    global _tavily
    if _tavily is None:
        _tavily = TavilyClient(api_key=Config.TAVILY_API_KEY)
    return _tavily


def _query_hash(query: str) -> str:
    return hashlib.sha256(query.strip().lower().encode()).hexdigest()


def tavily_search(query: str, max_results: int = 10) -> list[dict]:
    """Search via Tavily, returning cached results when available."""
    db = get_db()
    qhash = _query_hash(f"tavily:{query}")

    if db is not None:
        cached = get_cached_search(db, qhash)
        if cached:
            logger.info("Cache hit for Tavily query: %s", query)
            return cached["results"]

    try:
        client = _get_tavily()
        response = client.search(
            query=query,
            max_results=max_results,
            include_raw_content=True,
            search_depth="advanced",
        )
        results = []
        for item in response.get("results", []):
            results.append({
                "url": item.get("url", ""),
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "raw_content": item.get("raw_content", ""),
            })

        if db is not None:
            cache_search(db, qhash, query, results)

        return results
    except Exception:
        logger.exception("Tavily search failed for query: %s", query)
        return []


def wikipedia_search(query: str, max_results: int = 3) -> list[dict]:
    """Search Wikipedia and return page summaries."""
    db = get_db()
    qhash = _query_hash(f"wiki:{query}")

    if db is not None:
        cached = get_cached_search(db, qhash)
        if cached:
            logger.info("Cache hit for Wikipedia query: %s", query)
            return cached["results"]

    results = []
    try:
        titles = wikipedia.search(query, results=max_results)
        for title in titles:
            try:
                page = wikipedia.page(title, auto_suggest=False)
                results.append({
                    "url": page.url,
                    "title": page.title,
                    "content": page.summary,
                    "raw_content": page.content[:5000],
                })
            except (wikipedia.DisambiguationError, wikipedia.PageError):
                continue
    except Exception:
        logger.exception("Wikipedia search failed for query: %s", query)

    if db is not None and results:
        cache_search(db, qhash, query, results)

    return results


def search_combined(query: str, max_tavily: int = 7, max_wiki: int = 3) -> list[dict]:
    """Run both Tavily and Wikipedia searches and merge results."""
    tavily_results = tavily_search(query, max_results=max_tavily)
    wiki_results = wikipedia_search(query, max_results=max_wiki)
    return tavily_results + wiki_results
