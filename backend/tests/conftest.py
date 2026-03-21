from __future__ import annotations

import sys
from unittest.mock import MagicMock

# Patch tavily before any app code imports it, since the installed version
# uses dict[str, str] syntax incompatible with Python < 3.10
tavily_mock = MagicMock()
sys.modules["tavily"] = tavily_mock
sys.modules["tavily.TavilyClient"] = tavily_mock

import pytest
import mongomock

from app import create_app
from app.models import ensure_indexes


@pytest.fixture()
def mock_db():
    """Provide a mongomock database that behaves like a real pymongo Database."""
    client = mongomock.MongoClient()
    db = client["test_historic_event"]
    ensure_indexes(db)
    return db


@pytest.fixture()
def app(mock_db):
    """Create a Flask test app with the mock database injected."""
    import app as app_module

    application = create_app()
    application.config["TESTING"] = True

    app_module.db = mock_db

    return application


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()
