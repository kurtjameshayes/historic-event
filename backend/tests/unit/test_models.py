from __future__ import annotations

import pytest
from bson import ObjectId

from app.models import (
    create_session,
    get_session,
    update_session,
    append_reasoning,
    list_sessions,
    clear_session_data,
    insert_event,
    get_events,
    get_event,
    insert_edge,
    get_edges,
    insert_critic_run,
    list_critic_runs,
    increment_session_critic_run_seq,
    upsert_prompt_memory_entries,
    get_prompt_memory,
    get_cached_search,
    cache_search,
    _serialize_doc,
    _prompt_memory_text_hash,
)


class TestSerializeDoc:
    def test_converts_id(self):
        oid = ObjectId()
        doc = {"_id": oid, "name": "test"}
        result = _serialize_doc(doc)
        assert result["id"] == str(oid)
        assert "_id" not in result

    def test_none_returns_none(self):
        assert _serialize_doc(None) is None

    def test_converts_objectid_fields(self):
        oid = ObjectId()
        doc = {"_id": ObjectId(), "session_id": oid}
        result = _serialize_doc(doc)
        assert result["session_id"] == str(oid)


class TestSessionOperations:
    def test_create_session(self, mock_db):
        session_id, query_id = create_session(mock_db, "Test query", {"max_depth": 3})
        assert session_id is not None
        assert query_id is not None

    def test_get_session(self, mock_db):
        session_id, _ = create_session(mock_db, "Test query", {"max_depth": 3})
        session = get_session(mock_db, session_id)
        assert session is not None
        assert session["query"] == "Test query"
        assert session["status"] == "PLAN"
        assert session["config"]["max_depth"] == 3

    def test_get_session_not_found(self, mock_db):
        result = get_session(mock_db, str(ObjectId()))
        assert result is None

    def test_update_session(self, mock_db):
        session_id, _ = create_session(mock_db, "Test query", {})
        update_session(mock_db, session_id, {"status": "RESEARCH"})
        session = get_session(mock_db, session_id)
        assert session["status"] == "RESEARCH"

    def test_append_reasoning(self, mock_db):
        session_id, _ = create_session(mock_db, "Test query", {})
        entry = {"agent": "Planner", "type": "info", "msg": "Planning started"}
        append_reasoning(mock_db, session_id, entry)
        session = get_session(mock_db, session_id)
        assert len(session["reasoning_trace"]) == 1
        assert session["reasoning_trace"][0]["agent"] == "Planner"

    def test_list_sessions(self, mock_db):
        create_session(mock_db, "Query 1", {})
        create_session(mock_db, "Query 2", {})
        sessions = list_sessions(mock_db)
        assert len(sessions) == 2

    def test_list_sessions_with_search(self, mock_db):
        create_session(mock_db, "Berlin Wall history", {})
        create_session(mock_db, "French Revolution causes", {})
        sessions = list_sessions(mock_db, search="Berlin")
        assert len(sessions) == 1
        assert "Berlin" in sessions[0]["query"]

    def test_list_sessions_with_limit(self, mock_db):
        for i in range(5):
            create_session(mock_db, f"Query {i}", {})
        sessions = list_sessions(mock_db, limit=2)
        assert len(sessions) == 2

    def test_clear_session_data(self, mock_db):
        session_id, _ = create_session(mock_db, "Test query", {})
        insert_event(mock_db, session_id, {"title": "Event 1", "date": "2000-01-01"})
        insert_edge(mock_db, session_id, {"from_event_id": "a", "to_event_id": "b"})

        clear_session_data(mock_db, session_id)
        assert get_events(mock_db, session_id) == []
        assert get_edges(mock_db, session_id) == []


