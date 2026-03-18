# Task Plan

## 2026-03-18 Goal
Replace the bounded Bootstrap/Genesis product model with one persistent growth session that continuously evolves a single agent, survives restarts, archives lineage on reset/completion, and exposes tangible outputs and scorecard-driven capability unlocks.

## 2026-03-18 Phases
- [completed] Establish current migration scope, runtime constraints, and compatibility surfaces
- [completed] Implement persistent growth session store and orchestration
- [completed] Replace batch-oriented API/status/event contracts with unified growth-session surfaces
- [completed] Adapt dashboard data normalization and workspace layout to the new session contract
- [completed] Add regression coverage and verify backend/frontend behavior

## Goal
Build a supervisor-grade housekeeping and factory layer for EvolveX that audits repo/worktree state, backup coverage, quality gates, and docs coverage without mutating git state by default.

## Phases
- [completed] Establish planning files and current task framing
- [completed] Inspect current architecture and identify extension points
- [completed] Implement housekeeping supervisor and inspection roles
- [completed] Add tests for audit classification and report aggregation
- [completed] Document operator workflow and verify end-to-end behavior

## Constraints
- Do not interfere with the separate UI worktree
- Keep backend and factory work isolated from dashboard implementation details
- No destructive git actions
- Favor inspection and recommendation over mutation
- Preserve unrelated working tree changes in deploy/test helper files
- Keep one active growth session at a time with durable archive records

## Decisions
- Housekeeping remains a standalone backend subsystem with status/report endpoints, not a Genesis extension
- Added one-shot operator report endpoints for both raw housekeeping and supervisor synthesis
- Supervisor actions remain approval-gated and non-mutating
- Persistent runtime uses SQLite for control-plane state and filesystem for artifacts/bundles
- Overseer acts as a governor only: unlocks, budget/storage enforcement, stall handling, archive/reset policy
- Completion uses a hybrid threshold: scorecard target sustained over time while staying inside budget/storage policy
- Tangible output contract includes runnable agent bundle, artifact registry, checkpoints, and evaluation report

## Errors Encountered
- `~/.Codex/knowledge/MASTER_PROFILE.md` does not exist in this environment; proceeding with repo-local context
- `vitest` rejected `--runInBand`; reran the dashboard test suite with the repo's native `npm test` command
