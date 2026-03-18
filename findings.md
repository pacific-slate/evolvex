# Findings

## 2026-03-18

- Current product semantics are still bounded jobs: Bootstrap uses `rounds` and Genesis uses `max_iterations`.
- `api.py` keeps subsystem truth mostly in memory, which prevents true restart-safe continuity for the agent growth product.
- Bootstrap already contains the right raw primitives for the future product: staged capability unlocks, broker-governed actions, durable artifacts, checkpointing, and startup restore.
- Genesis already contains the right raw primitives for later-stage autonomy: workspace artifacts, MetaAgent checkpointing, tool-driven phase detection, and budget tracking.
- The main architectural gap is not capability; it is unifying these primitives under one durable session model with archive/restore semantics and a scorecard-driven overseer.
- The dashboard currently consumes mode-specific status and event payloads, so backend contract changes will need a normalization rewrite rather than a cosmetic field rename.
- The fastest safe migration path is to keep Bootstrap and Genesis as internal workers, then run them in resumable chunks under a single persistent growth-session controller.
- Bootstrap needed a `continuous` mode so chunk boundaries checkpoint without pretending the session is complete.
- Genesis needed both `continuous` chunk completion and tool gating so the overseer can actually withhold power instead of just describing it in the UI.
- A composite `GET /api/growth/session` payload is enough to drive the new operator workspace without preserving the old mode dashboard contract.
- Top-level hackathon-era docs (`submission.md`, `demo_script.md`, `codex_plan.md`) are historical context now and should live under an archive path rather than the active repo root.

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
