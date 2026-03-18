"""
FastAPI server.
Classic mode:
- POST /api/evolve/start  — begin evolution loop (N cycles)
- POST /api/evolve/stop
- POST /api/evolve/reset
- GET  /api/evolve/status

Arena mode:
- POST /api/arena/start   — begin adversarial co-evolution (N rounds)
- POST /api/arena/stop
- POST /api/arena/reset
- GET  /api/arena/status

Genesis mode:
- POST /api/genesis/start     — begin autonomous agent-building run
- POST /api/genesis/stop      — request stop
- POST /api/genesis/reset     — clear workspace + state
- GET  /api/genesis/status    — current phase, iteration, cost, running flag
- GET  /api/genesis/workspace — list workspace files
- GET  /api/genesis/narrative — latest BUILD_LOG.md content

WS /ws/evolution          — real-time event stream (all modes share this channel)
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
from agents.solver import Solver
from agents.challenger import Challenger
from agents.meta_agent import MetaAgent
from evolution.loop import run_cycle, _BENCHMARK_DATA
from evolution.checkpoint import clear as clear_checkpoints
from evolution.arena import run_arena
from evolution.genesis import run_genesis
from evolution.genesis_sandbox import WORKSPACE_ROOT, ensure_workspace
from evolution.genesis_tools import TOOL_DEFINITIONS
from evolution.protocol import Protocol

load_dotenv()

# ── Shared state ────────────────────────────────────────────────────────────
performer: Performer | None = None
analyzer: Analyzer | None = None
modifier: Modifier | None = None
solver: Solver | None = None
challenger: Challenger | None = None
arena_protocol: Protocol | None = None
_ws_connections: list[WebSocket] = []
_is_running = False
_stop_requested = False
_arena_running = False
_arena_stop_flag: list[bool] = [False]

# Genesis state
_genesis_running = False
_genesis_stop_flag: list[bool] = [False]
_genesis_status: dict = {
    "phase": "IDLE",
    "iteration": 0,
    "total_cost_usd": 0.0,
    "files_created": [],
    "last_assessment": None,
}


def require_openai_model() -> str:
    model = os.getenv("OPENAI_MODEL")
    if not model:
        raise RuntimeError("OPENAI_MODEL must be set in the environment.")
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global performer, analyzer, modifier, solver, challenger, arena_protocol
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = require_openai_model()
    performer = Performer()
    analyzer = Analyzer(client)
    modifier = Modifier(client)
    arena_protocol = Protocol()
    solver = Solver(client, protocol=arena_protocol)
    challenger = Challenger(client, protocol=arena_protocol)
    # Store model preference on agents for use in loop/arena
    analyzer._model = model  # type: ignore[attr-defined]
    modifier._model = model  # type: ignore[attr-defined]
    solver._model = model    # type: ignore[attr-defined]
    challenger._model = model  # type: ignore[attr-defined]
    yield


app = FastAPI(title="EvolveX API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://evolvex.pacslate.com"],
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
    model = require_openai_model()

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
                async for event in run_cycle(performer, analyzer, modifier, baseline_ms, model=model):  # type: ignore[arg-type]
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


# ── Arena endpoints ──────────────────────────────────────────────────────────
class ArenaStartRequest(BaseModel):
    rounds: int = 10


@app.post("/api/arena/start")
async def start_arena(req: ArenaStartRequest):
    global _arena_running, _arena_stop_flag
    if _arena_running:
        return {"error": "arena already running"}
    model = require_openai_model()

    async def _run():
        global _arena_running, _arena_stop_flag
        _arena_running = True
        _arena_stop_flag = [False]
        try:
            async for event in run_arena(  # type: ignore[arg-type]
                solver, challenger, req.rounds,
                model=model,
                stop_flag=_arena_stop_flag,
                protocol=arena_protocol,
            ):
                await broadcast(event)
        finally:
            _arena_running = False

    asyncio.create_task(_run())
    return {"status": "started", "rounds": req.rounds}


@app.post("/api/arena/stop")
async def stop_arena():
    global _arena_stop_flag
    if not _arena_running:
        return {"error": "arena not running"}
    _arena_stop_flag[0] = True
    return {"status": "stopping"}


@app.post("/api/arena/reset")
async def reset_arena():
    global solver, challenger, arena_protocol
    if _arena_running:
        return {"error": "cannot reset while running — stop first"}
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = require_openai_model()
    arena_protocol = Protocol()
    solver = Solver(client, protocol=arena_protocol)
    challenger = Challenger(client, protocol=arena_protocol)
    solver._model = model      # type: ignore[attr-defined]
    challenger._model = model  # type: ignore[attr-defined]
    await broadcast({"event": "arena_reset", "data": {}})
    return {"status": "reset"}


@app.get("/api/arena/status")
async def get_arena_status():
    if solver is None:
        return {"status": "not_initialized"}
    return {
        "status": "running" if _arena_running else "idle",
        "solver": solver.to_dict(),
        "challenger": challenger.to_dict() if challenger else {},
        "protocol": arena_protocol.to_dict() if arena_protocol else {},
    }


@app.get("/api/arena/protocol")
async def get_arena_protocol():
    if arena_protocol is None:
        return {"status": "not_initialized"}
    return arena_protocol.to_dict()


# ── Genesis endpoints ────────────────────────────────────────────────────────

class GenesisStartRequest(BaseModel):
    max_iterations: int = 1000


@app.post("/api/genesis/start")
async def start_genesis(req: GenesisStartRequest):
    global _genesis_running, _genesis_stop_flag, _genesis_status
    if _genesis_running:
        return {"error": "genesis already running"}
    model = require_openai_model()
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    async def _run():
        global _genesis_running, _genesis_stop_flag, _genesis_status
        _genesis_running = True
        _genesis_stop_flag = [False]
        _genesis_status = {
            "phase": "RESEARCH",
            "iteration": 0,
            "total_cost_usd": 0.0,
            "files_created": [],
            "last_assessment": None,
        }
        try:
            async for event in run_genesis(
                client=client,
                model=model,
                max_iterations=req.max_iterations,
                stop_flag=_genesis_stop_flag,
            ):
                await broadcast(event)
                # Mirror key state into _genesis_status for the /status endpoint
                ev = event.get("event", "")
                data = event.get("data", {})
                if ev == "genesis_phase_change":
                    _genesis_status["phase"] = data.get("new_phase", _genesis_status["phase"])
                elif ev == "genesis_tool_call":
                    _genesis_status["iteration"] = data.get("iteration", _genesis_status["iteration"])
                elif ev == "genesis_token_usage":
                    _genesis_status["total_cost_usd"] = data.get("total_cost_usd", 0.0)
                elif ev == "genesis_assessment":
                    _genesis_status["last_assessment"] = data.get("scores")
                elif ev == "genesis_file_changed":
                    path = data.get("path")
                    if path and path not in _genesis_status["files_created"]:
                        _genesis_status["files_created"].append(path)
                elif ev == "genesis_complete":
                    _genesis_status["files_created"] = data.get("files_created", [])
                    _genesis_status["phase"] = "COMPLETE"
        finally:
            _genesis_running = False

    asyncio.create_task(_run())
    return {"status": "started", "max_iterations": req.max_iterations}


@app.post("/api/genesis/stop")
async def stop_genesis():
    global _genesis_stop_flag
    if not _genesis_running:
        return {"error": "genesis not running"}
    _genesis_stop_flag[0] = True
    return {"status": "stopping"}


@app.post("/api/genesis/reset")
async def reset_genesis():
    global _genesis_status
    if _genesis_running:
        return {"error": "cannot reset while running — stop first"}
    import shutil
    if WORKSPACE_ROOT.exists():
        shutil.rmtree(WORKSPACE_ROOT)
    ensure_workspace()
    _genesis_status = {
        "phase": "IDLE",
        "iteration": 0,
        "total_cost_usd": 0.0,
        "files_created": [],
        "last_assessment": None,
    }
    await broadcast({"event": "genesis_reset", "data": {}})
    return {"status": "reset"}


@app.get("/api/genesis/status")
async def get_genesis_status():
    return {
        "running": _genesis_running,
        **_genesis_status,
    }


@app.get("/api/genesis/workspace")
async def get_genesis_workspace():
    if not WORKSPACE_ROOT.exists():
        return {"files": []}
    files = []
    for path in sorted(WORKSPACE_ROOT.rglob("*")):
        if path.is_file() and not path.name.startswith("_genesis"):
            rel = str(path.relative_to(WORKSPACE_ROOT))
            files.append({"path": rel, "size_bytes": path.stat().st_size})
    return {"files": files, "workspace": str(WORKSPACE_ROOT)}


@app.get("/api/genesis/narrative")
async def get_genesis_narrative():
    log_path = WORKSPACE_ROOT / "BUILD_LOG.md"
    if not log_path.exists():
        return {"content": None}
    content = log_path.read_text(encoding="utf-8", errors="replace")
    return {"content": content[-4000:] if len(content) > 4000 else content}
