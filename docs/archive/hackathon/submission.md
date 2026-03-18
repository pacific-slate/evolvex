# EvolveX Submission Brief

## Product Thesis

EvolveX is a Bootstrap workbench: a control room for watching two peer agents earn coordination and capability instead of getting both for free on turn one. Instead of presenting a black-box agent, it exposes the evidence that matters to operators and judges: protocol emergence, broker decisions, artifacts, cost, and behavior change over time.

## Why This Matters

- Agent builders can see whether coordination actually emerged.
- Infra and reliability teams can observe whether autonomy is happening under constraints.
- Researchers can inspect shared language formation instead of only final outputs.

## What The Workbench Captures

- Protocol proposals, adoptions, pruning, and stable token growth
- Peer message flow and brokered capability decisions
- Artifact creation inside the bootstrap workspace
- Assessment scores for collaboration, language, traceability, and autonomy
- Cost and stage progression over time

## What Is Real vs Derived

### Real backend surfaces used in the demo

- REST control and status endpoints for Bootstrap
- Shared WebSocket event stream at `/ws/evolution`
- Bootstrap protocol snapshot
- Bootstrap artifact list
- Bootstrap checkpoint/resume behavior

### Client-derived presentation

- Human-readable trace rows from raw event payloads
- Stage ladder and operator-facing evidence summaries
- Ready-to-run experiment brief for idle state
- Inspector summaries that translate raw backend fields into operator-facing evidence panels

## Supporting Context

Classic, Arena, and Genesis still exist in the product as supporting regimes. They help explain the broader EvolveX thesis, but the demo and turn-in story should stay centered on Bootstrap.

## Dependencies On Existing Backend Work

The Bootstrap-first frontend does not require new backend endpoints.

The main limitations are inherited from the existing Bootstrap contract:

- The strongest story depends on the live event stream, not only the status snapshot.
- Artifact panels summarize metadata rather than inlining full file contents.
- Checkpointing and audit logging are local prototype features, not distributed infrastructure.

## Recommended Demo Flow

1. Open the workbench and let the hero explain the problem: most agents get tools immediately.
2. Show the Bootstrap stage ladder and explain earned capability.
3. Start or resume a Bootstrap run.
4. Focus on protocol emergence, broker decisions, and artifact growth.
5. End on the assessment panel and evidence dock.

## Visual Review Checklist

- Hero reads as a Bootstrap product, not a generic agent dashboard
- Left rail clearly makes Bootstrap the hero and demotes the other modes
- Right inspector explains why Bootstrap matters
- Trace dock stays readable without raw JSON dumps
- Idle state still teaches the product story before the run begins
