# Configuration

All backend configuration is managed through environment variables, loaded from `backend/.env` via `python-dotenv`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | `""` | Anthropic API key for Claude LLM calls. Obtain from [console.anthropic.com](https://console.anthropic.com). |
| `TAVILY_API_KEY` | Yes | `""` | Tavily Search API key. Obtain from [tavily.com](https://tavily.com). |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/historic_event` | MongoDB connection string. Must include the database name. For Atlas, use the `mongodb+srv://` format. |
| `FLASK_DEBUG` | No | `false` | Set to `true` to enable Flask debug mode with auto-reload. |
| `LLM_MODEL` | No | `claude-sonnet-4-20250514` | The Anthropic model to use for all LLM calls. |
| `LLM_MAX_TOKENS` | No | `4096` | Maximum tokens for LLM responses. |

## Application Defaults

These values are defined in `backend/app/config.py` and are not configurable via environment variables. They can be overridden per-session via the API:

| Setting | Default | Description |
|---|---|---|
| `DEFAULT_MAX_DEPTH` | `3` | How many causal levels deep to trace (1-5). Passed as `max_depth` in the session config. |
| `DEFAULT_MAX_CYCLES` | `5` | Maximum research cycles before forced completion. Passed as `max_cycles`. |
| `DEFAULT_COVERAGE_THRESHOLD` | `0.70` | Minimum coverage score (0.0-1.0) for the Critic to consider research sufficient. |

## Frontend Configuration

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` (empty, uses relative path) | Base URL for API calls. In development, the Vite proxy handles routing. In production, set this to the backend URL if the frontend is served from a different origin. |

## Vite Proxy

During development, Vite proxies `/api` requests to the Flask backend. This is configured in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
        target: 'http://localhost:5210',
      changeOrigin: true,
    },
  },
},
```

## MongoDB Connection

The application uses a 5-second `serverSelectionTimeoutMS` during startup for index creation. If MongoDB is not available, the app logs a warning and starts anyway -- but API calls that require database access will fail.

For production, ensure your MongoDB Atlas cluster is:
- In the same region as your server for low latency.
- Configured with appropriate network access rules (IP whitelist or VPC peering).
- Using the `retryWrites=true&w=majority` connection parameters for write safety.

## Tuning the Agentic Loop

The agentic loop behavior can be fine-tuned per session via the `POST /api/sessions` endpoint:

- **`max_depth`** (1-5): Controls how many causal levels deep the Planner traces. Higher values produce richer timelines but require more research cycles.
- **`max_cycles`** (1-10): Caps the number of Plan-Research-Evaluate-Adapt iterations. More cycles improve coverage but increase latency and API costs.
- **`focus_threads`** (string array): Allows the user to specify causal dimensions to prioritize (e.g., `["Economic", "Military"]`).

For a typical query, the defaults (`max_depth=3`, `max_cycles=5`) provide a good balance of depth and speed.
