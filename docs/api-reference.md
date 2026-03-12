# API Reference

All endpoints are prefixed with `/api`. The backend runs on port 5210 by default. During development, the Vite proxy forwards `/api` from port 5211.

## REST Endpoints

### POST /api/sessions

Create a new research session and start the agentic loop.

**Request Body:**

```json
{
  "query": "What caused the Fall of the Berlin Wall?",
  "max_depth": 3,
  "max_cycles": 5,
  "focus_threads": ["Economic", "Military"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Natural language question about a historical event. |
| `max_depth` | integer | No (default: 3) | Causal depth levels (1-5). |
| `max_cycles` | integer | No (default: 5) | Maximum research cycles. |
| `focus_threads` | string[] | No | Causal dimensions to prioritize. |

**Response (201):**

```json
{
  "session_id": "6650a1b2c3d4e5f6a7b8c9d0"
}
```

The orchestrator starts immediately in a background thread. Connect to the SSE stream to monitor progress.

---

### GET /api/sessions

List past sessions, ordered by creation date (newest first).

**Response (200):**

```json
[
  {
    "id": "6650a1b2c3d4e5f6a7b8c9d0",
    "query": "What caused the Fall of the Berlin Wall?",
    "status": "COMPLETE",
    "current_cycle": 2,
    "created_at": "2026-03-09T12:00:00Z",
    "completed_at": "2026-03-09T12:05:30Z"
  }
]
```

Returns up to 20 sessions.

---

### GET /api/sessions/{id}

Retrieve full session metadata, including configuration, current status, causal threads, and reasoning trace.

**Response (200):**

```json
{
  "id": "6650a1b2c3d4e5f6a7b8c9d0",
  "query": "What caused the Fall of the Berlin Wall?",
  "target_event": {
    "name": "Fall of the Berlin Wall",
    "approximate_date": "1989-11-09",
    "description": "..."
  },
  "config": {
    "max_depth": 3,
    "max_cycles": 5,
    "coverage_threshold": 0.70,
    "focus_threads": []
  },
  "status": "COMPLETE",
  "current_cycle": 2,
  "causal_threads": [...],
  "narrative": "...",
  "reasoning_trace": [...],
  "created_at": "2026-03-09T12:00:00Z",
  "completed_at": "2026-03-09T12:05:30Z"
}
```

**Response (404):**

```json
{ "error": "session not found" }
```

---

### GET /api/sessions/{id}/stream

Server-Sent Events endpoint for real-time status updates. Connect with `EventSource`:

```javascript
const source = new EventSource('/api/sessions/abc123/stream');
source.addEventListener('phase_change', (e) => { ... });
```

The stream sends heartbeats every 30 seconds to keep the connection alive. It closes automatically when the session completes or encounters an unrecoverable error.

See [SSE Event Types](#sse-event-types) below for the full event catalog.

---

### GET /api/sessions/{id}/timeline

Retrieve the final causal DAG as JSON. This is the primary data endpoint consumed by the frontend `TimelineView` and `ResultsScreen`.

**Response (200):**

```json
{
  "target_event": {
    "name": "Fall of the Berlin Wall",
    "approximate_date": "1989-11-09",
    "description": "..."
  },
  "threads": [
    {
      "id": "t-political",
      "name": "Political / Diplomatic",
      "description": "...",
      "color": "bg-blue-500 border-blue-600 text-blue-800",
      "priority": 5,
      "search_queries": [...]
    }
  ],
  "events": [
    {
      "id": "6650b2c3d4e5f6a7b8c9d0e1",
      "date": "Mar 1985",
      "timestamp": 478569600000,
      "title": "Gorbachev becomes General Secretary",
      "description": "...",
      "thread_id": "t-political",
      "sources": [
        {
          "url": "https://...",
          "title": "Source Title",
          "quality": "primary",
          "excerpt": "..."
        }
      ],
      "is_target": false
    }
  ],
  "edges": [
    {
      "id": "6650c3d4e5f6a7b8c9d0e1f2",
      "from_event_id": "6650b2c3d4e5f6a7b8c9d0e1",
      "to_event_id": "6650b3c4d5e6f7a8b9c0d1e2",
      "reasoning": "Gorbachev's ascension allowed for the introduction of progressive reforms.",
      "confidence": 0.92,
      "thread_id": "t-political"
    }
  ],
  "narrative": "The Fall of the Berlin Wall was not a spontaneous accident..."
}
```

---

### GET /api/sessions/{id}/narrative

Retrieve only the generated narrative summary.

**Response (200):**

```json
{
  "narrative": "The Fall of the Berlin Wall was not a spontaneous accident..."
}
```

---

### POST /api/sessions/{id}/deepen

Request deeper investigation of a specific causal thread. Restarts the orchestrator for 2 additional research cycles focused on the given thread.

**Request Body:**

```json
{
  "thread_id": "t-political"
}
```

**Response (200):**

```json
{
  "status": "deepening",
  "session_id": "6650a1b2c3d4e5f6a7b8c9d0"
}
```

Reconnect to the SSE stream to monitor the deepening progress.

---

## SSE Event Types

All SSE events follow the format:

```
event: <event_type>
data: <json_payload>
```

### phase_change

Emitted when the orchestrator transitions between phases.

```json
{
  "phase": "RESEARCH",
  "cycle": 1,
  "message": "Entering RESEARCH phase"
}
```

Phase values: `PLAN`, `RESEARCH`, `EVALUATE`, `ADAPT`, `RENDER`.

### thread_update

Emitted when a causal thread's status changes.

```json
{
  "thread_id": "t-political",
  "name": "Political / Diplomatic",
  "description": "Changes in Soviet and East German leadership and policy.",
  "color": "bg-blue-500 border-blue-600 text-blue-800",
  "status": "investigating",
  "events_found": 0,
  "message": "Researching thread"
}
```

Status values: `pending`, `investigating`, `complete`, `error`.

### reasoning

Emitted for each reasoning trace entry from any agent.

```json
{
  "agent": "Research",
  "message": "Executing search: \"Gorbachev Glasnost effects\"",
  "type": "info"
}
```

Agent values: `Planner`, `Research`, `Critic`, `Renderer`, `Orchestrator`.
Type values: `phase`, `info`, `success`, `warning`.

### critique

Emitted after the Critic completes its evaluation.

```json
{
  "overall_score": 0.82,
  "gap_count": 2,
  "recommendation_count": 3
}
```

### complete

Emitted when the session finishes successfully. The SSE stream closes after this event.

```json
{
  "session_id": "6650a1b2c3d4e5f6a7b8c9d0",
  "event_count": 10,
  "edge_count": 8,
  "final_score": 0.85
}
```

### error

Emitted when an error occurs.

```json
{
  "message": "Unexpected error in research loop",
  "recoverable": false
}
```

If `recoverable` is `false`, the SSE stream closes after this event.
