# EvolveX

EvolveX is an agent evolution workbench, but the turn-in story is `Bootstrap`: a mode where two peer agents start with messaging and scratch space only, then have to earn stronger capability as they form a shared protocol, produce artifacts, and survive review.

Built for the EvolveX Hackathon with a FastAPI backend, a Next.js dashboard, and OpenAI-powered agents.

## Product Thesis

Most agent demos get tools immediately and ask you to trust the rest. EvolveX treats autonomy as an operator problem instead: the system captures protocol emergence, stage-gated capability unlocks, broker decisions, artifacts, and cost so you can inspect what really happened.

## Hero Mode: Bootstrap

`Bootstrap` is the product surface to demo.

- Two peer agents begin with messaging and scratch space only.
- A broker gates every capability request.
- A stage curriculum unlocks stronger tools over time.
- A protocol layer tracks whether invented tokens are merely proposed, adopted by the other peer, or stable through repeated use.
- The dashboard turns all of that into a readable evidence stream instead of a wall of raw events.

## Supporting Regimes

### Classic

Self-modifying benchmark loop.

- What it does: benchmarks a performer, analyzes weak spots, proposes a mutation, checkpoints state, sandboxes the change, then applies or rejects it.
- Why it matters: proves that self-improvement can be measurable, auditable, and safety-gated.
- What EvolveX captures: fitness deltas, mutation previews, checkpoint/rollback decisions, sandbox pass/fail, and generation history.

### Arena

Adversarial challenge ladder.

- What it does: a challenger generates harder tasks while a solver tries to win enough rounds to graduate through cognitive stages.
- Why it matters: shows progression, not just score, and surfaces how reasoning behavior changes under pressure.
- What EvolveX captures: stage progression, win/loss trace, challenge difficulty, emergent protocol tokens, and compression history.

### Bootstrap

Multi-agent autonomy with emergent protocol.

- What it does: two peers start with minimal priors, brokered tools, and staged capability unlocks, then try to coordinate and invent an operating language.
- Why it matters: demonstrates supervision of agent societies, not just single loops.
- What EvolveX captures: protocol proposals/adoption, peer messages, broker decisions, artifacts, cost, and collaboration/autonomy assessments.

### Genesis

Autonomous builder.

- What it does: a single agent researches, plans, uses tools, edits files, and self-assesses while constructing outputs in a workspace.
- Why it matters: turns opaque builder behavior into a readable operational trace.
- What EvolveX captures: phase changes, tool calls/results, file mutations, recent narrative, cost, and capability scores.

## Why This Is A Tool

- It makes autonomy observable instead of magical.
- It captures evidence instead of hiding behavior behind a final answer.
- It gives Bootstrap a clear supervision story: shared language, earned capability, and inspectable artifacts.
- The other modes exist as comparison points, not as the main pitch.

## Safety Model

- Mutations never apply directly without sandbox validation.
- Every mutation path checkpoints state before modification.
- Failed or degraded changes can be discarded or rolled back.
- Fitness remains the decision signal in the classic loop.
- The dashboard consumes the same REST and WebSocket surfaces the backend uses as its source of truth.

## Architecture

```text
Classic mode
Performer -> benchmark execution
Analyzer  -> improvement suggestions
Modifier  -> mutation proposals
Sandbox   -> isolated validation
Checkpoint -> save/restore for rollback
Loop      -> full cycle orchestration

Arena mode
Solver      -> stage-aware problem solving
Challenger  -> difficulty escalation
Protocol    -> token emergence and compression tracking
Arena loop  -> win/loss/stage-up orchestration

Bootstrap mode
Peer A + Peer B -> symmetric agents with minimal priors
Broker          -> stage-gated tool execution and audit trail
Protocol        -> shared operating language
Curriculum      -> capability unlocks and harder objectives

Genesis mode
Builder agent -> research, implementation, tool use, self-assessment
Workspace     -> file outputs and recent build narrative

Shared platform
FastAPI API   -> control endpoints + shared WebSocket event stream
Next.js UI    -> workbench, inspector panels, and live trace dock
```

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/YOUR_USERNAME/evolvex.git
cd evolvex

