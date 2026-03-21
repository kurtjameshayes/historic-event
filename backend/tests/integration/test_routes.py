from __future__ import annotations

import json
import pytest
from unittest.mock import patch, MagicMock

from app.models import create_session, update_session, insert_event, insert_edge


class TestCreateSession:
    @patch("app.api.routes.start_orchestrator")
    def test_create_session_success(self, mock_orch, client, mock_db):
        response = client.post("/api/sessions", json={"query": "What caused WW2?"})
        assert response.status_code == 201
        data = response.get_json()
        assert "session_id" in data
        assert "query_id" in data
        mock_orch.assert_called_once()

    @patch("app.api.routes.start_orchestrator")
    def test_create_session_empty_query(self, mock_orch, client):
        response = client.post("/api/sessions", json={"query": ""})
        assert response.status_code == 400
        assert "error" in response.get_json()
        mock_orch.assert_not_called()

    @patch("app.api.routes.start_orchestrator")
    def test_create_session_with_config(self, mock_orch, client, mock_db):
        response = client.post("/api/sessions", json={
            "query": "Test query",
            "max_depth": 3,
            "max_cycles": 5,
            "max_sources_per_thread": 10,
        })
        assert response.status_code == 201

    @patch("app.api.routes.start_orchestrator")
    def test_create_session_whitespace_query(self, mock_orch, client):
        response = client.post("/api/sessions", json={"query": "   "})
        assert response.status_code == 400


class TestListSessions:
    @patch("app.api.routes.start_orchestrator")
    def test_list_sessions_empty(self, mock_orch, client, mock_db):
        response = client.get("/api/sessions")
        assert response.status_code == 200
        assert response.get_json() == []

    @patch("app.api.routes.start_orchestrator")
    def test_list_sessions_with_data(self, mock_orch, client, mock_db):
        client.post("/api/sessions", json={"query": "Query 1"})
        client.post("/api/sessions", json={"query": "Query 2"})

        response = client.get("/api/sessions")
        data = response.get_json()
        assert len(data) == 2

    @patch("app.api.routes.start_orchestrator")
    def test_list_sessions_search(self, mock_orch, client, mock_db):
        client.post("/api/sessions", json={"query": "Berlin Wall"})
        client.post("/api/sessions", json={"query": "French Revolution"})

        response = client.get("/api/sessions?search=Berlin")
        data = response.get_json()
        assert len(data) == 1


class TestGetSession:
    @patch("app.api.routes.start_orchestrator")
    def test_get_existing_session(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]

        response = client.get(f"/api/sessions/{session_id}")
        assert response.status_code == 200
        data = response.get_json()
        assert data["query"] == "Test"

    def test_get_nonexistent_session(self, client, mock_db):
        response = client.get("/api/sessions/507f1f77bcf86cd799439011")
        assert response.status_code == 404


class TestGetTimeline:
    @patch("app.api.routes.start_orchestrator")
    def test_get_timeline(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]

        insert_event(mock_db, session_id, {
            "title": "Event 1", "date": "1989-01-01", "thread_id": "t1",
        })
        insert_edge(mock_db, session_id, {
            "from_event_id": "e1", "to_event_id": "e2", "reasoning": "test", "confidence": 0.9,
        })

        response = client.get(f"/api/sessions/{session_id}/timeline")
        assert response.status_code == 200
        data = response.get_json()
        assert "events" in data
        assert "edges" in data
        assert "threads" in data
        assert "narrative" in data
        assert "subtopics" in data

    def test_timeline_not_found(self, client, mock_db):
        response = client.get("/api/sessions/507f1f77bcf86cd799439011/timeline")
        assert response.status_code == 404


class TestGetNarrative:
    @patch("app.api.routes.start_orchestrator")
    def test_get_narrative(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]
        update_session(mock_db, session_id, {"narrative": "A historical narrative."})

        response = client.get(f"/api/sessions/{session_id}/narrative")
        assert response.status_code == 200
        data = response.get_json()
        assert data["narrative"] == "A historical narrative."

    def test_narrative_not_found(self, client, mock_db):
        response = client.get("/api/sessions/507f1f77bcf86cd799439011/narrative")
        assert response.status_code == 404


class TestRestartSession:
    @patch("app.api.routes.start_orchestrator")
    def test_restart_running_session(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]
        update_session(mock_db, session_id, {"status": "ERROR"})

        response = client.post(f"/api/sessions/{session_id}/restart")
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "restarted"

    @patch("app.api.routes.start_orchestrator")
    def test_restart_complete_session_rejected(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]
        update_session(mock_db, session_id, {"status": "COMPLETE"})

        response = client.post(f"/api/sessions/{session_id}/restart")
        assert response.status_code == 409

    def test_restart_not_found(self, client, mock_db):
        response = client.post("/api/sessions/507f1f77bcf86cd799439011/restart")
        assert response.status_code == 404


class TestDeepenInvestigation:
    @patch("app.api.routes.start_orchestrator")
    def test_deepen_thread(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]

        response = client.post(f"/api/sessions/{session_id}/deepen", json={"thread_id": "t1"})
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "deepening"

    @patch("app.api.routes.start_orchestrator")
    def test_deepen_missing_thread_id(self, mock_orch, client, mock_db):
        create_resp = client.post("/api/sessions", json={"query": "Test"})
        session_id = create_resp.get_json()["session_id"]

        response = client.post(f"/api/sessions/{session_id}/deepen", json={})
        assert response.status_code == 400

    def test_deepen_not_found(self, client, mock_db):
        response = client.post("/api/sessions/507f1f77bcf86cd799439011/deepen", json={"thread_id": "t1"})
        assert response.status_code == 404
