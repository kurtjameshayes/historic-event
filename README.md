# Historical Causal Timeline Agent

An agentic AI system that accepts a natural language question about a historical event and autonomously produces a multi-threaded causal timeline (DAG) showing how preceding events converged to precipitate the event in question.

## Architecture

- **Backend:** Python / Flask with Anthropic Claude, Tavily Search, and MongoDB Atlas
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Flow

The system uses an iterative Plan → Research → Evaluate → Adapt loop with three LLM-driven agents (Planner, Researcher, Critic) coordinated by a Python orchestrator.

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Anthropic API key
- Tavily API key

## Setup

### Backend

```bash
cd backend
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys and MongoDB URI
python run.py
```

The Flask server starts on `http://localhost:5210`.

### Frontend

```bash
npm install
npm run dev
```

The Vite dev server starts on `http://localhost:5211` and proxies `/api` requests to the Flask backend.

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `TAVILY_API_KEY` | Tavily search API key |
| `MONGODB_URI` | MongoDB connection string |
| `LLM_MODEL` | Claude model name (default: `claude-opus-4-8`) |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/sessions` | Create session and start agent |
| GET | `/api/sessions` | List past sessions |
| GET | `/api/sessions/{id}` | Session status and metadata |
| GET | `/api/sessions/{id}/stream` | SSE real-time status updates |
| GET | `/api/sessions/{id}/timeline` | Final DAG as JSON |
| GET | `/api/sessions/{id}/narrative` | Generated narrative summary |
| POST | `/api/sessions/{id}/deepen` | Deepen investigation of a thread |
