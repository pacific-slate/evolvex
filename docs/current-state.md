# EvolveX Current State

## As Of

2026-03-18

## Product Objective

Build a self-iterating agent development ecosystem that can keep improving one agent over time until it either:

- hits the configured budget boundary,
- hits the configured storage boundary,
- or sustains the target capability threshold.

The product is the environment that grows the agent, not the demo of that environment.

## Shipped State

- Persistent growth session control plane is implemented.
- Bootstrap and Genesis now run as resumable internal workers under one lifecycle.
- Operator workspace is centered on the unified growth session, not the old mode dashboard.
- Frontend deploy script supports branch-aware deploys.
- Backend deploy script supports branch-aware deploys and pre-checkout dashboard cleanup.
- Hackathon-era frontend framing has been replaced in the main docs.

## Major Code Paths

- `api.py`: main server and growth-session orchestration
- `evolution/growth_session.py`: durable session persistence and archive logic
- `evolution/bootstrap.py`: early growth/self-formation worker
- `evolution/genesis.py`: later growth/self-improvement worker
- `dashboard/components/growth-workspace.tsx`: main operator surface
- `dashboard/hooks/use-growth-session.ts`: unified session hook
- `scripts/deploy_frontend.sh`: frontend deploy
- `scripts/deploy_backend.sh`: backend deploy

## Active Priorities

1. Keep the persistent growth session as the primary product contract.
2. Strengthen the capability scorecard with better logic/evaluation evidence.
3. Continue reducing legacy mode-era UI assumptions and dead product framing.
4. Make archive browsing and resume/lineage inspection deeper and easier.
5. Keep documentation aligned so a fresh agent can orient instantly.

## Known Structural Realities

- Legacy Classic and Arena subsystems still exist in the repo.
- Housekeeping remains a separate stewardship subsystem.
- Bootstrap and Genesis are still implemented as distinct worker loops internally, but they are now governed by one session model.
- The current scorecard is heuristic and should become more benchmark-grounded over time.

## What A Fresh Agent Should Read First

1. `AGENTS.md`
2. `README.md`
3. `docs/agent-onboarding.md`
4. `docs/current-state.md`
5. `task_plan.md`, `findings.md`, `progress.md`

## What Is Archived

Old hackathon/demo-era docs are moved to `docs/archive/hackathon/` so they remain available as historical context without polluting the current product surface.
