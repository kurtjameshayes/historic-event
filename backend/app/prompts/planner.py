from __future__ import annotations

PLANNER_SYSTEM = """You are a historical analyst specializing in causal analysis. Your job is to decompose a question about a historical event into distinct causal threads for structured research.

You MUST return a single JSON object with this exact schema:
{
  "target_event": {
    "name": "string - concise name of the event",
    "approximate_date": "string - ISO date or descriptive date",
    "description": "string - 1-2 sentence description"
  },
  "causal_threads": [
    {
      "id": "string - short kebab-case id like 't-political'",
      "name": "string - human-readable thread name",
      "description": "string - what this causal dimension covers",
      "priority": "integer 1-5 (5 = highest)",
      "search_queries": ["array of 2-4 specific search queries for this thread"],
      "status": "pending"
    }
  ],
  "research_notes": "string - free-text reasoning about your decomposition strategy"
}

Rules:
- Identify 3-6 distinct causal threads representing different dimensions (political, economic, social, military, ideological, technological, etc.)
- Prioritize threads by causal proximity and historical significance
- Avoid redundancy between threads
- Search queries should be specific and likely to return primary or high-quality secondary sources
- Return ONLY the JSON object, no markdown fences or extra text"""


def build_planner_prompt(
    query: str,
    critique: dict | None = None,
    prompt_memory: list[str] | None = None,
) -> str:
    prompt = f'Analyze this historical question and decompose it into causal threads:\n\n"{query}"'

    if prompt_memory:
        prompt += "\n\n--- REUSABLE PROMPT GUIDANCE ---\n"
        for item in prompt_memory[:8]:
            prompt += f"  - {item}\n"

    if critique:
        prompt += "\n\n--- CRITIC FEEDBACK FROM PREVIOUS CYCLE ---\n"
        if critique.get("missing_threads"):
            prompt += "\nMissing threads to add:\n"
            for mt in critique["missing_threads"]:
                prompt += f"  - {mt['suggested_name']}: {mt['rationale']}\n"
                if mt.get("search_queries"):
                    prompt += f"    Suggested queries: {', '.join(mt['search_queries'])}\n"

        if critique.get("temporal_gaps"):
            prompt += "\nTemporal gaps to address:\n"
            for gap in critique["temporal_gaps"]:
                prompt += f"  - Thread {gap['thread_id']}: gap from {gap.get('start_date', '?')} to {gap.get('end_date', '?')} (severity: {gap.get('severity', '?')})\n"

        if critique.get("recommendations"):
            prompt += "\nPrioritized recommendations:\n"
            for rec in critique["recommendations"]:
                prompt += f"  - {rec}\n"

        prompt += "\nUpdate your research agenda to address these gaps. Add new threads if suggested, reprioritize existing ones, and refine search queries for thin areas."

    return prompt
