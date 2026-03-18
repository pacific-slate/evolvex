# EvolveX Submission Brief

## Product Thesis

EvolveX is an agent evolution workbench: a control room for running, supervising, and comparing autonomous improvement experiments. Instead of presenting a black-box agent, it exposes the evidence that matters to operators and judges: safety checks, protocol emergence, artifacts, cost, and behavior change over time.

## Why This Matters

- Researchers can compare multiple autonomy regimes in one interface.
- Infra and reliability teams can observe whether autonomy is happening safely.
- Agent builders can trace what changed, why it changed, and whether it should be trusted.

## What The Workbench Captures

- Mutation trace and sandbox outcomes in Classic
- Stage progression, win/loss record, and emergent protocol in Arena
- Protocol adoption, broker decisions, artifacts, and coordination quality in Bootstrap
- Tool use, file mutations, recent narrative, and capability scores in Genesis

## What Is Real vs Derived

### Real backend surfaces

- REST control and status endpoints for Classic, Arena, Bootstrap, and Genesis
- Shared WebSocket event stream at `/ws/evolution`
- Arena and Bootstrap protocol snapshots
- Bootstrap artifact list
- Genesis workspace file list
- Genesis recent narrative endpoint

### Client-derived presentation

- Human-readable trace rows from raw event payloads
- Unified run-state labels across modes
- Ready-to-run experiment briefs for idle states
- Inspector summaries that translate raw backend fields into operator-facing evidence panels

## Dependencies On Existing Backend Work

The redesigned frontend does not require new backend endpoints.

The main limitations are inherited from the existing contract:

- Classic in-flight progress is still mostly event-derived rather than fully reconstructable from `/api/evolve/status`
- Arena round-by-round story depends on the live event stream, not only the status snapshot
- Genesis narrative is intentionally a recent tail, not the full build log
- Bootstrap and Genesis file panels summarize artifact/workspace metadata but do not inline full file contents

## Recommended Demo Flow

1. Open the workbench and let the hero/rail explain the thesis before starting anything.
2. Show Classic to explain checkpointed mutation and sandbox validation.
3. Switch to Arena to show stage progression and emergent protocol as a different evolution regime.
4. Switch to Bootstrap to make the multi-agent supervision story obvious.
5. Finish in Genesis to show the autonomous builder trace, workspace files, and narrative stream.

## Visual Review Checklist

- Hero reads as a product, not a dev console
- Left rail makes the four modes feel like experiment types, not random tabs
- Right inspector explains why the selected mode matters
- Trace dock stays readable without raw JSON dumps
- Idle states still teach the product story before any live run begins
