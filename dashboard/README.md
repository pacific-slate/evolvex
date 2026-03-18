# EvolveX Dashboard

This app is the submission-grade frontend for the EvolveX workbench. For turn-in purposes, it is intentionally centered on `Bootstrap`: the staged multi-agent coordination mode with brokered capability unlocks and visible protocol formation.

## What The Frontend Does

- Positions the app as a Bootstrap-first agent workbench
- Presents Classic, Arena, and Genesis as supporting experiment regimes
- Normalizes inconsistent backend payloads into readable UI state
- Keeps the live event stream readable by formatting traces instead of dumping raw JSON
- Explains the product even when no run is active

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
- `hooks/use-evolvex-dashboard.ts`: API, WebSocket, actions, and derived state
- `lib/evolvex-types.ts`: shared frontend contract types
- `lib/runtime.ts`: runtime API/WS resolution
- `lib/evolvex-format.ts`: mode copy, themes, and human-readable trace formatting
- `lib/evolvex-normalize.ts`: overview, inspector, rail-card, and trace derivation helpers
- `components/workbench-shell.tsx`: hero, rail, inspector, and layout shell
- `components/mode-sections.tsx`: mode-driven evidence panels and controls
- `components/event-dock.tsx`: persistent trace dock

## Data Contract Notes

The frontend intentionally builds on the current backend contract rather than waiting for new APIs.

- Classic uses generic event names like `started` and `complete`, so the frontend tags them as Classic activity.
- Genesis exposes `running: boolean` while other modes use `status` strings; the hook normalizes that into shared run-state.
- Arena and Bootstrap protocol payloads differ slightly, so the UI formats them into a common evidence story.
- Several mode summaries are derived client-side from recent events because the snapshot endpoints are intentionally incomplete for in-flight progress.

## Test Coverage

The dashboard includes lightweight Vitest coverage for the pure runtime/format/normalization helpers:

- `lib/evolvex-contract.test.ts`

These tests verify the frontend-only contract layer without introducing a heavy component-test stack.
