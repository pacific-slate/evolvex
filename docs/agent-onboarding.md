# EvolveX Agent Onboarding

## Mission

EvolveX is no longer a hackathon demo dashboard. The product objective is to run one persistent growth session that incrementally constructs, tests, improves, and archives a sovereign agent under explicit constraints:

- token / credit budget
- storage budget
- capability score threshold
- overseer-controlled unlock policy

The end goal is not to show short runs. It is to let the system keep working on one agent over time, preserve its progress, and leave behind tangible outputs and lineage.

## Product Model

The active product surface is the **growth session**.

- Exactly one active growth session exists at a time.
- Bootstrap is the early self-formation phase.
- Genesis is the later self-improvement phase.
- The overseer is a governor, not a co-builder.
- The session is durable across restarts.
- Reset or completion archives the lineage instead of erasing it.

Completion is bounded by:

- budget / credits
- storage footprint
- scorecard threshold sustained over time

## Core Systems

### 1. Growth control plane

Primary file: `evolution/growth_session.py`

- SQLite-backed session state
- artifact registry
- checkpoint registry
- event log
- scorecard history
- archive bundle metadata

### 2. Runtime orchestration

Primary file: `api.py`

- unified growth-session endpoints
- shared websocket broadcast
- background growth loop
- restart restoration
- compatibility endpoints for legacy modes

### 3. Bootstrap worker

Primary files:

- `evolution/bootstrap.py`
- `evolution/bootstrap_broker.py`
- `evolution/bootstrap_curriculum.py`
- `evolution/bootstrap_protocol.py`

Responsibility:

- protocol emergence
- broker-gated capability requests
- durable artifact creation
- stage progression

### 4. Genesis worker

Primary files:

- `evolution/genesis.py`
- `evolution/genesis_tools.py`
- `evolution/genesis_sandbox.py`
- `agents/meta_agent.py`

Responsibility:

- autonomous building
- tool use
- workspace mutation
- self-assessment
- checkpointed continuation

### 5. Operator workspace

Primary files:

- `dashboard/app/page.tsx`
- `dashboard/components/growth-workspace.tsx`
- `dashboard/hooks/use-growth-session.ts`
- `dashboard/lib/growth-types.ts`

Responsibility:

- show current session state
- expose controls for start/pause/resume/reset/archive
- render scorecard, artifacts, checkpoints, and lineage

### 6. Secondary subsystems

Still present but no longer the primary product:

- Classic mode
- Arena mode
- Housekeeping
- Housekeeping supervisor

These remain useful as internal evaluators, reference systems, or maintenance tools.

## Persistence Layout

Growth session state lives under `.growth/`.

- SQLite DB: control-plane truth
- `active/`: active session manifest
- `archives/`: immutable archived bundles

Agent workspaces:

- Bootstrap workspace: `.bootstrap_workspace/`
- Genesis workspace: `GENESIS_WORKSPACE` or `/opt/evolvex/workspace`

## API Contract

Primary endpoints:

- `POST /api/growth/session/start`
- `POST /api/growth/session/pause`
- `POST /api/growth/session/resume`
- `POST /api/growth/session/reset`
- `POST /api/growth/session/archive`
- `GET /api/growth/session`
- `GET /api/growth/session/artifacts`
- `GET /api/growth/session/scorecard`
- `GET /api/growth/session/constraints`
- `GET /api/growth/session/checkpoints`
- `GET /api/growth/session/events`
- `GET /api/growth/archive`

WebSocket:

- `/ws/evolution`

The UI treats websocket traffic as a live signal and refresh trigger for persisted state.

## Verification Commands

Backend:

```bash
source .venv/bin/activate && python -m pytest tests/ -q
```

Frontend:

```bash
cd dashboard && npm test && npm run build
```

## Operating Rules

- Do not re-center the product around demo narratives or short runs.
- Do not treat round count as the product progress model.
- Do not bypass checkpointing or artifact persistence.
- Do not let the overseer silently co-author the agent.
- Prefer updating `README.md`, `AGENTS.md`, and `docs/current-state.md` when the product contract changes.
