# EvolveX — Codex Execution Plan
# Hackathon: March 17, 2pm–midnight | Submission: 3-min demo video

## What We're Building
Self-modifying agent evolution system. Three agents (Performer, Analyzer, Modifier) loop:
benchmark → analyze → checkpoint → mutate → sandbox validate → apply or rollback.
The demo shows a bubble sort agent evolving into an optimized sort in real-time.

## Judging Criteria (weight order)
1. Innovation & Frontier AI — 30pts  ← self-modifying agents IS the innovation
2. Market Potential — 30pts          ← "AI that improves itself" = huge market story
3. Technical Execution — 20pts       ← reliability, sandbox safety, real fitness scores
4. Presentation — 20pts              ← dashboard must look polished in the video

## Current State (already built, DO NOT re-implement)
- `api.py` — FastAPI server, WebSocket broadcast, `/api/evolve/start`, `/api/evolve/status`
- `agents/performer.py` — Executes benchmark task (bubble sort), holds evolvable `task_code`
- `agents/analyzer.py` — LLM identifies one improvement per cycle
- `agents/modifier.py` — LLM generates new code applying the suggestion
- `evolution/loop.py` — Full cycle: benchmark→analyze→checkpoint→mutate→sandbox→apply/rollback
- `evolution/sandbox.py` — Validates mutations with 5 test cases before applying
- `evolution/checkpoint.py` — Save/restore state for rollback
- `evolution/fitness.py` — Scores 0-1: baseline_ms / current_ms / 2 (clamped)
- `dashboard/app/page.tsx` — WebSocket client, event feed, stat cards, start button

## Event Schema (ALL events from loop.py, DO NOT change shapes without updating dashboard)
```
started          { cycles, baseline_ms }
cycle_start      { cycle, of }
benchmark        { generation, duration_ms, fitness, success }
analysis         { suggestion }
checkpoint       { generation }
mutation_proposed { code_preview }
sandbox_failed   { error }
sandbox_passed   { proposed_duration_ms, proposed_fitness }
applied          { generation, delta_fitness, new_fitness }
discarded        { reason, proposed_fitness, current_fitness }
rollback         { to_generation }
complete         { name, generation, fitness_score, mutation_count }
error            { message }
```

---

## WORKTREE TASKS — Run These in Parallel

### WORKTREE A: `wt-backend` — Backend Completeness
**Branch**: `wt-backend`
**Files to touch**: `api.py`, `evolution/loop.py`, `tests/`

**Task A1: Add reset + stop endpoints to api.py**
```python
# POST /api/evolve/reset — resets performer to generation 0
# POST /api/evolve/stop  — sets _is_running = False to halt current run
```
Reset must:
- Set performer back to Performer() (fresh instance)
- Clear checkpoint store via evolution.checkpoint.clear("Performer")
- Broadcast {"event": "reset", "data": {}} to all WS clients
- Return {"status": "reset"}

Stop must:
- Set `_is_running = False`
- The running loop checks `_is_running` — add that check in loop.py's run_cycle
- Broadcast {"event": "stopped", "data": {}}
- Return {"status": "stopped"}

Add `_stop_requested` flag to api.py, check it in run_cycle after each yield.
Pass `stop_check: Callable[[], bool]` into run_cycle as optional arg.

**Task A2: Emit full code in `applied` event**
In `evolution/loop.py`, change the `applied` yield to include:
```python
yield {"event": "applied", "data": {
    "generation": performer.generation,
    "delta_fitness": round(delta, 4),
    "new_fitness": round(performer.fitness_score, 4),
    "code": proposed_code,           # ADD THIS — dashboard will show code diff
    "previous_code": current_code_snapshot,  # ADD THIS — snapshot before mutation
}}
```
Capture `current_code_snapshot = performer.task_code` at start of cycle (before any mutation).

**Task A3: Write tests/test_sandbox.py**
```python
# Test validate() with valid code, invalid syntax, wrong output, missing run_task
# Test benchmark_proposed() returns AgentResult with success=True on valid code
# Use pytest, no mocking needed
```

**Task A4: Write tests/test_fitness.py**
```python
# Test score() with success=False returns 0.0
# Test score() where current == baseline returns 0.5
# Test score() where current is 2x faster returns 1.0 (clamped)
```

---

### WORKTREE B: `wt-dashboard` — Visual Polish
**Branch**: `wt-dashboard`
**Files to touch**: `dashboard/app/page.tsx`, `dashboard/app/layout.tsx`

**Task B1: Fix layout.tsx metadata**
Change title to "EvolveX" and description to "Self-modifying agent evolution system"

