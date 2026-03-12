# Agents

The system uses four LLM-driven agents, each with a dedicated system prompt and structured output requirements. All agents communicate with Claude via the shared LLM Service and return machine-parseable JSON (except the Renderer, which returns plain text).

## Planner Agent

**File:** `backend/app/agents/planner.py`
**Prompt:** `backend/app/prompts/planner.py`

### Purpose

Decomposes a user's historical question into 3-6 distinct causal threads, each representing a different dimension of causality (political, economic, social, military, ideological, technological, etc.).

### Input

- The user's natural language query.
- On subsequent cycles: the Critic's feedback from the previous cycle (temporal gaps, missing threads, recommendations).

### Processing

Makes a single LLM call that instructs Claude to:

1. Identify the target event and its approximate date.
2. Decompose the question into distinct causal threads.
3. For each thread, provide a description, priority score (1-5), and 2-4 specific search queries.
4. On subsequent cycles, incorporate Critic feedback to add new threads, reprioritize existing ones, and refine search queries.

### Output Schema

```json
{
  "target_event": {
    "name": "string",
    "approximate_date": "string",
    "description": "string"
  },
  "causal_threads": [
    {
      "id": "string (kebab-case, e.g. 't-political')",
      "name": "string",
      "description": "string",
      "priority": "integer (1-5)",
      "search_queries": ["string"],
      "status": "pending"
    }
  ],
  "research_notes": "string"
}
```

Each thread is automatically assigned a color from a predefined palette for frontend rendering.

---

## Research Agent

**File:** `backend/app/agents/researcher.py`
**Prompt:** `backend/app/prompts/researcher.py`

### Purpose

Executes web searches for a single causal thread, extracts dated events and causal claims from source texts, deduplicates results, and assigns confidence scores.

### Input

A single causal thread object with its search queries, plus any existing events from prior research.

### Processing

For each search query in the thread:

1. **Search:** Call `search_combined()` which runs both Tavily (7 results) and Wikipedia (3 results) searches. If no results, retry with up to 2 alternative query formulations.
2. **Extract:** For each source with substantial content (100+ characters), call Claude with the extraction prompt. The LLM identifies dated events, causal relationships, and source quality ratings.
3. **Deduplicate:** Merge near-duplicate events using fuzzy matching (SequenceMatcher) on title (>80% similarity) and date (>60% similarity). Sources from duplicates are merged.
4. **Resolve edges:** Map causal edge title references to event IDs using exact or fuzzy matching against all known events.
5. **Score:** Compute composite confidence for each edge using the scoring service.

### Date Parsing

The agent includes a best-effort date parser that handles:
- Full ISO dates: `1989-11-09`
- Year-month: `1989-11`
- Year only: `1989`
- Decades: `1980s`
- Descriptive dates (extracts the first 4-digit year found)

All dates are converted to epoch milliseconds for timeline positioning.

### Output Schema

```json
{
  "thread_id": "string",
  "events": [
    {
      "id": "string (temporary, remapped by orchestrator)",
      "date": "string",
      "timestamp": "integer (epoch ms)",
      "title": "string",
      "description": "string",
      "thread_id": "string",
      "sources": [{ "url": "", "title": "", "quality": "", "excerpt": "" }]
    }
  ],
  "causal_edges": [
    {
      "id": "string",
      "from_event_id": "string",
      "to_event_id": "string",
      "reasoning": "string",
      "confidence": "float",
      "thread_id": "string"
    }
  ],
  "raw_sources": [{ "url": "", "title": "", "quality": "", "excerpt": "" }]
}
```

---

## Critic Agent

**File:** `backend/app/agents/critic.py`
**Prompt:** `backend/app/prompts/critic.py`

### Purpose

Evaluates the current causal DAG for completeness, accuracy, and balance. Produces a structured critique that drives the next research cycle.

### Input

The full DAG (all events, edges, and thread metadata) serialized as JSON, plus the original user query.

### Evaluation Criteria

The Critic assesses seven dimensions:

1. **Temporal gaps:** Significant time periods within any thread with no events.
2. **Causal gaps:** Events that appear as effects without identified causes, or causes without documented effects.
3. **Weak links:** Causal edges supported by only a single low-quality source.
4. **Missing threads:** Obvious causal dimensions that are entirely unrepresented.
5. **Contradictions:** Sources that disagree on whether a causal relationship exists.
6. **Proportionality:** Whether research is evenly distributed across threads.
7. **Counter-narratives:** Well-known alternative explanations that are missing.

### Output Schema

```json
{
  "overall_score": "float (0.0-1.0)",
  "is_sufficient": "boolean",
  "temporal_gaps": [
    { "thread_id": "", "start_date": "", "end_date": "", "severity": "low|medium|high" }
  ],
  "causal_gaps": [
    { "event_id": "", "gap_type": "missing_cause|missing_effect|isolated_node", "description": "" }
  ],
  "weak_links": [
    { "edge_id": "", "current_confidence": 0.0, "reason": "" }
  ],
  "missing_threads": [
    { "suggested_name": "", "rationale": "", "search_queries": [""] }
  ],
  "contradictions": [
    { "event_ids": [""], "description": "", "resolution_suggestion": "" }
  ],
  "recommendations": ["prioritized action strings"]
}
```

The `overall_score` is compared against the coverage threshold (default 0.70). If sufficient, the orchestrator skips to rendering.

---

## Renderer

**File:** `backend/app/agents/renderer.py`
**Prompt:** `backend/app/prompts/narrator.py`

### Purpose

Generates a compelling prose narrative from the final DAG, organized by causal thread.

### Input

The complete DAG (target event, threads, events, edges) serialized as JSON, plus the original user query.

### Processing

Makes a single LLM call with `parse_json=False` to get plain text. The prompt instructs Claude to:

- Organize the narrative by causal thread.
- Reference specific events by name and date.
- Explain causal connections explicitly.
- Include an introduction and conclusion.
- Target 400-800 words.

### Output

A plain text string (not JSON) containing the narrative summary.

---

## LLM Service

**File:** `backend/app/services/llm.py`

All agent LLM calls go through the `call_llm()` function, which provides:

- **JSON output:** Parses response text as JSON by default.
- **Plain text mode:** Set `parse_json=False` for the Renderer.
- **Retry logic:** 3 attempts with exponential backoff (2s, 4s, 8s) on API errors.
- **JSON repair:** On parse failure, strips markdown fences and fixes trailing commas. On second failure, retries with a stricter prompt.
- **Configurable model and token limit:** Uses `Config.LLM_MODEL` and `Config.LLM_MAX_TOKENS`.
