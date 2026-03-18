# Progress

## 2026-03-18

- Reframed the task from UI cleanup to product-runtime migration.
- Confirmed the target product model: one persistent growth session, one active run at a time, SQLite + filesystem persistence, passive overseer, scorecard-based unlocks, and durable archived lineage.
- Began implementation sequencing around backend control-plane changes before frontend adaptation.
- Added `evolution/growth_session.py` as the durable control-plane for active session state, events, artifacts, checkpoints, scorecards, and archives.
- Updated `evolution/bootstrap.py` and `evolution/genesis.py` so both can run as resumable chunks under the growth-session controller.
- Extended `api.py` with unified growth-session endpoints, restart-safe bootstrap/genesis status helpers, and a single background growth loop.
- Replaced the dashboard entrypoint with a single-session growth workspace driven by `/api/growth/session`.
- Added `tests/test_growth_session.py` and verified backend + frontend regression checks.
- Added durable onboarding docs under `docs/` and archived obsolete hackathon/demo docs into `docs/archive/hackathon/`.

## 2026-03-17

- Created persistent planning files for the housekeeping/factory build.
- Confirmed the task is a backend/factory extension, not a dashboard task.
- Preparing parallel inspection of architecture and repo/runtime audit needs before implementation.
- Reviewed `api.py`, `agents/base_agent.py`, and `evolution/genesis_tools.py` to identify integration patterns for a new supervisor/reporting subsystem.
- Confirmed the active branch already contains a first-pass housekeeping subsystem and passing tests.
- Switched from greenfield implementation to hardening review: tightening policy, report shape, and operator interface.
- Hardened `evolution/housekeeping.py` with timestamps, stricter repo policy, richer quality checks, and recovery-surface evidence.
- Added `evolution/housekeeping_supervisor.py` plus new API routes for supervisor start/stop/reset/status and one-shot report access.
- Added supervisor coverage in `tests/test_housekeeping_supervisor.py` and expanded `tests/test_housekeeping.py`.
- Verified Python compile and full backend suite: `31 passed`.
