# EvolveX Arena Mode — Implementation Spec

> Self-contained spec for implementing Adversarial Co-evolution Arena mode.
> Codex agents can execute this directly. No external context needed.

## Context

EvolveX currently has **Classic mode**: Performer → Analyzer → Modifier loop.
**Arena mode** adds: Challenger generates problems, Solver evolves to beat them.
Both agents co-evolve across Piaget-inspired cognitive stages.

## Cognitive Stages

| Stage | ID | Name | Solver behavior |
|---|---|---|---|
| 0 | REACTIVE | Reactive | Apply first thing that seems reasonable |
| 1 | REFLECTIVE | Reflective | Weigh trade-offs, verify edge cases |
| 2 | STRATEGIC | Strategic | Plan multi-step, consider complexity |
| 3 | META_COGNITIVE | Meta-cognitive | Reason about reasoning strategy |

**Graduation**: 3 consecutive wins → Solver promotes to next stage + Challenger escalates.

## Files

New files (5):
- evolution/stages.py      ~60 lines
- evolution/challenges.py  ~80 lines
- agents/solver.py         ~90 lines
- agents/challenger.py     ~80 lines
- evolution/arena.py       ~110 lines

Modified files (2):
- api.py                   +50 lines
- dashboard/app/page.tsx   +150 lines

Unchanged: agents/base_agent.py, evolution/sandbox.py, evolution/checkpoint.py,
           evolution/fitness.py, evolution/loop.py, agents/performer.py,
           agents/analyzer.py, agents/modifier.py

## Arena Event Schema

```
arena_started         { solver_stage, difficulty, rounds }
arena_round_start     { round, of, stage, difficulty }
arena_challenge       { description, difficulty, hint }
arena_solver_attempt  { stage, code_preview }
arena_win             { round, consecutive_wins, stage }
arena_loss            { round, reason, stage, consecutive_wins }
arena_stage_up        { new_stage, new_stage_id, total_wins }
arena_difficulty_up   { new_difficulty }
arena_complete        { solver_stage, solver_stage_id, total_wins, total_losses, win_rate }
arena_stopped         { round }
arena_reset           {}
```

## Build Order

1. evolution/stages.py (pure enums/logic, no deps)
2. evolution/challenges.py (stdlib only)
3. agents/solver.py (imports stages.py)
4. agents/challenger.py (imports challenges.py)
5. evolution/arena.py (imports solver + challenger + challenges)
6. api.py (add imports, lifespan init, 4 new endpoints)
7. dashboard/app/page.tsx (Arena panel, mode toggle, stage bar)

## Verification

```bash
python3 -c "
import ast
for f in ['evolution/stages.py','evolution/challenges.py','agents/solver.py','agents/challenger.py','evolution/arena.py']:
    ast.parse(open(f).read())
    print('OK', f)
"
source .venv/bin/activate && python -m pytest tests/ -v
source .venv/bin/activate && python -c "from evolution.arena import run_arena; print('arena imports clean')"
cd dashboard && npx tsc --noEmit 2>&1 | head -20
```

## Fallback Plan

1. Challenger.generate() already falls back to hardcoded challenges (4 tiers)
2. Drop META_COGNITIVE stage — comment out in stages.py, set WINS_TO_GRADUATE=2
3. For demo: force Challenger to always use hardcoded fallback

## Notes

- Arena and Classic modes are fully independent
- Same WebSocket endpoint carries both event streams
- stop_flag pattern (mutable list[bool]) mirrors existing _stop_requested bool in api.py
- Challenger uses response_format={"type": "json_object"} for structured OpenAI output
