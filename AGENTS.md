# EvolveX — Codex Agent Context

## What This Is
Self-modifying agent evolution system. Three agents (Performer, Analyzer, Modifier) work in a loop:
benchmark → analyze → propose mutation → sandbox validate → apply or rollback.

## Stack
- Python 3.13 + FastAPI backend (`api.py`, `agents/`, `evolution/`)
- Next.js dashboard (`dashboard/`) — real-time WebSocket event feed
- OpenAI API for LLM calls in Analyzer and Modifier agents
- venv at `.venv/` — always `source .venv/bin/activate` first

## Key Files
- `api.py` — FastAPI server, WebSocket broadcast, REST endpoints
- `agents/performer.py` — executes benchmark tasks, holds evolvable task_code
- `agents/analyzer.py` — LLM identifies improvements
- `agents/modifier.py` — LLM generates code mutations
- `evolution/loop.py` — orchestrates one full cycle, yields event dicts
- `evolution/sandbox.py` — validates ALL mutations before applying (never skip)
- `evolution/checkpoint.py` — save/restore before every mutation

## Rules
- Never apply code mutations without sandbox validation first
- Every mutation gets a checkpoint before it runs
- All evolution events must be yielded from loop.py so the dashboard sees them
- No hardcoded API keys — use .env
- Functions over classes (Python)

## Run Locally
```bash
# Backend
source .venv/bin/activate && uvicorn api:app --reload --port 8000

# Dashboard
cd dashboard && npm run dev
```

## Codex Skills Mapping
- Performer → benchmark skill (runs task, measures time)
- Analyzer → analysis skill (LLM improvement suggestion)
- Modifier → mutation skill (LLM code generation)
Use worktrees to develop each skill in parallel isolation.
