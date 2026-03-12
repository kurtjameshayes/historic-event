# Architecture

## Overview

The Historical Causal Timeline Agent is a full-stack application with a Python/Flask backend and a React/TypeScript frontend. The backend implements an agentic research loop that uses LLM-driven agents to decompose, research, evaluate, and render causal timelines. The frontend provides a real-time interactive experience via Server-Sent Events (SSE).

## System Diagram

```
                         +------------------+
                         |   User Browser   |
                         +--------+---------+
                                  |
                         Vite Dev Proxy (/api)
                                  |
              +-------------------+-------------------+
              |                                       |
    +---------v---------+               +-------------v----------+
    |  React Frontend   |               |   Flask Backend         |
    |                   |  SSE stream   |                        |
    |  InputScreen      +<--------------+  /api/sessions/:id/   |
    |  StatusScreen     |               |      stream            |
    |  ResultsScreen    | REST calls    |                        |
    |  TimelineView     +-------------->+  /api/sessions         |
    |  NarrativeView    |               |  /api/sessions/:id/   |
    |                   |               |      timeline          |
    +---------+---------+               |      narrative         |
              |                         |      deepen            |
              |                         +---+----+----+----------+
              |                             |    |    |
              |                    +--------+    |    +--------+
              |                    |             |             |
              |          +---------v---+  +------v------+ +---v---------+
              |          |  Orchestrator|  |   MongoDB   | | Anthropic   |
              |          |             |  |   Atlas     | | Claude API  |
              |          |  PLAN       |  +-------------+ +-------------+
              |          |  RESEARCH   |        ^               ^
              |          |  EVALUATE   |        |               |
              |          |  ADAPT      |        |    +----------+
              |          |  RENDER     |        |    |
              |          +--+--+--+--+-+    +---+----v----+
              |             |  |  |  |      |  LLM Service|
              |             |  |  |  |      +-------------+
              |         +---+  |  |  +---+
              |         |      |  |      |
              |  +------v-+ +--v--v-+ +--v------+
              |  |Planner | |Resear-| |Critic   |
              |  |Agent   | |cher   | |Agent    |
              |  +--------+ |Agent  | +---------+
              |             +---+---+
              |                 |
              |          +------v------+
              |          | Tavily API  |
              |          | Wikipedia   |
              |          +-------------+
```

## Component Responsibilities

| Component | Responsibility |
|---|---|
| **Orchestrator** | Controls the agentic loop. Manages state transitions between Plan, Research, Evaluate, Adapt, and Render phases. Enforces cycle limits and coverage thresholds. Runs in a background thread. |
| **Planner Agent** | Decomposes the user query into 3-6 distinct causal threads. Generates and refines the research agenda. Decides thread priority and depth. On subsequent cycles, incorporates Critic feedback. |
| **Research Agent** | Executes Tavily and Wikipedia searches per thread. Extracts dated events and causal claims from sources via LLM. Deduplicates events. Assigns confidence scores. |
| **Critic Agent** | Evaluates the current DAG for temporal gaps, causal gaps, weak links, missing counter-narratives, and source quality. Produces a structured critique with recommendations. |
| **Renderer** | Transforms the final DAG into a prose narrative summary organized by causal thread. |
| **LLM Service** | Thin wrapper around the Anthropic Claude API. Handles JSON output parsing, retry with exponential backoff, and JSON repair. |
| **Search Service** | Abstraction over Tavily Search API and Wikipedia API. Provides caching via MongoDB to avoid redundant API calls. |
| **Scoring Service** | Implements the confidence scoring formula for causal edges and the coverage threshold model for the overall DAG. |
| **Flask API** | 7 REST endpoints for session management, SSE streaming for real-time status updates, and timeline/narrative retrieval. |
| **React Frontend** | Three-screen SPA (Input, Status, Results) with an interactive React Flow DAG visualization, real-time SSE status panel, and narrative view. |

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend | Python 3.10+ / Flask | Fast iteration, strong ecosystem for LLM integration |
| Database | MongoDB Atlas | Flexible schema for heterogeneous event data, native TTL indexes for cache expiry |
| LLM Provider | Anthropic Claude | Strong reasoning capabilities, structured output, large context window |
| Web Search | Tavily API | Purpose-built for AI agents, returns clean extracted content |
| Reference Search | Wikipedia API | Broad coverage for historical events, high-quality reference content |
| Frontend | React 18 + TypeScript | Type-safe component model with rich ecosystem |
| DAG Visualization | React Flow (`@xyflow/react`) | Native React DAG rendering with zoom, pan, and interactive nodes |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first CSS with pre-built accessible primitives |
| Animations | Framer Motion (`motion/react`) | Declarative animation library for React |
| Real-Time | Server-Sent Events (SSE) | Lightweight unidirectional streaming from server to client |
| Build | Vite | Fast HMR, native ESM, built-in proxy for development |

