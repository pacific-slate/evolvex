# EvolveX — Codex Agent Context

## What This Is
Self-modifying agent evolution system with two independent modes:

**Classic mode** — Three agents (Performer, Analyzer, Modifier) in a loop:
benchmark → analyze → propose mutation → sandbox validate → apply or rollback.

**Arena mode** — Adversarial co-evolution across Piaget-inspired cognitive stages.
Challenger generates problems → Solver attempts them → win/loss → 3 consecutive wins = stage up.
Full spec: `arena_spec.md`

## Cognitive Stages (Arena mode)
| Stage | Name | Solver strategy |
|---|---|---|
| 0 | Reactive | First approach that seems reasonable |
| 1 | Reflective | Weigh trade-offs, verify edge cases |
| 2 | Strategic | Plan multi-step, consider complexity |
| 3 | Meta-cognitive | Reason about reasoning strategy |

## Stack
- Python 3.13 + FastAPI backend (`api.py`, `agents/`, `evolution/`)
- Next.js dashboard (`dashboard/`) — real-time WebSocket event feed
- OpenAI API for LLM calls in all agent types
- venv at `.venv/` — always `source .venv/bin/activate` first

## Key Files
- `api.py` — FastAPI server, WebSocket broadcast. Classic + Arena endpoints
- `agents/performer.py` — executes benchmark tasks, holds evolvable task_code
- `agents/analyzer.py` — LLM identifies improvements
- `agents/modifier.py` — LLM generates code mutations
- `agents/solver.py` — stage-aware Solver for Arena mode
- `agents/challenger.py` — LLM challenge generator with difficulty escalation
- `evolution/loop.py` — Classic mode: one full cycle, yields event dicts
- `evolution/arena.py` — Arena mode: adversarial loop, yields arena event dicts
- `evolution/stages.py` — CognitiveStage enum, graduation logic, stage prompt fragments
- `evolution/challenges.py` — Challenge dataclass, validate_challenge, hardcoded fallbacks
- `evolution/sandbox.py` — validates ALL mutations before applying (never skip)
- `evolution/checkpoint.py` — save/restore before every mutation
- `tests/test_sandbox.py` + `tests/test_fitness.py` — 13 passing tests
- `codex_plan.md` — Classic mode execution plan
- `arena_spec.md` — Arena mode full spec: architecture, event schema, build order

## Event Schema

### Classic mode (loop.py → api.py → WS)
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

### Arena mode (arena.py → api.py → WS)
```
arena_started         { solver_stage, difficulty, rounds }
arena_round_start     { round, of, stage, difficulty }
arena_challenge       { description, difficulty, hint }
arena_solver_attempt  { stage, code_preview }
arena_win             { round, consecutive_wins, stage }
arena_loss            { round, reason, stage, consecutive_wins }
arena_stage_up        { new_stage, new_stage_id, total_wins }
arena_difficulty_up   { new_difficulty }
arena_complete        { solver_stage, solver_stage_id, total_wins, total_losses, win_rate, ...solver.to_dict() }
arena_stopped         { round }
arena_reset           {}
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
See `codex_plan.md` for Classic mode task breakdown.
See `arena_spec.md` for Arena mode full spec.

Three Arena tracks (parallel):
- **wt-arena-core**: evolution/stages.py + evolution/challenges.py + evolution/arena.py
- **wt-arena-agents**: agents/solver.py + agents/challenger.py
- **wt-arena-ui**: api.py arena endpoints + dashboard/app/page.tsx Arena panel

## Codex Skills Mapping (Classic)
- Performer → benchmark skill (runs task, measures time)
- Analyzer → analysis skill (LLM improvement suggestion)
- Modifier → mutation skill (LLM code generation)

## Codex Skills Mapping (Arena)
- Challenger → adversarial challenge generation (difficulty escalation)
- Solver → stage-aware code generation (prompt changes per stage)
- evolution/arena.py → co-evolution orchestration (win/loss/stage-up)
Use worktrees to develop each track in parallel isolation.
