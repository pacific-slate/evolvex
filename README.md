# EvolveX

EvolveX is a persistent agent growth environment. The system runs one long-lived growth session at a time, continuously building and improving a single agent under budget, storage, and capability gates while preserving checkpoints, artifacts, and archived lineage.

Built with a FastAPI backend, a Next.js operator workspace, and OpenAI-powered agent workers.

## Product Thesis

Most agent systems expose short runs and hide the real developmental process. EvolveX treats agent construction as a durable operating environment instead: the system captures phase progression, capability unlocks, checkpoints, artifacts, scorecards, and archive bundles so you can leave, return, and continue the same growth process.

## Persistent Growth Session

The primary product surface is the growth session.

- One active growth session exists at a time.
- The overseer is a governor, not a co-builder.
- Bootstrap and Genesis now operate as internal workers inside the same lifecycle.
- Capability unlocks are stage-gated and persisted.
- Tangible outputs are first-class: runnable agent files, checkpoint records, artifact registry, evaluation state, and archived lineage.

The session runs until:

- the user pauses it,
- the overseer resets or archives it,
- budget or storage policy caps it,
- or the weighted scorecard sustains the completion threshold.

## Internal Regimes

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

- What it does: two peers start with minimal priors, brokered tools, and staged capability unlocks, then coordinate and invent an operating language.
- Why it matters: supplies the early self-formation phases of the persistent growth session.
- What EvolveX captures: protocol proposals/adoption, peer messages, broker decisions, artifacts, cost, and collaboration/autonomy assessments.

### Genesis

Autonomous builder.

- What it does: a single agent researches, plans, uses tools, edits files, and self-assesses while constructing outputs in a workspace.
- Why it matters: supplies the later self-improvement phases of the persistent growth session.
- What EvolveX captures: phase changes, tool calls/results, file mutations, recent narrative, cost, and capability scores.

## Growth Runtime

The active session now has a durable control plane:

- SQLite stores session state, events, checkpoints, artifact records, scorecard history, and archive metadata.
- Filesystem storage holds the active workspaces and archived session bundles.
- The API restores the active session on restart and resumes the growth loop when needed.
- Bootstrap checkpoints and Genesis checkpoints are both surfaced through one growth-session contract.

## Safety Model

- Mutations never apply directly without sandbox validation.
- Every mutation path checkpoints state before modification.
- The overseer can gate or withhold tool access, but does not write artifacts itself.
- Failed or degraded changes can be discarded, paused, archived, or reset.
- The operator workspace consumes the same persisted session surfaces the backend uses as its source of truth.

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
FastAPI API   -> mode endpoints plus unified growth-session control plane
Next.js UI    -> single-session operator workspace
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

## API Surface

The persistent growth session is exposed through:

```bash
POST /api/growth/session/start
POST /api/growth/session/pause
POST /api/growth/session/resume
POST /api/growth/session/reset
POST /api/growth/session/archive
GET  /api/growth/session
GET  /api/growth/session/artifacts
GET  /api/growth/session/scorecard
GET  /api/growth/session/constraints
GET  /api/growth/session/checkpoints
GET  /api/growth/session/events
GET  /api/growth/archive
GET  /api/growth/archive/{session_id}
```

Legacy Classic, Arena, Bootstrap, and Genesis endpoints remain available as internal regimes and compatibility surfaces.

## Dashboard

The frontend is now a single-session operator workspace.

- Top strip: live session identity, status, budget, storage, and current objective
- Left rail: lifecycle path plus control envelope
- Center canvas: mindstate, artifacts, scorecard, and event evidence
- Right inspector: outputs, checkpoint recovery, and archived lineage

The workspace consumes the unified growth-session payload first and treats the old mode-specific endpoints as supporting infrastructure.

## Supporting Services

The repo also includes a non-primary factory control layer for repo stewardship:

- Housekeeping audits: branch/worktree health, checkpoint readiness, docs drift, and validation visibility
- Housekeeping supervisor: approval-gated operator reports and planned next actions

Endpoints:

```bash
POST /api/housekeeping/start
POST /api/housekeeping/stop
POST /api/housekeeping/reset
GET  /api/housekeeping/status
GET  /api/housekeeping/report

POST /api/housekeeping/supervisor/start
POST /api/housekeeping/supervisor/stop
POST /api/housekeeping/supervisor/reset
GET  /api/housekeeping/supervisor/status
GET  /api/housekeeping/supervisor/report
```

The growth session is the product. Housekeeping remains a secondary repo stewardship surface.

## Split Deployment

Frontend and backend can be deployed independently.

- Frontend-only deploy updates the dashboard checkout and restarts only the Next server on port `3002`
- Backend-only deploy updates the agent/API checkout and restarts only FastAPI on port `8000`
- Frontend deploys should not interrupt active Classic, Arena, Bootstrap, or Genesis runs

```bash
./scripts/deploy_frontend.sh
EVOLVEX_FRONTEND_BRANCH=codex/app ./scripts/deploy_frontend.sh
./scripts/deploy_backend.sh
```

Default remote layout:

- frontend checkout: `/opt/evolvex-frontend`
- backend checkout: `/opt/evolvex`