**Task B2: Fitness chart over generations**
Add a recharts LineChart (install: `npm install recharts`) below the stat cards.
- X-axis: generation number
- Y-axis: fitness score (0–1)
- Data points added on every "applied" or "benchmark" event
- Show a dashed baseline at 0.5
- Color: emerald (#10b981), animate points
- Component: `FitnessChart` in same file or separate component

```typescript
// State: fitnessHistory: Array<{generation: number, fitness: number}>
// On "benchmark" event: push { generation: ev.data.generation, fitness: ev.data.fitness }
// On "applied" event: mark point with a different color (evolution happened)
```

**Task B3: Code evolution panel**
Add a right column (or bottom panel) showing:
- Current task_code in a `<pre>` block with dark background (Geist Mono)
- On "applied" event: briefly flash the panel green, then show new code
- Label: "Generation N" above the code
- Show previous generation code faded/crossed out if space allows

Track state: `currentCode: string`, `previousCode: string`
On "applied" event: set previousCode = currentCode, currentCode = ev.data.code
On "mutation_proposed": show proposed code preview (first 200 chars) in muted color

**Task B4: Human-readable event feed**
Instead of raw JSON, format each event as a readable message:
```
started        → "Evolution started — baseline: {baseline_ms}ms over {cycles} cycles"
benchmark      → "Gen {generation}: {duration_ms}ms (fitness: {fitness})"
analysis       → "Suggestion: {suggestion}"
applied        → "✓ Gen {generation} applied — +{delta_fitness} fitness ({new_fitness} total)"
discarded      → "✗ Mutation discarded — no improvement"
sandbox_failed → "✗ Sandbox rejected — {error}"
rollback       → "↩ Rolled back to gen {to_generation}"
complete       → "Evolution complete — {mutation_count} mutations applied"
```
Keep timestamp + event type label. Just replace the raw JSON data span.

**Task B5: Add Stop + Reset buttons**
- Stop button: POST /api/evolve/stop — visible only when running
- Reset button: POST /api/evolve/reset — visible when idle, resets all state
- On reset: clear fitnessHistory, currentCode, events, agent stats

---

### WORKTREE C: `wt-evolution` — Evolution Depth (time permitting)
**Branch**: `wt-evolution`
**Files to touch**: `evolution/loop.py`, `agents/performer.py`, `evolution/sandbox.py`

**Task C1: Add performance_delta_pct to applied event**
```python
pct_improvement = ((baseline_ms - proposed_result.duration_ms) / baseline_ms) * 100
yield {"event": "applied", "data": { ..., "pct_improvement": round(pct_improvement, 1) }}
```

**Task C2: Larger benchmark dataset for more visible timing differences**
In `loop.py`, change:
```python
_BENCHMARK_DATA = list(range(500, 0, -1))  # was 200 — bigger = more visible ms difference
```
In `sandbox.py`, add one more large test case to _TEST_CASES:
```python
(list(range(100, 0, -1)), list(range(1, 101))),
```

**Task C3: Add multi-step evolution resistance**
After 3 successful mutations to `sorted()`, add a "plateau detection" event:
```python
if performer.mutation_count >= 3 and delta < 0.01:
    yield {"event": "plateau", "data": {"message": "Agent has reached local optimum"}}
```
This makes the demo narrative more complete — agent evolves until it can't improve further.

---

## Build Order (single-developer sequence)

If running sequentially (not parallel worktrees):
1. **A1** — Reset + Stop (10 min) — critical for demo
2. **B1** — Fix title (2 min)
3. **B4** — Human-readable events (15 min) — makes video watchable
4. **B2** — Fitness chart (20 min) — the "wow" visual
5. **B3** — Code panel (20 min) — the "AI modifying itself" visual
6. **A2** — Emit code in applied event (5 min) — required for B3
7. **B5** — Stop/Reset buttons (10 min)
8. **A3+A4** — Tests (15 min) — technical credibility
9. **C1+C2** — Evolution depth (15 min) — if time allows
10. **C3** — Plateau detection (10 min) — polish

## Run Locally
```bash
# Terminal 1 — backend (always activate venv first)
source .venv/bin/activate && uvicorn api:app --reload --port 8000

# Terminal 2 — dashboard
cd dashboard && npm run dev
# → http://localhost:3000
```

## Demo Script (3-min video)
1. (0:00–0:30) Problem: AI can't improve itself. Show baseline agent running bubble sort.
2. (0:30–1:30) Start evolution. Watch analyzer suggest improvement. Watch modifier generate code.
   - Show code panel: bubble sort → evolving → sorted()
   - Show fitness chart: line climbing
3. (1:30–2:00) Show applied mutations. "Agent went from 8ms to 0.3ms — 26x faster."
4. (2:00–2:30) Reset. Run again. Same agent, same result — reproducible evolution.
5. (2:30–3:00) Market: "This is the foundation for self-improving AI systems. Every AI deployment
   could ship with an evolution loop that makes it better over time, automatically."

## Constraints & Rules
- NEVER apply code mutations without sandbox validation
- NEVER skip checkpoint before mutation
- ALL evolution events must yield from loop.py so dashboard sees them
- No hardcoded API keys — .env only
- Functions over classes (Python)
- venv at .venv/ (Python 3.13)
