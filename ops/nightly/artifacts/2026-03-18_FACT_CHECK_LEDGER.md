# Fact Check Ledger — 2026-03-18

Validated on `2026-03-18` against the current shipped code and production-ready branch state.

## Repo Claims

| claim | source_url | local_repo_mapping | status | notes |
| --- | --- | --- | --- | --- |
| Arena mode is shipped on current mainline | https://github.com/pacific-slate/evolvex/commit/01f8a79810cc8e5efccee96fd92fe87804eb12ae | `agents/solver.py`, `agents/challenger.py`, `evolution/arena.py`, `api.py` arena routes | landed | Verified in code and passing backend tests. |
| Genesis mode is shipped on current mainline | https://github.com/pacific-slate/evolvex/commit/b143e2adc1f7a8642e95e79626a43a9b7043e4a8 | `agents/meta_agent.py`, `evolution/genesis.py`, `evolution/genesis_tools.py`, `api.py` genesis routes | landed | Verified in code and passing backend tests. |
| Housekeeping endpoints are live on current mainline | https://github.com/pacific-slate/evolvex | `api.py` route contract | unsupported | The codebase contains related experiments elsewhere, but current `api.py` does not ship those routes. |

## External Signals

| claim | source_url | local_repo_mapping | status | notes |
| --- | --- | --- | --- | --- |
| Skills are becoming portable agent infrastructure | https://github.com/anthropics/skills | EvolveX has no first-class promoted capability object yet | validated | Strong fit for durable growth records and promotion metadata. |
| Explicit skill metadata and delegation boundaries are increasingly important | https://github.com/agentskills/agentskills | Current runs lack structured reusable capability state | validated | Supports a promotion queue instead of ad hoc notes. |
| Sessions and tracing are table stakes in agent runtimes | https://github.com/openai/openai-agents-python | EvolveX has live traces but no durable cross-run growth ledger | validated | Good model for durable run surfaces. |
| Persistent HUDs improve operator trust in long-running sessions | https://github.com/jarrodwatts/claude-hud | Current dashboard lacks a cross-run growth console | validated | Supports a VS Code-like operator shell instead of a static demo page. |
