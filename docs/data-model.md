# Data Model

**File:** `backend/app/models.py`

The application uses MongoDB with four collections. All CRUD operations go through the models module, which handles ObjectId serialization and provides retry wrappers for write operations.

## Collections

### sessions

One document per user query. Tracks the full lifecycle of a research session.

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Session identifier (exposed as `id` in API) |
| `query` | string | Original user question |
| `target_event` | object | `{ name, approximate_date, description }` as identified by the Planner |
| `config` | object | `{ max_depth, max_cycles, coverage_threshold, focus_threads }` |
| `status` | string | `PLAN`, `RESEARCH`, `EVALUATE`, `ADAPT`, `RENDER`, `COMPLETE`, or `ERROR` |
| `current_cycle` | integer | Current research cycle number |
| `causal_threads` | array | Thread objects with id, name, description, color, priority, search_queries, status |
| `narrative` | string | Generated narrative summary (populated after RENDER phase) |
| `reasoning_trace` | array | Ordered log of agent decisions: `[{ agent, type, msg }]` |
| `created_at` | datetime | Session creation timestamp (UTC) |
| `completed_at` | datetime | Session completion timestamp (UTC, null until complete) |

### events

One document per historical event discovered during research.

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Event identifier |
| `session_id` | ObjectId | Reference to parent session |
| `thread_id` | string | Causal thread this event belongs to |
| `title` | string | Short event title |
| `description` | string | Detailed description of the event |
| `date` | string | Human-readable date (ISO, partial, or descriptive like "1980s") |
| `date_precision` | string | `DAY`, `MONTH`, `YEAR`, `DECADE`, or `APPROXIMATE` |
| `timestamp` | integer | Epoch milliseconds for timeline positioning |
| `location` | string | Geographic location (if relevant) |
| `sources` | array | `[{ url, title, quality, excerpt }]` |
| `is_target` | boolean | True if this is the target event the user asked about |

### causal_edges

One document per causal relationship between events.

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Edge identifier |
| `session_id` | ObjectId | Reference to parent session |
| `from_event_id` | string | ID of the cause event |
| `to_event_id` | string | ID of the effect event |
| `reasoning` | string | LLM-generated explanation of why this causal link exists |
| `confidence` | float | Composite confidence score (0.0-1.0) |
| `thread_id` | string | Causal thread this edge belongs to |

### research_cache

Caches raw search results to avoid redundant API calls across cycles and sessions.

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Cache entry identifier |
| `query_hash` | string | SHA-256 hash of the search query (prefixed with `tavily:` or `wiki:`) |
| `query` | string | Original search query text |
| `results` | array | Cached search results with extracted content |
| `fetched_at` | datetime | When this result was fetched |
| `ttl_expires` | datetime | Cache expiry (30 days from fetch). Uses MongoDB TTL index. |

## Indexes

Created at application startup via `ensure_indexes()`:

| Collection | Index | Purpose |
|---|---|---|
| `events` | `{ session_id: 1, thread_id: 1 }` | Filter events by session and thread |
| `events` | `{ session_id: 1, date: 1 }` | Sort events chronologically for timeline rendering |
| `causal_edges` | `{ session_id: 1, from_event_id: 1 }` | Traverse edges from a cause event |
| `causal_edges` | `{ session_id: 1, to_event_id: 1 }` | Traverse edges to an effect event |
| `research_cache` | `{ query_hash: 1 }` (unique) | Fast cache lookup by query hash |
| `research_cache` | `{ ttl_expires: 1 }` (TTL) | Automatic cache expiry after 30 days |

## Serialization

The `_serialize_doc()` helper converts MongoDB documents for API consumption:

- `_id` (ObjectId) is converted to `id` (string).
- `session_id`, `from_event_id`, and `to_event_id` ObjectIds are converted to strings.

## Retry Wrapper

Write operations (`create_session`, `update_session`, `upsert_event`, `upsert_edge`) are decorated with `@_mongo_retry`, which retries the operation once on any `PyMongoError`.
