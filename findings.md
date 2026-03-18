# Findings

## 2026-03-17

- Current repo already supports four independent modes via FastAPI and a shared WebSocket stream.
- Remote split deployment is live and healthy, but backend deploys can be blocked by dirty state in `/opt/evolvex`.
- The current backend/runtime surface has no housekeeping or supervisory audit mode yet.
- The project already uses worktrees in practice, so worktree-aware auditing should be first-class.
- `api.py` already mirrors long-running subsystem state into lightweight status endpoints, which is the cleanest pattern to extend for housekeeping.
- `evolution/genesis_tools.py` already defines a tool-contract style that can be reused conceptually for inspector outputs, but housekeeping should stay outside Genesis and inspect the repo directly.
- The codebase favors functions over classes for orchestration modules, so the housekeeping layer should be a small functional subsystem with explicit state and report schemas.
- A first-pass housekeeping implementation already exists on the active branch: `evolution/housekeeping.py`, status state in `api.py`, README/AGENTS updates, and a passing `tests/test_housekeeping.py`.
- The existing implementation is functionally sound but can still be strengthened around policy strictness, operator-facing report shape, and on-demand audit ergonomics.
- Repo hygiene policy is now stricter: untracked source files in active areas are treated as a blocking repo issue, not a soft warning.
- Housekeeping snapshots now include operator-facing report fields: backup coverage summary, active risks, and recommended next actions.
- Frontend validation visibility now covers configured `lint`, `test`, `tsc`, and `build` surfaces when dependencies are installed.
- Runtime recovery visibility now includes checkpoint evidence for classic, bootstrap, and genesis recovery surfaces.
- A second layer now exists in `evolution/housekeeping_supervisor.py`, which converts audit snapshots into approval-gated planned actions.
