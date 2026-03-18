# EvolveX Dashboard

This app is the operator workspace for the persistent EvolveX growth session. It is designed to show one active agent-construction process at a time, with durable state, tangible outputs, scorecard progression, and archived lineage.

## What The Frontend Does

- Renders one active growth session as the primary product surface
- Shows the lifecycle path, unlocked capabilities, budget/storage envelope, and current objective
- Keeps artifacts, checkpoints, scorecard history, and event evidence visible without page scrolling
- Surfaces archive lineage so completed or reset sessions remain inspectable
- Uses the growth-session payload as the main UI contract

## Local Development

From the repo root:

```bash
cd dashboard
npm install
npm run dev
```

The dashboard defaults to:

- `http://localhost:8000` for REST when opened on `localhost`
- `ws://localhost:8000/ws/evolution` for the shared event stream

Optional overrides:

- `NEXT_PUBLIC_EVOLVEX_API_URL`
- `NEXT_PUBLIC_EVOLVEX_WS_URL`

## Useful Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Frontend Structure

- `app/page.tsx`: thin composition layer for the workbench
- `app/layout.tsx`: metadata and font setup
- `app/globals.css`: global visual system and shell styling
- `hooks/use-growth-session.ts`: unified growth-session API, WebSocket refresh, and operator actions
- `lib/growth-types.ts`: persistent growth-session frontend contract types
- `components/growth-workspace.tsx`: single-session operator workspace
- `hooks/use-evolvex-dashboard.ts`: legacy mode-oriented hook retained for compatibility/reference
- `lib/evolvex-types.ts`: shared frontend contract types
- `lib/runtime.ts`: runtime API/WS resolution
- `lib/evolvex-format.ts`: mode copy, themes, and human-readable trace formatting
- `lib/evolvex-normalize.ts`: overview, inspector, rail-card, and trace derivation helpers
- `components/workbench-shell.tsx`, `components/mode-sections.tsx`, `components/event-dock.tsx`: legacy mode-era shell components kept in repo while the growth workspace becomes primary

## Data Contract Notes

The frontend now prefers the unified growth-session contract:

- `GET /api/growth/session` provides the active session, artifact registry, checkpoints, recent events, and scorecard history.
- Growth actions use `POST /api/growth/session/start|pause|resume|reset|archive`.
- WebSocket updates still arrive over `/ws/evolution`, but the UI treats them as refresh triggers for persisted session state.
- Legacy mode endpoints remain available, but they are no longer the primary dashboard contract.

## Test Coverage

The dashboard includes lightweight Vitest coverage for the pure runtime/format/normalization helpers:

- `lib/evolvex-contract.test.ts`

These tests verify the frontend-only contract layer without introducing a heavy component-test stack.
