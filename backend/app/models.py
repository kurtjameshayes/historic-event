from __future__ import annotations

import logging
import hashlib
import uuid
from datetime import datetime, timezone
from functools import wraps

from bson import ObjectId
from pymongo import ASCENDING
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)


def _mongo_retry(fn):
    """Retry a MongoDB operation once on transient failure."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except PyMongoError as e:
            logger.warning("MongoDB operation %s failed, retrying once: %s", fn.__name__, e)
            try:
                return fn(*args, **kwargs)
            except PyMongoError:
                logger.exception("MongoDB retry failed for %s", fn.__name__)
                raise
    return wrapper


def ensure_indexes(db: Database):
    db.sessions.create_index("query_id", unique=True, sparse=True)
    db.events.create_index([("session_id", ASCENDING), ("thread_id", ASCENDING)])
    db.events.create_index([("session_id", ASCENDING), ("date", ASCENDING)])
    db.causal_edges.create_index([("session_id", ASCENDING), ("from_event_id", ASCENDING)])
    db.causal_edges.create_index([("session_id", ASCENDING), ("to_event_id", ASCENDING)])
    db.research_cache.create_index("query_hash", unique=True)
    db.research_cache.create_index("ttl_expires", expireAfterSeconds=0)
    db.critic_runs.create_index(
        [("session_id", ASCENDING), ("run_seq", ASCENDING), ("cycle", ASCENDING)],
        unique=True,
    )
    db.critic_runs.create_index([("session_id", ASCENDING), ("created_at", ASCENDING)])
    db.prompt_memory.create_index(
        [("scope_key", ASCENDING), ("target", ASCENDING), ("text_hash", ASCENDING)],
        unique=True,
    )
    db.prompt_memory.create_index([("scope_key", ASCENDING), ("target", ASCENDING), ("updated_at", ASCENDING)])


def _oid(val) -> ObjectId:
    return val if isinstance(val, ObjectId) else ObjectId(val)


def _serialize_doc(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    for key in ("session_id", "from_event_id", "to_event_id"):
        if key in doc and isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
    return doc


# --------------- Sessions ---------------

@_mongo_retry
def create_session(db: Database, query: str, config: dict) -> tuple[str, str]:
    """Create a new session. Returns (session_id, query_id)."""
    query_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    result = db.sessions.insert_one({
        "query": query,
        "query_id": query_id,
        "target_event": None,
        "config": config,
        "status": "PLAN",
        "current_cycle": 0,
        "critic_run_seq": 0,
        "last_critique_id": None,
        "causal_threads": [],
        "narrative": None,
        "reasoning_trace": [],
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    })
    return str(result.inserted_id), query_id


def get_session(db: Database, session_id: str) -> dict | None:
    doc = db.sessions.find_one({"_id": _oid(session_id)})
    return _serialize_doc(doc)


@_mongo_retry
def update_session(db: Database, session_id: str, updates: dict):
    updates["updated_at"] = datetime.now(timezone.utc)
    db.sessions.update_one({"_id": _oid(session_id)}, {"$set": updates})


def append_reasoning(db: Database, session_id: str, entry: dict):
    db.sessions.update_one(
        {"_id": _oid(session_id)},
        {
            "$push": {"reasoning_trace": entry},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )


_SESSION_LIST_PROJECTION = {
    "query": 1,
    "query_id": 1,
    "status": 1,
    "created_at": 1,
    "updated_at": 1,
    "completed_at": 1,
    "config": 1,
}


def list_sessions(
    db: Database,
    limit: int = 50,
    skip: int = 0,
    search: str | None = None,
) -> list[dict]:
    query_filter: dict = {}
    if search:
        query_filter["query"] = {"$regex": search, "$options": "i"}
    cursor = (
        db.sessions.find(query_filter, _SESSION_LIST_PROJECTION)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return [_serialize_doc(doc) for doc in cursor]


def clear_session_data(db: Database, session_id: str):
    """Delete all events and edges for a session, reset session fields for restart."""
    sid = _oid(session_id)
    db.events.delete_many({"session_id": sid})
    db.causal_edges.delete_many({"session_id": sid})


# --------------- Events ---------------

@_mongo_retry
def upsert_event(db: Database, session_id: str, event: dict) -> str:
    event["session_id"] = _oid(session_id)
    if "id" in event:
        event.pop("id")
    result = db.events.insert_one(event)
    return str(result.inserted_id)


def get_events(db: Database, session_id: str) -> list[dict]:
    cursor = db.events.find({"session_id": _oid(session_id)}).sort("date", ASCENDING)
    return [_serialize_doc(doc) for doc in cursor]


def get_event(db: Database, event_id: str) -> dict | None:
    return _serialize_doc(db.events.find_one({"_id": _oid(event_id)}))


# --------------- Causal Edges ---------------

@_mongo_retry
def upsert_edge(db: Database, session_id: str, edge: dict) -> str:
    edge["session_id"] = _oid(session_id)
    if "id" in edge:
        edge.pop("id")
    result = db.causal_edges.insert_one(edge)
    return str(result.inserted_id)


def get_edges(db: Database, session_id: str) -> list[dict]:
    cursor = db.causal_edges.find({"session_id": _oid(session_id)})
    return [_serialize_doc(doc) for doc in cursor]


# --------------- Critic Runs ---------------

@_mongo_retry
def insert_critic_run(
    db: Database,
    session_id: str,
    run_seq: int,
    cycle: int,
    critique: dict,
    dag_stats: dict,
    prompt_memory_context: dict | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    result = db.critic_runs.insert_one({
        "session_id": _oid(session_id),
        "run_seq": run_seq,
        "cycle": cycle,
        "phase": "EVALUATE",
        "critique": critique,
        "dag_stats": dag_stats,
        "prompt_memory_context": prompt_memory_context or {},
        "created_at": now,
        "updated_at": now,
    })
    return str(result.inserted_id)


def list_critic_runs(db: Database, session_id: str, limit: int = 20) -> list[dict]:
    cursor = (
        db.critic_runs.find({"session_id": _oid(session_id)})
        .sort([("run_seq", -1), ("cycle", -1), ("created_at", -1)])
        .limit(limit)
    )
    return [_serialize_doc(doc) for doc in cursor]


@_mongo_retry
def increment_session_critic_run_seq(db: Database, session_id: str) -> int:
    doc = db.sessions.find_one_and_update(
        {"_id": _oid(session_id)},
        {
            "$inc": {"critic_run_seq": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        return_document=ReturnDocument.AFTER,
    )
    return int((doc or {}).get("critic_run_seq", 0))


# --------------- Prompt Memory ---------------

def _prompt_memory_text_hash(text: str) -> str:
    normalized = " ".join((text or "").strip().lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@_mongo_retry
def upsert_prompt_memory_entries(db: Database, entries: list[dict]) -> list[dict]:
    saved_entries: list[dict] = []
    now = datetime.now(timezone.utc)

    for entry in entries:
        text = " ".join((entry.get("text") or "").split())
        if not text:
            continue

        scope_key = entry.get("scope_key", "global")
        target = entry.get("target", "planner")
        category = entry.get("category", "recommendation")
        metadata = entry.get("metadata", {})
        source = entry.get("source", {})
        text_hash = _prompt_memory_text_hash(text)

        doc = db.prompt_memory.find_one_and_update(
            {
                "scope_key": scope_key,
                "target": target,
                "text_hash": text_hash,
            },
            {
                "$set": {
                    "scope_key": scope_key,
                    "target": target,
                    "category": category,
                    "text": text,
                    "text_hash": text_hash,
                    "metadata": metadata,
                    "source": source,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        if doc:
            saved_entries.append(_serialize_doc(doc))

    return saved_entries


def get_prompt_memory(db: Database, scope_key: str, target: str, limit: int = 10) -> list[dict]:
    cursor = (
        db.prompt_memory.find({"scope_key": scope_key, "target": target})
        .sort("updated_at", -1)
        .limit(limit)
    )
    return [_serialize_doc(doc) for doc in cursor]


# --------------- Research Cache ---------------

def get_cached_search(db: Database, query_hash: str) -> dict | None:
    doc = db.research_cache.find_one({"query_hash": query_hash})
    return _serialize_doc(doc) if doc else None


def cache_search(db: Database, query_hash: str, query: str, results: list):
    from datetime import timedelta
    db.research_cache.update_one(
        {"query_hash": query_hash},
        {"$set": {
            "query": query,
            "results": results,
            "fetched_at": datetime.now(timezone.utc),
            "ttl_expires": datetime.now(timezone.utc) + timedelta(days=30),
        }},
        upsert=True,
    )
