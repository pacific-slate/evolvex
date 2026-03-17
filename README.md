# EvolveX

Self-modifying agent evolution system. Agents benchmark their own performance, propose code mutations, validate in an isolated sandbox, and apply improvements that pass — with automatic rollback on failure.

Built for the EvolveX Hackathon using OpenAI API.

## Architecture

```
Performer (Agent A) → runs benchmark tasks
Analyzer  (Agent B) → identifies improvement opportunities via LLM
Modifier  (Agent C) → generates code mutations via LLM
Sandbox              → validates mutations before applying (exec-isolated)
Checkpoint           → save/restore state for rollback
Loop                 → orchestrates one full evolution cycle
API (FastAPI)        → WebSocket broadcast + REST control
Dashboard (Next.js)  → real-time evolution visualization
```

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/YOUR_USERNAME/evolvex.git
cd evolvex

# 2. Python backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Set API key
cp .env.example .env
# edit .env → add OPENAI_API_KEY

# 4. Start backend
uvicorn api:app --reload --port 8000

# 5. Start dashboard (new terminal)
cd dashboard && npm install && npm run dev
# → http://localhost:3000
```

## Evolution Cycle

1. **Benchmark** — Performer runs current task code, records duration + fitness
2. **Analyze** — Analyzer sends code + result to LLM, gets improvement suggestion
3. **Checkpoint** — Current state saved before any mutation
4. **Mutate** — Modifier asks LLM to apply the suggestion
5. **Sandbox** — Proposed code validated against test suite in isolation
6. **Apply/Rollback** — If fitness improves: apply. If not: discard or rollback.

All events stream in real-time to the dashboard via WebSocket.
