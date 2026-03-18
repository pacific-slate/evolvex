# EvolveX

EvolveX is an agent evolution workbench: a control room for launching, supervising, and comparing autonomous improvement experiments. Instead of showing "an agent that runs a lot," it makes the operating evidence visible: safety gates, protocol emergence, artifacts, cost, and behavior change over time.

Built for the EvolveX Hackathon with a FastAPI backend, a Next.js dashboard, and OpenAI-powered agents.

## Product Thesis

EvolveX treats agent evolution as an operator problem, not just a prompt problem. The system gives researchers, infra teams, and agent builders one surface for running four autonomy regimes and understanding what changed, why it changed, and whether it should be trusted.

## Experiment Types

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

- It unifies multiple autonomy/evolution regimes behind one operator surface.
- It makes safety visible through checkpointing, sandbox validation, and rollback.
- It captures evidence instead of hiding behavior behind a final answer.
- It is useful even when idle because the dashboard explains what each experiment proves and what evidence will appear when it runs.

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

The dashboard is positioned as a workbench rather than a generic dev console.

- Above the fold: product thesis, run-readiness, and workflow strip
- Left rail: the four experiment types as operator-facing modes
- Center canvas: mode-specific controls and evidence panels
- Right inspector: why it matters, what gets captured, and live snapshot details
- Bottom dock: a human-readable live trace derived from the shared WebSocket feed

The frontend uses the current backend contract as-is:

- REST: classic, arena, bootstrap, and genesis start/stop/reset/status endpoints
- WebSocket: `/ws/evolution`
- Supporting status views: protocol, artifacts, workspace, and recent narrative endpoints

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

The submission-grade workbench remains centered on the four experiment types above.

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
- backend checkout: `/opt/evolvex`
