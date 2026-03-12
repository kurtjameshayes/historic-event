# Scoring Models

**File:** `backend/app/services/scoring.py`

The system uses two scoring models: one for individual causal edge confidence, and one for overall DAG coverage.

## Confidence Score (per edge)

Every causal edge receives a composite confidence score from four weighted factors:

| Factor | Weight | Description | Scoring |
|---|---|---|---|
| Source Count | 0.25 | How many independent sources support the claim | 1 source = 0.3, 2 sources = 0.6, 3+ sources = 1.0 |
| Source Quality | 0.30 | Average quality rating of supporting sources | primary/academic = 1.0, secondary = 0.7, tertiary = 0.4, opinion = 0.2 |
| Inter-Source Agreement | 0.25 | Degree to which sources agree on the causal claim | Full agreement = 1.0, partial = 0.5, contradiction = 0.1 |
| LLM Extraction Confidence | 0.20 | The LLM's self-assessed confidence that it correctly extracted the claim | 0.0-1.0 as reported by the Research Agent |

### Formula

```
confidence = (0.25 * source_count_score)
           + (0.30 * source_quality_score)
           + (0.25 * agreement_score)
           + (0.20 * extraction_confidence)
```

### Example

An edge supported by 2 secondary sources with full agreement and 0.85 extraction confidence:

```
source_count  = 0.6  (2 sources)
quality       = 0.7  (secondary average)
agreement     = 1.0  (full)
extraction    = 0.85

confidence = (0.25 * 0.6) + (0.30 * 0.7) + (0.25 * 1.0) + (0.20 * 0.85)
           = 0.15 + 0.21 + 0.25 + 0.17
           = 0.78
```

### Weak Link Threshold

Edges with composite scores below **0.3** are flagged as weak links by the Critic and prioritized for additional research in the next cycle.

---

## Coverage Score (per DAG)

The coverage score assesses overall research completeness. It is computed both by the Critic (via LLM) and locally by the scoring service (via formula). The orchestrator uses the higher of the two.

### Factors

| Factor | Weight | Description | Calculation |
|---|---|---|---|
| Thread Coverage | 0.30 | Proportion of threads with sufficient data | Each thread needs >= 3 events and >= 2 edges to score 1.0 |
| Temporal Coverage | 0.25 | Proportion of the timeline without large gaps | Penalizes gaps exceeding 20% of total timespan within any thread |
| Edge Confidence | 0.25 | Mean confidence score across all edges | Simple average of all edge confidence values |
| Balance | 0.20 | Evenness of research distribution across threads | 1 minus the coefficient of variation of events per thread |

### Formula

```
coverage = (0.30 * thread_coverage)
         + (0.25 * temporal_coverage)
         + (0.25 * mean_edge_confidence)
         + (0.20 * balance)
```

### Thread Coverage

```
For each thread:
  score = 1.0 if (event_count >= 3 AND edge_count >= 2) else 0.0

thread_coverage = sum(scores) / number_of_threads
```

### Temporal Coverage

For each thread, events are sorted by timestamp. Consecutive gaps are checked against 20% of the total timespan. Threads with fewer than 2 events are penalized.

```
temporal_coverage = 1.0 - (gap_penalties / total_checks)
```

### Balance

Uses the coefficient of variation (CV) of events per thread:

```
CV = standard_deviation(events_per_thread) / mean(events_per_thread)
balance = max(0.0, 1.0 - CV)
```

A CV of 0 (perfectly balanced) gives balance = 1.0. A CV of 1 or more gives balance = 0.0.

### Sufficiency Threshold

The default threshold is **0.70**. The orchestrator continues iterating until this score is met or `max_cycles` is reached. The threshold is configurable via `Config.DEFAULT_COVERAGE_THRESHOLD`.
