# Task Plan

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

## Decisions
- Housekeeping remains a standalone backend subsystem with status/report endpoints, not a Genesis extension
- Added one-shot operator report endpoints for both raw housekeeping and supervisor synthesis
- Supervisor actions remain approval-gated and non-mutating

## Errors Encountered
- `~/.Codex/knowledge/MASTER_PROFILE.md` does not exist in this environment; proceeding with repo-local context
