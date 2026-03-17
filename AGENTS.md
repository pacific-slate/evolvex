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
- `api.py` — FastAPI server, WebSocket broadcast. Endpoints: POST start/stop/reset, GET status
- `agents/performer.py` — executes benchmark tasks, holds evolvable task_code
- `agents/analyzer.py` — LLM identifies improvements
- `agents/modifier.py` — LLM generates code mutations
- `evolution/loop.py` — orchestrates one full cycle, yields event dicts
- `evolution/sandbox.py` — validates ALL mutations before applying (never skip)
- `evolution/checkpoint.py` — save/restore before every mutation
- `tests/test_sandbox.py` + `tests/test_fitness.py` — 13 passing tests
- `codex_plan.md` — FULL execution plan: worktree tasks A/B/C, event schema, demo script

## Event Schema (all events yielded from loop.py → broadcast via WS)
```
started           { cycles, baseline_ms }
cycle_start       { cycle, of }
benchmark         { generation, duration_ms, fitness, success }
analysis          { suggestion }
checkpoint        { generation }
mutation_proposed { code_preview }
sandbox_failed    { error }
sandbox_passed    { proposed_duration_ms, proposed_fitness }
applied           { generation, delta_fitness, new_fitness, pct_improvement, code, previous_code }
discarded         { reason, proposed_fitness, current_fitness }
rollback          { to_generation }
complete          { name, generation, fitness_score, mutation_count }
stopped           { cycle }
reset             {}
error             { message }
```

## Rules
- Never apply code mutations without sandbox validation first
- Every mutation gets a checkpoint before it runs
- All evolution events must be yielded from loop.py so the dashboard sees them
- No hardcoded API keys — use .env
- Functions over classes (Python)
- After ANY Python edit: `python -m pytest tests/ -q` must pass

## Run Locally
```bash
# Backend
source .venv/bin/activate && uvicorn api:app --reload --port 8000

# Dashboard
cd dashboard && npm run dev

# Tests
source .venv/bin/activate && python -m pytest tests/ -v
```

## Worktree Strategy (for parallel Codex development)
See `codex_plan.md` for the full task breakdown. Three parallel tracks:
- **wt-backend**: reset/stop endpoints (done), tests (done), any new API features
- **wt-dashboard**: fitness chart (recharts), code diff panel, human-readable events, stop/reset buttons
- **wt-evolution**: benchmark dataset size, pct_improvement (done), plateau detection

## Codex Skills Mapping
- Performer → benchmark skill (runs task, measures time)
- Analyzer → analysis skill (LLM improvement suggestion)
- Modifier → mutation skill (LLM code generation)
Use worktrees to develop each skill in parallel isolation.