## Data Flow

A complete research session follows this sequence:

1. User submits a query via `InputScreen`. The frontend calls `POST /api/sessions`.
2. Flask creates a session document in MongoDB, starts the Orchestrator in a background thread, and returns the `session_id`.
3. The frontend opens an SSE connection to `/api/sessions/{id}/stream`.
4. The Orchestrator enters the **PLAN** phase: invokes the Planner Agent, which calls Claude to decompose the query into causal threads.
5. The Orchestrator enters the **RESEARCH** phase: for each thread (sorted by priority), the Research Agent executes Tavily + Wikipedia searches, then calls Claude to extract events and causal edges from each source.
6. Extracted events and edges are written to MongoDB. SSE events are pushed to the frontend in real-time.
7. The Orchestrator enters the **EVALUATE** phase: the Critic Agent receives the full DAG and returns a structured critique with gap analysis and recommendations.
8. If coverage is sufficient (score >= 0.70) or max cycles reached, proceed to render. Otherwise, enter the **ADAPT** phase: update the research agenda with the Critic's feedback and loop back to PLAN.
9. The Orchestrator enters the **RENDER** phase: the Renderer generates a prose narrative from the final DAG.
10. The session is marked COMPLETE. The frontend fetches the final DAG from `/api/sessions/{id}/timeline` and displays the interactive timeline and narrative.

## Directory Structure

```
historic-event/
  backend/
    app/
      __init__.py              # Flask app factory
      config.py                # Environment-based configuration
      models.py                # MongoDB CRUD + indexes
      orchestrator.py          # Agentic loop + SSE event emission
      agents/
        planner.py             # Query decomposition
        researcher.py          # Search + extraction
        critic.py              # DAG evaluation
        renderer.py            # Narrative generation
      services/
        llm.py                 # Claude API wrapper
        search.py              # Tavily + Wikipedia
        scoring.py             # Confidence + coverage math
      prompts/
        planner.py             # Planner prompt templates
        researcher.py          # Researcher prompt templates
        critic.py              # Critic prompt templates
        narrator.py            # Narrator prompt templates
      api/
        routes.py              # REST + SSE endpoints
    requirements.txt
    run.py                     # Entry point
    .env.example
  src/
    app/
      App.tsx                  # Root component, state machine
      types.ts                 # TypeScript interfaces
      mockData.ts              # Berlin Wall example (development)
      components/
        InputScreen.tsx        # Query input + advanced config
        StatusScreen.tsx       # Live SSE status panel
        ResultsScreen.tsx      # Timeline/narrative toggle + detail panel
        TimelineView.tsx       # React Flow DAG visualization
        NarrativeView.tsx      # Prose summary view
        ui/                    # shadcn/ui primitives
      services/
        api.ts                 # REST client
        sse.ts                 # SSE connection manager
    styles/
      index.css                # Style imports
      tailwind.css             # Tailwind source config
      theme.css                # CSS custom properties
  docs/                        # This documentation
  package.json                 # Frontend dependencies
  vite.config.ts               # Vite + proxy config
```
