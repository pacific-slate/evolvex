# Primary Build Plan — Verified Growth Registry

## Goal

Turn validated post-run research into durable registry records so EvolveX can compound knowledge, promotion decisions, and UI state across runs instead of leaving everything trapped in markdown notes.

## Why This Build First

- It closes the biggest verified gap in the shipped repo.
- It creates the substrate required for a promotion queue and growth HUD.
- It gives the system a tangible output path for future Genesis and nightly work.

## Shipped Direction

- Append-only JSONL registry under `ops/nightly/registry/<run_id>/`
- Stable record families for:
  - `frontier_signals`
  - `growth_artifacts`
  - `claim_checks`
  - `promotion_candidates`
- Read API for latest summary, run bundles, recent runs, and promotion queue
- Genesis completion auto-registration so builder runs create durable review artifacts

## Near-Term Build Sequence

1. Land the registry read/write helpers and tests.
2. Seed the registry with the validated March 18 rerun.
3. Expose a growth HUD and promotion queue in the operator console.
4. Feed future builder runs into the registry automatically.

## Acceptance Signal

The system is no longer a one-run dashboard. It can show what was learned, what is promotable, what is still blocked, and what a completed Genesis run actually produced.
