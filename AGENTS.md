# EvolveX — Codex Agent Context

## What This Is
Self-modifying agent evolution system centered on one persistent growth session:

**Growth session** — One active long-running agent construction process. Bootstrap and Genesis now operate as internal phases of the same durable lifecycle with checkpoints, artifacts, scorecards, and archived lineage.

The repo still contains these supporting regimes:

**Classic mode** — Three agents (Performer, Analyzer, Modifier) in a loop:
benchmark → analyze → propose mutation → sandbox validate → apply or rollback.

**Arena mode** — Adversarial co-evolution across Piaget-inspired cognitive stages.
Challenger generates problems → Solver attempts them → win/loss → 3 consecutive wins = stage up.
Full spec: `arena_spec.md`

**Bootstrap mode** — Two peers bootstrap a shared operating language and progressively unlock brokered capabilities.

**Genesis mode** — A single autonomous builder iterates through research, implementation, validation, and assessment.

**Housekeeping mode** — Non-mutating repo stewardship for branch hygiene, checkpoint readiness, docs drift, and validation visibility.

**Housekeeping supervisor** — Approval-gated operator layer that turns housekeeping audits into planned actions and compact factory reports.

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
- `api.py` — FastAPI server, WebSocket broadcast, legacy mode endpoints, and unified growth-session control plane
- `evolution/growth_session.py` — durable session state, SQLite control plane, artifact/checkpoint registry, scorecards, and archive bundles
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
- `evolution/bootstrap.py` — bootstrap worker that can now run as resumable chunks under the growth session
- `evolution/genesis.py` — genesis worker that can now run as resumable chunks under the growth session
- `evolution/housekeeping.py` — repo/worktree audits, checkpoint recommendations, validation snapshots
- `evolution/housekeeping_supervisor.py` — supervisor report synthesis and approval-gated action planning
- `tests/test_sandbox.py` + `tests/test_fitness.py` — 13 passing tests
- `tests/test_growth_session.py` — persistent growth-session coverage
- `tests/test_housekeeping.py` — housekeeping audit coverage
- `tests/test_housekeeping_supervisor.py` — supervisor report and action planning coverage
- `docs/archive/hackathon/codex_plan.md` — archived Classic-mode hackathon execution plan
- `arena_spec.md` — Arena mode full spec: architecture, event schema, build order

## Event Schema

### Growth session (growth_session.py + api.py → WS)
```
growth_session_started   { session_id, phase }
growth_session_paused    { session_id, phase }
growth_phase_changed     { session_id, phase, unlocked_capabilities }
growth_scorecard_updated { session_id, scorecard }
growth_checkpoint_saved  { session_id, checkpoints }
growth_budget_warning    { session_id, state, budget, storage }
growth_completed         { session_id, scorecard, outputs }
growth_archived          { session_id, archive_path }
growth_session_reset     { session_id, archived_session_id }
```

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

### Housekeeping mode (housekeeping.py → api.py → WS)
```
housekeeping_started                 { repo_root, interval_seconds, run_quality_checks, max_cycles }
housekeeping_cycle_start             { cycle }
housekeeping_audit                   { cycle, overall_state, auditors, worktrees, checkpoint_recommendation }
housekeeping_warn                    { cycle, scope, summary, evidence }
housekeeping_block                   { cycle, scope, summary, evidence }
housekeeping_checkpoint_recommended  { cycle, worktrees, summary }
housekeeping_complete                { cycles, overall_state }
housekeeping_stopped                 { cycle }
housekeeping_reset                   {}
housekeeping_error                   { message, phase }
```

### Housekeeping supervisor mode (housekeeping_supervisor.py → api.py → WS)
```
housekeeping_supervisor_started         { repo_root, interval_seconds, run_quality_checks, max_cycles }
housekeeping_supervisor_cycle_start     { cycle }
housekeeping_supervisor_report          { cycle, overall_status, active_risks, planned_actions, ... }
housekeeping_supervisor_action_planned  { cycle, scope, action_type, approval_required, summary, reason, suggested_command }
housekeeping_supervisor_complete        { cycles, overall_status, planned_action_count }
housekeeping_supervisor_stopped         { cycle }
housekeeping_supervisor_reset           {}
housekeeping_supervisor_error           { message, phase }
```

## Rules
- Never apply code mutations without sandbox validation first
- Every mutation gets a checkpoint before it runs
- All evolution events must be yielded from loop.py so the dashboard sees them
- The product runtime is the persistent growth session; do not re-center the UI on short-lived mode demos
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

## Read Order

When orienting to the current product state, read in this order:

1. `README.md`
2. `docs/agent-onboarding.md`
3. `docs/current-state.md`
4. `task_plan.md`
5. `findings.md`
6. `progress.md`

## Worktree Strategy (for parallel Codex development)
See `docs/archive/hackathon/codex_plan.md` for the archived Classic-mode hackathon task breakdown.
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
