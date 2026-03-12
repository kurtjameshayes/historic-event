# Historical Causal Timeline Agent -- Documentation

An agentic AI system that accepts a natural language question about a historical event and autonomously produces a multi-threaded causal timeline showing how preceding events, conditions, and decisions converged to precipitate the event in question.

## Table of Contents

1. [Architecture](architecture.md) -- System overview, component diagram, and data flow
2. [Getting Started](getting-started.md) -- Prerequisites, installation, and first run
3. [Configuration](configuration.md) -- Environment variables, defaults, and tuning
4. [API Reference](api-reference.md) -- REST endpoints, request/response schemas, and SSE events
5. [Agents](agents.md) -- Planner, Researcher, Critic, and Renderer agent design
6. [Orchestrator](orchestrator.md) -- The agentic loop, phase transitions, and coverage logic
7. [Data Model](data-model.md) -- MongoDB collections, schemas, and indexes
8. [Scoring Models](scoring.md) -- Confidence scoring and coverage threshold formulas
9. [Frontend](frontend.md) -- React components, state management, and visualization
10. [Error Handling](error-handling.md) -- Retry strategies, fallbacks, and resilience patterns
