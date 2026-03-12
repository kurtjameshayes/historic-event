# Getting Started

## Prerequisites

- **Python 3.10+** -- The backend requires Python 3.10 or later. Check with `python3 --version`.
- **Node.js 18+** -- The frontend uses Vite and requires Node.js 18 or later.
- **MongoDB Atlas** -- A free-tier MongoDB Atlas cluster (or a local MongoDB instance).
- **Anthropic API Key** -- Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key.
- **Tavily API Key** -- Sign up at [tavily.com](https://tavily.com) and create an API key.

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd historic-event
```

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment with Python 3.10+
python3.10 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env` with your actual credentials:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
TAVILY_API_KEY=tvly-your-key-here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/historic_event?retryWrites=true&w=majority
```

### 3. Frontend Setup

From the project root:

```bash
npm install
```

## Running the Application

### Start the Backend

```bash
cd backend
source venv/bin/activate
python run.py
```

The Flask server starts on **http://localhost:5210**. You should see output like:

```
 * Running on http://0.0.0.0:5210
 * Debug mode: on
```

If MongoDB is unavailable, you will see a warning about indexes, but the server will still start.

### Start the Frontend

In a separate terminal, from the project root:

```bash
npm run dev
```

The Vite dev server starts on **http://localhost:5211**. It proxies all `/api` requests to the Flask backend at port 5210.

### Open the Application

Navigate to **http://localhost:5211** in your browser. You should see the input screen with the search bar.

## First Query

1. Type a historical question, such as: *"What caused the Fall of the Berlin Wall?"*
2. Optionally expand **Advanced config** to adjust causal depth (1-5) and research cycles (1-10).
3. Click **Investigate**.
4. Watch the real-time status panel as the agent researches, with the reasoning trace streaming live.
5. When complete, explore the interactive causal timeline (DAG) and narrative summary.

## Production Deployment

For production, use Gunicorn instead of the Flask development server:

```bash
cd backend
source venv/bin/activate
gunicorn --workers 2 --threads 4 --bind 0.0.0.0:5210 run:app
```

Build the frontend for production:

```bash
npm run build
```

The built files are output to `dist/`. Serve them with any static file server (Nginx, Caddy, etc.) and proxy `/api` to the Gunicorn backend.
