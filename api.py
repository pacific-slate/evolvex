"""
FastAPI server.
- POST /api/evolve/start  — begin evolution loop (N cycles)
- GET  /api/evolve/status — current agent state
- WS   /ws/evolution      — real-time event stream to dashboard
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

from agents.performer import Performer
from agents.analyzer import Analyzer
from agents.modifier import Modifier
from evolution.loop import run_cycle, _BENCHMARK_DATA
from evolution.checkpoint import clear as clear_checkpoints

load_dotenv()

# ── Shared state ────────────────────────────────────────────────────────────
performer: Performer | None = None
analyzer: Analyzer | None = None
modifier: Modifier | None = None
_ws_connections: list[WebSocket] = []
_is_running = False
_stop_requested = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global performer, analyzer, modifier
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = os.getenv("OPENAI_MODEL", "gpt-4.1")
    performer = Performer()
    analyzer = Analyzer(client)
    modifier = Modifier(client)
    # Store model preference on agents for use in loop
    analyzer._model = model  # type: ignore[attr-defined]
    modifier._model = model  # type: ignore[attr-defined]
    yield


app = FastAPI(title="EvolveX API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket broadcast ──────────────────────────────────────────────────────
async def broadcast(event: dict) -> None:
    payload = json.dumps(event)
    dead = []
    for ws in _ws_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_connections.remove(ws)


@app.websocket("/ws/evolution")
async def ws_evolution(websocket: WebSocket):
    await websocket.accept()
    _ws_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        _ws_connections.remove(websocket)


# ── REST endpoints ───────────────────────────────────────────────────────────
class StartRequest(BaseModel):
    cycles: int = 5


@app.post("/api/evolve/start")
async def start_evolution(req: StartRequest):
    global _is_running
    if _is_running:
        return {"error": "evolution already running"}

    async def _run():
        global _is_running, _stop_requested
        _is_running = True
        _stop_requested = False
        try:
            # Establish baseline on first cycle
            baseline = performer.run_benchmark(_BENCHMARK_DATA)  # type: ignore[union-attr]
            baseline_ms = baseline.duration_ms
            await broadcast({"event": "started", "data": {"cycles": req.cycles, "baseline_ms": round(baseline_ms, 3)}})

            for i in range(req.cycles):
                if _stop_requested:
                    await broadcast({"event": "stopped", "data": {"cycle": i + 1}})
                    return
                await broadcast({"event": "cycle_start", "data": {"cycle": i + 1, "of": req.cycles}})
                async for event in run_cycle(performer, analyzer, modifier, baseline_ms):  # type: ignore[arg-type]
                    await broadcast(event)

            await broadcast({"event": "complete", "data": performer.to_dict()})  # type: ignore[union-attr]
        finally:
            _is_running = False
            _stop_requested = False

    asyncio.create_task(_run())
    return {"status": "started", "cycles": req.cycles}


@app.post("/api/evolve/stop")
async def stop_evolution():
    global _stop_requested
    if not _is_running:
        return {"error": "not running"}
    _stop_requested = True
    return {"status": "stopping"}


@app.post("/api/evolve/reset")
async def reset_evolution():
    global performer
    if _is_running:
        return {"error": "cannot reset while running — stop first"}
    performer = Performer()
    clear_checkpoints("Performer")
    await broadcast({"event": "reset", "data": {}})
    return {"status": "reset"}


@app.get("/api/evolve/status")
async def get_status():
    if performer is None:
        return {"status": "not_initialized"}
    return {
        "status": "running" if _is_running else "idle",
        "agent": performer.to_dict(),
        "current_code": performer.task_code,
    }
