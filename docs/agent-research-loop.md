# Agent Research Loop: Plan → Act → Observe → Adapt

This document describes how the Historical Causal Timeline Agent performs each step of its iterative research loop, with emphasis on LLM usage and how it evaluates findings for historical completeness and contradictions.

---

## Overview

The agent runs a multi-cycle loop. Each cycle has four phases:

1. **Plan** – Decompose the query into causal threads and research agenda
2. **Act** – Execute research: search sources, extract events and causal edges
3. **Observe** – Evaluate the current DAG for completeness and contradictions
4. **Adapt** – Use critique to adjust the next cycle's plan

The loop continues until coverage meets a threshold (default 0.70) or max cycles is reached.

---

## 1. Plan Phase

**Purpose:** Turn the user's historical question into a structured research plan.

**LLM usage:**
- **Model:** Claude (Anthropic) via `call_llm()` in `backend/app/services/llm.py`
- **System prompt:** `PLANNER_SYSTEM` from `backend/app/prompts/planner.py`
- **User prompt:** Built by `build_planner_prompt(query, critique)`

**Behavior:**
- The LLM is instructed to return a JSON object with:
  - `target_event`: name, approximate date, description
  - `causal_threads`: 3–6 threads with id, name, description, priority (1–5), and `search_queries`
- On first cycle, `critique` is `None`.
- On later cycles, the prompt includes critic feedback (missing threads, temporal gaps, recommendations).

**Adaptation:** The planner uses critique to:
- Add missing threads with suggested names and search queries
- Address temporal gaps
- Reprioritize threads
- Refine search queries for thin areas

---

## 2. Act Phase (Research)

**Purpose:** Execute the plan by searching sources and extracting events and causal edges.

**LLM usage:**
- **Model:** Claude via `call_llm()`
- **System prompt:** `RESEARCHER_SYSTEM` from `backend/app/prompts/researcher.py`
- **User prompt:** Built by `build_researcher_prompt()` for each source

**Behavior:**
1. **Search:** For each thread's `search_queries`, the system:
   - Uses Tavily (advanced search) and Wikipedia
   - Caches results in the DB
   - Falls back to alternative queries if no results

2. **Source selection:**  
   For each thread, sources are scored by relevance (title, description, query similarity) and the top `max_sources_per_thread` are kept.

3. **Per-source extraction:**  
   For each source:
   - The LLM receives the thread context, source URL, title, and up to 8,000 chars of source text
   - It returns JSON with:
     - `events`: date, title, description, location, source_quality
     - `causal_edges`: from_event_title, to_event_title, reasoning, extraction_confidence

4. **Post-processing:**
   - Events are deduplicated (fuzzy match on title + date)
   - Edge titles are resolved to event IDs
   - Edge confidence is computed from source count, quality, and extraction confidence

**LLM constraints:**  
The researcher prompt instructs the LLM to:
- Only extract claims that are explicitly stated or strongly implied
- Not infer causation beyond what the source supports
- Rate source quality (primary, secondary, tertiary, opinion)

---

## 3. Observe Phase (Evaluate)

**Purpose:** Assess the current DAG for completeness, accuracy, and contradictions.

**LLM usage:**
- **Model:** Claude via `call_llm()` with `max_tokens=4096`
- **System prompt:** `CRITIC_SYSTEM` from `backend/app/prompts/critic.py`
- **User prompt:** Built by `build_critic_prompt(query, dag_json)`

**Input:**  
The critic receives a JSON of the DAG (threads, events, edges, capped at 100 events and 150 edges).

**Evaluation criteria (from the critic prompt):**
1. **Temporal gaps:** Periods within a thread with no events
2. **Causal gaps:** Events with missing causes or effects, or isolated nodes
3. **Weak links:** Causal edges supported by single low-quality sources
4. **Missing threads:** Causal dimensions not represented
5. **Contradictions:** Disagreements between sources on causal relationships
6. **Proportionality:** Balance of research across threads
7. **Counter-narratives:** Alternative explanations that are missing

**Output:**  
The LLM returns a JSON object with:
- `overall_score` (0.0–1.0)
- `is_sufficient` (true if score ≥ 0.70)
- `temporal_gaps`: thread_id, start_date, end_date, severity
- `causal_gaps`: event_id, gap_type, description
- `weak_links`: edge_id, current_confidence, reason
- `missing_threads`: suggested_name, rationale, search_queries
- `contradictions`: event_ids, description, resolution_suggestion
- `recommendations`: prioritized action strings for the next cycle

**Historical completeness:**  
Completeness is evaluated via:
- Temporal coverage (no large gaps in time)
- Causal coverage (no orphan causes/effects)
- Thread coverage (all relevant dimensions represented)
- Balance across threads

**Contradiction detection:**  
The critic prompt explicitly asks for `contradictions` where sources disagree on causal relationships. The LLM inspects the DAG and source-backed edges to find such conflicts and suggest resolutions.

**Termination:**  
If `effective_score` (max of critic score and `compute_coverage()`) ≥ `coverage_threshold` (default 0.70), the loop stops. Otherwise it continues to Adapt.

---

## 4. Adapt Phase

**Purpose:** Use the critique to adjust the next cycle's plan.

**Behavior:**
- The critique from Observe is passed to the next Plan phase as `critique`.
- The planner prompt is augmented with:
  - Missing threads to add
  - Temporal gaps to address
  - Prioritized recommendations
- The orchestrator may add new threads or update search queries for existing threads.
- Threads are reordered by priority and capped at `max_threads`.

**No separate LLM call:**  
Adapt is implemented by feeding the critique into the planner; the planner LLM call is what performs the adaptation.

---

## LLM Service Details

**Location:** `backend/app/services/llm.py`

- Uses Anthropic's Claude via `anthropic.Anthropic`
- `call_llm(system_prompt, user_prompt, max_tokens, parse_json=True)`:
  - Sends system + user messages
  - Expects JSON; strips markdown fences and fixes trailing commas if needed
  - Retries with exponential backoff on API errors
  - Returns parsed JSON (or raw string if `parse_json=False`)

---

## Coverage and Confidence

**Coverage** (`backend/app/services/scoring.py`):
- Thread coverage: proportion of threads with ≥3 events and ≥2 edges
- Temporal coverage: penalty for large gaps between events
- Edge confidence: mean confidence across edges
- Balance: inverse of coefficient of variation of events per thread

**Edge confidence:**  
Combines source count, source quality, agreement, and extraction confidence.

---

## Summary

| Phase   | LLM Role   | Input                          | Output                                      |
|---------|------------|--------------------------------|---------------------------------------------|
| Plan    | Planner    | Query + optional critique      | target_event, causal_threads, search_queries|
| Act     | Researcher | Thread context + source text   | events, causal_edges per source             |
| Observe | Critic     | Query + DAG JSON               | score, gaps, contradictions, recommendations|
| Adapt   | (Planner)  | Critique → next Plan           | Updated threads and search queries          |

The agent evaluates its own findings by running the Critic LLM on the assembled DAG, which checks for temporal gaps, causal gaps, weak links, missing threads, contradictions, and balance. The resulting critique drives the next cycle's planning and research.
