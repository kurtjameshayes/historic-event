from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
    MONGODB_URI = os.getenv(
        "MONGODB_URI",
        "mongodb://localhost:27017/historic_event",
    )
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-4-20250514")
    LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4096"))
    DEFAULT_MAX_DEPTH = 3
    DEFAULT_MAX_CYCLES = 5
    DEFAULT_MAX_SOURCES_PER_THREAD = 5
    DEFAULT_COVERAGE_THRESHOLD = 0.70