# 2. Python backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Set API credentials
cp .env.example .env
# edit .env -> set OPENAI_API_KEY and OPENAI_MODEL

# 4. Start backend
uvicorn api:app --reload --port 8000

# 5. Start dashboard (new terminal)
cd dashboard
npm install
npm run dev
# -> http://localhost:3000
```

## Dashboard

The dashboard is positioned as a VS Code-like operator console rather than a generic dev console.

- Above the fold: product thesis, run-readiness, and workflow strip
- Growth console: registry HUD, recent runs, latest run detail, and promotion queue
- Left rail: the four experiment types as operator-facing modes
- Center canvas: mode-specific controls and evidence panels
- Right inspector: why it matters, what gets captured, and live snapshot details
- Bottom dock: a human-readable live trace derived from the shared WebSocket feed

The frontend uses the current backend contract as-is:

- REST: classic, arena, bootstrap, and genesis start/stop/reset/status endpoints
- Growth registry: `/api/growth/latest`, `/api/growth/runs`, `/api/growth/runs/{run_id}`, `/api/growth/promotion-queue`, and `POST /api/growth/reality-contract/verify`
- WebSocket: `/ws/evolution`
- Supporting status views: protocol, artifacts, workspace, and recent narrative endpoints

## Growth Registry

This branch now includes a lightweight append-only growth registry foundation for post-submission research, promotion work, and durable Genesis outputs.

- Canonical storage root: `ops/nightly/registry/`
- Format: one JSONL file per record family under `ops/nightly/registry/<run_id>/`
- Record families:
  - `frontier_signals`
  - `growth_artifacts`
  - `claim_checks`
  - `promotion_candidates`
- Seeded public-safe validated rerun: `2026-03-18-validated-rerun`
- Import bundle: `ops/nightly/bundles/2026-03-18-validated-rerun.json`
- Import command: `python3 scripts/import_growth_bundle.py ops/nightly/bundles/2026-03-18-validated-rerun.json --replace-run`
- Reality contract: `ops/nightly/contracts/reality_contract.json`
- Truth-gate refresh command: `python3 scripts/verify_reality_contract.py --run-id 2026-03-18-validated-rerun`

Read endpoints:

```bash
GET /api/growth/latest
GET /api/growth/runs
GET /api/growth/runs/{run_id}
GET /api/growth/promotion-queue
POST /api/growth/reality-contract/verify
```

Write paths:

- `evolution/growth_registry.py` exposes append/import helpers for durable records
- `scripts/import_growth_bundle.py` imports a structured validated run bundle
- `evolution/reality_contract.py` verifies product claims against the current branch
- `scripts/verify_reality_contract.py` refreshes `claim_checks` from the repo-backed reality contract
- Genesis completion automatically writes a durable growth artifact and review candidate into the registry
- The operator console can trigger the truth gate and refresh claim status without leaving the dashboard

## Experimental Branches

This private mirror still has branch-only experiments that are not shipped by the current API surface:

- `origin/codex/app`: housekeeping audit and housekeeping supervisor work
- `origin/agent-suite-lab`: genesis memory experiments

Do not describe those surfaces as shipped functionality on this branch until they are validated and landed.

## Split Deployment

Frontend and backend can be deployed independently.

- Frontend-only deploy updates the dashboard checkout and restarts only the Next server on port `3002`
- Backend-only deploy updates the agent/API checkout and restarts only FastAPI on port `8000`
- Frontend deploys should not interrupt active Classic, Arena, Bootstrap, or Genesis runs

```bash
./scripts/deploy_frontend.sh
./scripts/deploy_backend.sh
```

Default remote layout:

- frontend checkout: `/opt/evolvex-frontend`
- backend checkout: `/opt/evolvex-post-submission-dev`
