# EvolveX

Agent evolution sandbox with four independent modes:
- Classic: self-modifying benchmark loop
- Arena: adversarial solver vs challenger co-evolution
- Bootstrap: two-peer recursive autonomy + emergent operating language
- Genesis: autonomous single-agent builder

Built for the EvolveX Hackathon using OpenAI API.

## Architecture

```
Classic mode:
Performer (Agent A) → runs benchmark tasks
Analyzer  (Agent B) → identifies improvement opportunities via LLM
Modifier  (Agent C) → generates code mutations via LLM
Sandbox              → validates mutations before applying (exec-isolated)
Checkpoint           → save/restore state for rollback
Loop                 → orchestrates one full evolution cycle

Bootstrap mode:
Peer A + Peer B      → symmetric agents with minimal priors
Broker               → stage-gated tool execution and audit trail
Protocol             → invented operating language with adoption/stability metrics
Curriculum           → progressively unlocks capabilities and harder objectives

Shared platform:
API (FastAPI)        → WebSocket broadcast + REST control across all modes
Dashboard (Next.js)  → real-time visualization
```

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/YOUR_USERNAME/evolvex.git
cd evolvex

# 2. Python backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Set API credentials
cp .env.example .env
# edit .env -> set OPENAI_API_KEY and OPENAI_MODEL

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

## Bootstrap Mode

Bootstrap mode is the proof-of-concept for maximal agency:
- Two peer agents start with minimal information and brokered capabilities only
- They must coordinate through messages, critique, and a shared invented language
- Tool access unlocks by stage: scratchpad → files → repo read → execution/testing → shell → web → packages
- Every protocol token, broker action, and artifact mutation is logged in the bootstrap workspace

## Split Deployment

Frontend and backend can be deployed independently.

- Frontend-only deploy updates the dashboard checkout and restarts only the Next server on port `3002`
- Backend-only deploy updates the agent/API checkout and restarts only FastAPI on port `8000`
- Frontend deploys should not interrupt active Bootstrap, Genesis, Arena, or Classic runs

Commands:

```bash
./scripts/deploy_frontend.sh
./scripts/deploy_backend.sh
```

Default remote layout:

- frontend checkout: `/opt/evolvex-frontend`
- backend checkout: `/opt/evolvex`
