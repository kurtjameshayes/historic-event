# Orchestrator

**File:** `backend/app/orchestrator.py`

The Orchestrator is the central control loop of the agentic system. It is implemented in Python (not LLM-driven) and runs in a background thread so it does not block the Flask request cycle.

## Phase State Machine

```
  +------+     +---------+     +----------+     +-------+     +--------+     +----------+
  | PLAN +---->| RESEARCH+---->| EVALUATE +---->| ADAPT +---->| (loop) |     | COMPLETE |
  +------+     +---------+     +----+-----+     +-------+     +--------+     +----------+
                                    |                                             ^
                                    | sufficient OR max_cycles                    |
                                    v                                             |
                               +--------+                                         |
                               | RENDER +---------------------------------------->+
                               +--------+
```

| Phase | Action | Transition |
|---|---|---|
| **PLAN** | Invoke Planner Agent with query + prior critique | Always proceeds to RESEARCH |
| **RESEARCH** | Invoke Research Agent for each thread (sorted by priority) | All threads processed --> EVALUATE |
| **EVALUATE** | Assemble DAG from MongoDB, invoke Critic Agent | Sufficient --> RENDER, else --> ADAPT |
| **ADAPT** | Update research agenda per Critic feedback | Max cycles reached --> RENDER, else back to PLAN |
| **RENDER** | Mark target event, invoke Renderer for narrative | Always proceeds to COMPLETE |

## Lifecycle

1. `start_orchestrator()` is called by the API route handler. It creates an `Orchestrator` instance and spawns a daemon thread.
2. The orchestrator calls `_run_loop()`, which iterates up to `max_cycles` times.
3. Each iteration executes PLAN, RESEARCH, and EVALUATE phases.
4. If the Critic's `overall_score` (or the locally computed coverage score) meets the `coverage_threshold`, the loop breaks.
5. If coverage is insufficient and cycles remain, ADAPT happens (the critique is fed back to the Planner in the next iteration).
6. After the loop, RENDER runs unconditionally.
7. The session is marked COMPLETE and a `complete` SSE event is emitted.

## SSE Event Emission

The Orchestrator communicates with the frontend through a per-session queue system:

- **`register_sse_queue(session_id)`** -- Called by the SSE route handler. Creates a `queue.Queue` and adds it to the global registry.
- **`unregister_sse_queue(session_id, queue)`** -- Called when the SSE connection closes.
- **`_emit(session_id, event_type, data)`** -- Pushes an event to all registered queues for the session. Thread-safe via a global lock.
- **`_emit_reasoning(session_id, db, agent, msg, type)`** -- Convenience function that both persists the reasoning entry to MongoDB and emits it via SSE.

Multiple clients can connect to the same session's SSE stream simultaneously. Each receives all events from the point they connect onward.

## Thread Management

On cycle 1, the Orchestrator initializes its thread list from the Planner's output. On subsequent cycles:

- New threads from the Planner (IDs not in the existing list) are appended.
- Existing threads have their `search_queries` and `priority` updated.
- Threads are never removed.

Research processes threads in descending priority order.

## Event ID Mapping

The Research Agent generates temporary event IDs (like `e-a1b2c3d4`). When events are written to MongoDB, they receive MongoDB ObjectIds. The Orchestrator maintains an `id_map` to translate temporary IDs to MongoDB IDs in causal edges.

## Coverage Decision

The Orchestrator uses the higher of two scores:

1. The Critic's `overall_score` (LLM-assessed).
2. The locally computed coverage score from `compute_coverage()` (formula-based).

This dual approach ensures that even if the LLM underestimates coverage, the mathematical model can trigger completion.

## Error Boundaries

Each phase is wrapped in try/except:

- **Planner failure:** Logs a warning, breaks the loop, proceeds to RENDER with whatever data exists.
- **Research failure (per thread):** Marks the thread as `error`, skips it, continues with remaining threads.
- **Critic failure:** Uses a fallback critique with `overall_score=0.0`, allowing the loop to continue or time out.
- **Renderer failure:** Uses a fallback narrative string.
- **Fatal error:** Catches any uncaught exception, sets session status to ERROR, emits an unrecoverable error event.
