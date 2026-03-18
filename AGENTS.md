# EvolveX — Codex Agent Context

## What This Is
Self-modifying agent evolution workbench with four shipped modes on this branch:

**Classic mode** — Performer, Analyzer, and Modifier loop:
benchmark -> analyze -> propose mutation -> sandbox validate -> apply or rollback.

**Arena mode** — Adversarial co-evolution across Piaget-inspired cognitive stages.
Challenger generates harder problems, Solver attempts them, and 3 consecutive wins stage the Solver up.
Full spec: `arena_spec.md`

**Bootstrap mode** — Two peer agents start with messaging and scratch space only, then earn brokered capabilities, artifacts, and a shared protocol over staged rounds.

**Genesis mode** — A single autonomous builder researches, plans, uses tools, edits workspace files, and self-assesses while the operator watches a shared trace.

## Growth Registry

This branch also ships a read-only growth registry foundation.

- storage root: `ops/nightly/registry/`
- reader module: `evolution/growth_registry.py`
- read endpoints:
  - `GET /api/growth/latest`
  - `GET /api/growth/runs/{run_id}`

## Current Truth Boundary

- `api.py` is the source of truth for shipped endpoints and current mode support.
- Branch-only work in other refs is not shipped here unless landed.

## Branch-Only Experiments

- `origin/codex/app`: housekeeping audit and housekeeping supervisor work
- `origin/agent-suite-lab`: genesis memory experiments

## Stack

- Python 3.13 + FastAPI backend (`api.py`, `agents/`, `evolution/`)
- Next.js dashboard (`dashboard/`) — real-time WebSocket event feed
- OpenAI API for LLM calls in all shipped agent modes
- local venv expected at `.venv/`

## Key Files

- `api.py` — FastAPI server and endpoint contract
- `evolution/growth_registry.py` — append-only growth registry helpers
- `agents/performer.py`, `agents/analyzer.py`, `agents/modifier.py` — Classic loop
- `agents/solver.py`, `agents/challenger.py` — Arena mode
- `agents/bootstrap_peer.py` — Bootstrap peers
- `agents/meta_agent.py` — Genesis orchestrator
- `evolution/bootstrap.py` — Bootstrap loop
- `evolution/genesis.py` — Genesis loop
- `tests/test_growth_registry.py` — growth registry and growth API coverage

## Rules

- Never apply Classic mutations without sandbox validation first.
- Every mutation gets a checkpoint before it runs.
- Do not describe branch-only work as shipped.
- No hardcoded API keys — use `.env`.
- Functions over classes in Python.
- After any Python edit: `python -m pytest tests/ -q` must pass.

## Run Locally

```bash
# Backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# Dashboard
cd dashboard
npm install
npm run dev

# Validation
source .venv/bin/activate && python -m pytest tests/ -q
cd dashboard && npm test && npm run build
```
