# Error Handling

The system implements defense-in-depth error handling across all layers to ensure graceful degradation. The guiding principle is: always produce some result, even if partial.

## Backend Error Handling

### LLM API Failures

**File:** `backend/app/services/llm.py`

| Failure | Strategy | User Impact |
|---|---|---|
| API timeout / rate limit / server error | Retry 3 times with exponential backoff (2s, 4s, 8s) | No impact unless all retries fail |
| Connection error | Retry 3 times with exponential backoff | No impact unless all retries fail |
| Malformed JSON response | Strip markdown fences, fix trailing commas. If repair fails, retry with a stricter prompt appended | No impact unless all retries fail |
| All retries exhausted | Exception propagates to the calling agent | Handled per-agent (see below) |

### Search Failures

**File:** `backend/app/services/search.py`, `backend/app/agents/researcher.py`

| Failure | Strategy | User Impact |
|---|---|---|
| Tavily search returns no results | Try alternative query: `"{query} history causes"`. If still empty, try `"{thread_name} historical events timeline"` | Thread may have fewer events |
| Tavily API error | Return empty list, log exception | Thread relies on Wikipedia results only |
| Wikipedia disambiguation/page error | Skip the problematic page, continue with others | Minor reduction in source count |
| Wikipedia API error | Return empty list, log exception | Thread relies on Tavily results only |

### Agent Failures

**File:** `backend/app/orchestrator.py`

| Agent | Failure Strategy | User Impact |
|---|---|---|
| **Planner** | Log warning, break the loop, proceed to RENDER with existing data | Partial timeline with fewer cycles of research |
| **Research** (per thread) | Log warning, mark thread as `error`, skip to next thread | Thread missing from results; other threads unaffected |
| **Critic** | Use fallback critique: `{ overall_score: 0.0, is_sufficient: false }`. Loop continues or times out. | May get extra research cycles (beneficial) or hit max_cycles |
| **Renderer** | Use fallback narrative: "Narrative generation failed. Please review the timeline visualization." | User sees timeline but no prose summary |
| **Fatal (uncaught)** | Set session status to `ERROR`, emit unrecoverable error SSE event | User sees error notification; can start new query |

### MongoDB Failures

**File:** `backend/app/models.py`

| Failure | Strategy | User Impact |
|---|---|---|
| Write operation failure | `@_mongo_retry` decorator retries once | No impact if retry succeeds |
| Persistent write failure | Exception propagates; orchestrator catches and continues where possible | Session state may be partially lost if server restarts |
| Connection timeout at startup | App starts anyway with a warning log. Index creation is skipped. | Indexes created on first successful connection |

### SSE Stream Failures

**File:** `backend/app/api/routes.py`

| Failure | Strategy | User Impact |
|---|---|---|
| Client disconnects | `finally` block unregisters the queue. Orchestrator continues. | User can reconnect to same session |
| No events for 30 seconds | Heartbeat comment (`: heartbeat\n\n`) sent to keep connection alive | No impact |
| Unrecoverable error | Stream closes after emitting error event | Frontend transitions to results with partial data |

## Frontend Error Handling

### Session Creation

**File:** `src/app/App.tsx`

If `POST /api/sessions` fails (network error, server error, validation error), the error message is displayed in a red banner on the `InputScreen`. The user can modify their query and retry.

### SSE Connection

**File:** `src/app/services/sse.ts`, `src/app/components/StatusScreen.tsx`

| Failure | Strategy |
|---|---|
| SSE `onerror` event (connection lost) | Emits `{ message: "SSE connection lost", recoverable: true }` to the error callback. Logged in the reasoning trace. |
| Unrecoverable error from backend | Triggers `handleComplete()` after 1.5 second delay, transitioning to results with whatever data is available. |
| `complete` event received | Closes `EventSource`, fetches final timeline data, transitions to results. |

### Timeline Data Fetch

**File:** `src/app/components/StatusScreen.tsx`

If `getTimeline()` fails after the session completes, a fallback `DAGData` object is created with empty events/edges and a "Failed to load results" narrative.

### Skip to Results

The user can click "Skip to Results" at any time during research. This calls `handleComplete()` immediately, fetching whatever data has been collected so far. The orchestrator continues running in the background.

## Error Flow Diagram

```
LLM Error
  --> Retry (3x, exponential backoff)
    --> JSON Repair
      --> Stricter Prompt Retry
        --> Agent catches exception
          --> Orchestrator skips/continues
            --> SSE warning emitted
              --> Frontend shows warning in trace log

Search Error
  --> Alternative query (up to 2 reformulations)
    --> Return empty results
      --> Thread has fewer events
        --> Critic detects thin thread
          --> Recommends more research (if cycles remain)

MongoDB Error
  --> @_mongo_retry (1 retry)
    --> Orchestrator catches and continues
      --> In-memory state may diverge from DB
        --> Session may not survive server restart

Fatal Error
  --> Session status set to ERROR
    --> Unrecoverable SSE error emitted
      --> Frontend transitions to results
        --> Partial data displayed with quality indicators
```