class TestEventOperations:
    def test_insert_event(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        event_id = insert_event(mock_db, session_id, {
            "title": "Test Event",
            "date": "1989-11-09",
            "thread_id": "t1",
            "description": "A test event",
        })
        assert event_id is not None

    def test_get_events(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        insert_event(mock_db, session_id, {"title": "Event A", "date": "1990-01-01", "thread_id": "t1"})
        insert_event(mock_db, session_id, {"title": "Event B", "date": "1989-01-01", "thread_id": "t1"})
        events = get_events(mock_db, session_id)
        assert len(events) == 2
        assert events[0]["date"] <= events[1]["date"]

    def test_get_event(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        event_id = insert_event(mock_db, session_id, {
            "title": "Specific Event",
            "date": "2000-01-01",
        })
        event = get_event(mock_db, event_id)
        assert event is not None
        assert event["title"] == "Specific Event"

    def test_get_event_not_found(self, mock_db):
        assert get_event(mock_db, str(ObjectId())) is None

    def test_event_strips_id_field(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        event_id = insert_event(mock_db, session_id, {
            "id": "should-be-removed",
            "title": "Test",
            "date": "2000-01-01",
        })
        assert event_id != "should-be-removed"


class TestEdgeOperations:
    def test_insert_edge(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        edge_id = insert_edge(mock_db, session_id, {
            "from_event_id": "e1",
            "to_event_id": "e2",
            "reasoning": "A caused B",
            "confidence": 0.85,
        })
        assert edge_id is not None

    def test_get_edges(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        insert_edge(mock_db, session_id, {"from_event_id": "e1", "to_event_id": "e2"})
        insert_edge(mock_db, session_id, {"from_event_id": "e2", "to_event_id": "e3"})
        edges = get_edges(mock_db, session_id)
        assert len(edges) == 2


class TestCriticRunOperations:
    def test_insert_and_list(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        critic_id = insert_critic_run(
            mock_db, session_id, run_seq=0, cycle=1,
            critique={"overall_score": 0.5},
            dag_stats={"event_count": 10},
        )
        assert critic_id is not None
        runs = list_critic_runs(mock_db, session_id)
        assert len(runs) == 1
        assert runs[0]["critique"]["overall_score"] == 0.5

    def test_increment_critic_run_seq(self, mock_db):
        session_id, _ = create_session(mock_db, "Test", {})
        seq = increment_session_critic_run_seq(mock_db, session_id)
        assert seq == 1
        seq2 = increment_session_critic_run_seq(mock_db, session_id)
        assert seq2 == 2


class TestPromptMemoryOperations:
    def test_upsert_and_get(self, mock_db):
        entries = [
            {
                "scope_key": "global",
                "target": "planner",
                "category": "recommendation",
                "text": "Add more threads",
            }
        ]
        saved = upsert_prompt_memory_entries(mock_db, entries)
        assert len(saved) == 1

        result = get_prompt_memory(mock_db, "global", "planner")
        assert len(result) == 1
        assert result[0]["text"] == "Add more threads"

    def test_upsert_deduplicates(self, mock_db):
        entry = {
            "scope_key": "global",
            "target": "planner",
            "category": "recommendation",
            "text": "Same recommendation",
        }
        upsert_prompt_memory_entries(mock_db, [entry])
        upsert_prompt_memory_entries(mock_db, [entry])
        result = get_prompt_memory(mock_db, "global", "planner")
        assert len(result) == 1

    def test_skips_empty_text(self, mock_db):
        entries = [{"scope_key": "global", "target": "planner", "text": ""}]
        saved = upsert_prompt_memory_entries(mock_db, entries)
        assert len(saved) == 0


class TestResearchCacheOperations:
    def test_cache_and_retrieve(self, mock_db):
        cache_search(mock_db, "hash123", "test query", [{"url": "http://example.com"}])
        cached = get_cached_search(mock_db, "hash123")
        assert cached is not None
        assert cached["results"][0]["url"] == "http://example.com"

    def test_cache_miss(self, mock_db):
        assert get_cached_search(mock_db, "nonexistent") is None

    def test_cache_upsert_overwrites(self, mock_db):
        cache_search(mock_db, "hash123", "query", [{"url": "old"}])
        cache_search(mock_db, "hash123", "query", [{"url": "new"}])
        cached = get_cached_search(mock_db, "hash123")
        assert cached["results"][0]["url"] == "new"
