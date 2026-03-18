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

Growth registry:
- GET  /api/growth/latest     — latest run summary and status breakdown
- GET  /api/growth/runs       — recent run summaries
- GET  /api/growth/runs/{run_id} — full record bundle for one growth run
- GET  /api/growth/promotion-queue — promotion candidates across runs

WS /ws/evolution          — real-time event stream (all modes share this channel)
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

from agents.performer import Performer
from agents.analyzer import Analyzer
from agents.modifier import Modifier
from agents.solver import Solver
from agents.challenger import Challenger
from agents.bootstrap_peer import BootstrapPeer
from agents.meta_agent import MetaAgent
from evolution.loop import run_cycle, _BENCHMARK_DATA
from evolution.checkpoint import clear as clear_checkpoints
from evolution.arena import run_arena
from evolution.bootstrap import run_bootstrap
from evolution.bootstrap_broker import BootstrapBroker
from evolution.bootstrap_curriculum import BOOTSTRAP_STAGES
from evolution.bootstrap_protocol import BootstrapProtocol
from evolution.genesis import run_genesis
from evolution.genesis_sandbox import WORKSPACE_ROOT, ensure_workspace
from evolution.genesis_tools import TOOL_DEFINITIONS
from evolution.growth_registry import (
    list_promotion_candidates,
    list_run_summaries,
    read_latest_summary,
    read_run_bundle,
    register_genesis_completion,
)
from evolution.protocol import Protocol

load_dotenv()

# ── Shared state ────────────────────────────────────────────────────────────
performer: Performer | None = None
analyzer: Analyzer | None = None
modifier: Modifier | None = None
solver: Solver | None = None
challenger: Challenger | None = None
arena_protocol: Protocol | None = None
bootstrap_peer_a: BootstrapPeer | None = None
bootstrap_peer_b: BootstrapPeer | None = None
bootstrap_broker: BootstrapBroker | None = None
bootstrap_protocol: BootstrapProtocol | None = None
_ws_connections: list[WebSocket] = []
_is_running = False
_stop_requested = False
_arena_running = False
_arena_stop_flag: list[bool] = [False]
_bootstrap_running = False
_bootstrap_stop_flag: list[bool] = [False]
_bootstrap_status: dict = {
    "stage": BOOTSTRAP_STAGES[0].name,
    "stage_id": BOOTSTRAP_STAGES[0].id,
    "round": 0,
    "target_rounds": 0,
    "objective": BOOTSTRAP_STAGES[0].objective,
    "unlocked_capabilities": list(BOOTSTRAP_STAGES[0].allowed_capabilities),
    "assessment": None,
    "resumable": False,
    "completed": False,
}

# Genesis state
_genesis_running = False
_genesis_stop_flag: list[bool] = [False]
_genesis_status: dict = {
    "phase": "IDLE",
    "iteration": 0,
    "total_cost_usd": 0.0,
    "pricing_known": True,
    "files_created": [],
    "last_assessment": None,
}


def require_openai_model() -> str:
    model = os.getenv("OPENAI_MODEL")
    if not model:
        raise RuntimeError("OPENAI_MODEL must be set in the environment.")
    return model


def reset_bootstrap_status() -> None:
    global _bootstrap_status
    _bootstrap_status = {
        "stage": BOOTSTRAP_STAGES[0].name,
        "stage_id": BOOTSTRAP_STAGES[0].id,
        "round": 0,
        "target_rounds": 0,
        "objective": BOOTSTRAP_STAGES[0].objective,
        "unlocked_capabilities": list(BOOTSTRAP_STAGES[0].allowed_capabilities),
        "assessment": None,
        "resumable": False,
        "completed": False,
    }


def update_bootstrap_status(event: dict) -> None:
    global _bootstrap_status
    name = event.get("event", "")
    data = event.get("data", {})
    if name == "bootstrap_started":
        _bootstrap_status.update(
            {
                "stage": data.get("stage", _bootstrap_status["stage"]),
                "stage_id": data.get("stage_id", _bootstrap_status["stage_id"]),
                "target_rounds": data.get("rounds", _bootstrap_status["target_rounds"]),
                "objective": data.get("objective", _bootstrap_status["objective"]),
                "unlocked_capabilities": data.get(
                    "unlocked_capabilities", _bootstrap_status["unlocked_capabilities"]
                ),
                "round": 0,
                "resumable": bool(data.get("resumed_from_checkpoint", False)),
                "completed": False,
            }
        )
    elif name == "bootstrap_resumed":
        _bootstrap_status["round"] = data.get("from_round", _bootstrap_status["round"])
        _bootstrap_status["target_rounds"] = data.get("target_rounds", _bootstrap_status["target_rounds"])
        _bootstrap_status["resumable"] = True
    elif name == "bootstrap_round_start":
        _bootstrap_status["round"] = data.get("round", _bootstrap_status["round"])
    elif name == "bootstrap_objective":
        _bootstrap_status["objective"] = data.get("objective", _bootstrap_status["objective"])
        _bootstrap_status["unlocked_capabilities"] = data.get(
            "allowed_capabilities", _bootstrap_status["unlocked_capabilities"]
        )
    elif name == "bootstrap_stage_up":
        _bootstrap_status.update(
            {
                "stage": data.get("stage", _bootstrap_status["stage"]),
                "stage_id": data.get("stage_id", _bootstrap_status["stage_id"]),
                "unlocked_capabilities": data.get(
                    "unlocked_capabilities", _bootstrap_status["unlocked_capabilities"]
                ),
            }
        )
    elif name == "bootstrap_assessment" and data.get("source") == "system":
        _bootstrap_status["assessment"] = data.get("assessment")
    elif name == "bootstrap_complete":
        _bootstrap_status["assessment"] = data.get("assessment")
        _bootstrap_status["stage"] = data.get("stage", _bootstrap_status["stage"])
        _bootstrap_status["stage_id"] = data.get("stage_id", _bootstrap_status["stage_id"])
        _bootstrap_status["completed"] = True
        _bootstrap_status["resumable"] = False
        _bootstrap_status["round"] = _bootstrap_status.get("target_rounds", _bootstrap_status["round"])
    elif name == "bootstrap_stopped":
        _bootstrap_status["resumable"] = True
    elif name == "bootstrap_reset":
        reset_bootstrap_status()


def restore_bootstrap_from_checkpoint() -> None:
    if bootstrap_broker is None or bootstrap_protocol is None or bootstrap_peer_a is None or bootstrap_peer_b is None:
        return
    checkpoint = bootstrap_broker.load_checkpoint()
    if not checkpoint:
        reset_bootstrap_status()
        return
    bootstrap_protocol.restore_state(checkpoint.get("protocol"))
    bootstrap_peer_a.restore_state(checkpoint.get("peer_a"))
    bootstrap_peer_b.restore_state(checkpoint.get("peer_b"))
    bootstrap_broker.restore_state(checkpoint.get("broker"))
    stage_id = min(int(checkpoint.get("stage_index", 0)), len(BOOTSTRAP_STAGES) - 1)
    stage = BOOTSTRAP_STAGES[stage_id]
    _bootstrap_status.update(
        {
            "stage": stage.name,
            "stage_id": stage.id,
            "round": int(checkpoint.get("round", 0)),
            "target_rounds": int(checkpoint.get("target_rounds", 0)),
            "objective": stage.objective,
            "unlocked_capabilities": list(stage.allowed_capabilities),
            "assessment": checkpoint.get("system_assessment"),
            "resumable": not bool(checkpoint.get("completed", False)),
            "completed": bool(checkpoint.get("completed", False)),
        }
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global performer, analyzer, modifier, solver, challenger, arena_protocol
    global bootstrap_peer_a, bootstrap_peer_b, bootstrap_broker, bootstrap_protocol
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = require_openai_model()
    performer = Performer()
    analyzer = Analyzer(client)
    modifier = Modifier(client)
    arena_protocol = Protocol()
    solver = Solver(client, protocol=arena_protocol)
    challenger = Challenger(client, protocol=arena_protocol)
    bootstrap_peer_a = BootstrapPeer("Peer A", client)
    bootstrap_peer_b = BootstrapPeer("Peer B", client)
    bootstrap_broker = BootstrapBroker()
    bootstrap_protocol = BootstrapProtocol()
    # Store model preference on agents for use in loop/arena
    analyzer._model = model  # type: ignore[attr-defined]
    modifier._model = model  # type: ignore[attr-defined]
    solver._model = model    # type: ignore[attr-defined]
    challenger._model = model  # type: ignore[attr-defined]
    bootstrap_peer_a._model = model  # type: ignore[attr-defined]
    bootstrap_peer_b._model = model  # type: ignore[attr-defined]
    restore_bootstrap_from_checkpoint()
    yield


app = FastAPI(title="EvolveX API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://evolvex.pacslate.com",
        "https://www.evolvex.pacslate.com",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket broadcast ──────────────────────────────────────────────────────
def _error_data(exc: Exception, *, phase: str) -> dict[str, str]:
    return {"message": f"{type(exc).__name__}: {exc}", "phase": phase}


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
        if websocket in _ws_connections:
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
                    if _stop_requested:
                        await broadcast({"event": "stopped", "data": {"cycle": i + 1}})
                        return

            await broadcast({"event": "complete", "data": performer.to_dict()})  # type: ignore[union-attr]
        except Exception as exc:
            await broadcast({"event": "error", "data": _error_data(exc, phase="classic_run")})
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
        except Exception as exc:
            await broadcast({"event": "arena_error", "data": _error_data(exc, phase="arena_run")})
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


# ── Bootstrap endpoints ─────────────────────────────────────────────────────
class BootstrapStartRequest(BaseModel):
    rounds: int = 12


@app.post("/api/bootstrap/start")
async def start_bootstrap(req: BootstrapStartRequest):
    global _bootstrap_running, _bootstrap_stop_flag
    if _bootstrap_running:
        return {"error": "bootstrap already running"}
    model = require_openai_model()

    async def _run():
        global _bootstrap_running, _bootstrap_stop_flag
        _bootstrap_running = True
        _bootstrap_stop_flag = [False]
        try:
            async for event in run_bootstrap(  # type: ignore[arg-type]
                bootstrap_peer_a,
                bootstrap_peer_b,
                req.rounds,
                model=model,
                broker=bootstrap_broker,
                protocol=bootstrap_protocol,
                stop_flag=_bootstrap_stop_flag,
            ):
                update_bootstrap_status(event)
                await broadcast(event)
        except Exception as exc:
            await broadcast(
                {
                    "event": "bootstrap_error",
                    "data": {"message": f"{type(exc).__name__}: {exc}", "phase": "bootstrap_run"},
                }
            )
            restore_bootstrap_from_checkpoint()
        finally:
            _bootstrap_running = False

    asyncio.create_task(_run())
    return {"status": "started", "rounds": req.rounds}


@app.post("/api/bootstrap/stop")
async def stop_bootstrap():
    global _bootstrap_stop_flag
    if not _bootstrap_running:
        return {"error": "bootstrap not running"}
    _bootstrap_stop_flag[0] = True
    return {"status": "stopping"}


@app.post("/api/bootstrap/reset")
async def reset_bootstrap():
    global bootstrap_peer_a, bootstrap_peer_b, bootstrap_broker, bootstrap_protocol
    if _bootstrap_running:
        return {"error": "cannot reset while running — stop first"}
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = require_openai_model()
    bootstrap_peer_a = BootstrapPeer("Peer A", client)
    bootstrap_peer_b = BootstrapPeer("Peer B", client)
    bootstrap_peer_a._model = model  # type: ignore[attr-defined]
    bootstrap_peer_b._model = model  # type: ignore[attr-defined]
    bootstrap_broker = BootstrapBroker()
    bootstrap_broker.reset()
    bootstrap_protocol = BootstrapProtocol()
    reset_bootstrap_status()
    await broadcast({"event": "bootstrap_reset", "data": {}})
    return {"status": "reset"}


@app.get("/api/bootstrap/status")
async def get_bootstrap_status():
    if bootstrap_peer_a is None or bootstrap_peer_b is None or bootstrap_broker is None or bootstrap_protocol is None:
        return {"status": "not_initialized"}
    return {
        "status": "running" if _bootstrap_running else "idle",
        **_bootstrap_status,
        "peer_a": bootstrap_peer_a.to_dict(),
        "peer_b": bootstrap_peer_b.to_dict(),
        "protocol": bootstrap_protocol.to_dict(),
        "artifacts": bootstrap_broker.list_artifacts(),
        "run_cost_usd": round(bootstrap_peer_a.total_cost_usd + bootstrap_peer_b.total_cost_usd, 4),
    }


@app.get("/api/bootstrap/protocol")
async def get_bootstrap_protocol():
    if bootstrap_protocol is None:
        return {"status": "not_initialized"}
    return bootstrap_protocol.to_dict()


@app.get("/api/bootstrap/artifacts")
async def get_bootstrap_artifacts():
    if bootstrap_broker is None:
        return {"status": "not_initialized"}
    return {"files": bootstrap_broker.list_artifacts(), "workspace": str(bootstrap_broker.workspace_root)}


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
            "pricing_known": True,
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
                    _genesis_status["pricing_known"] = data.get("pricing_known", True)
                elif ev == "genesis_assessment":
                    _genesis_status["last_assessment"] = data.get("scores")
                elif ev == "genesis_file_changed":
                    path = data.get("path")
                    if path and path not in _genesis_status["files_created"]:
                        _genesis_status["files_created"].append(path)
                elif ev == "genesis_complete":
                    _genesis_status["files_created"] = data.get("files_created", [])
                    _genesis_status["phase"] = "COMPLETE"
                    growth_record = register_genesis_completion(
                        files_created=[str(path) for path in data.get("files_created", [])],
                        final_assessment=data.get("final_assessment"),
                        total_cost_usd=data.get("total_cost_usd"),
                        pricing_known=data.get("pricing_known"),
                        workspace_root=str(WORKSPACE_ROOT),
                    )
                    await broadcast(
                        {
                            "event": "genesis_growth_recorded",
                            "data": {
                                "run_id": growth_record["run_id"],
                                "promotion_state": growth_record["promotion_candidate"]["promotion_state"],
                            },
                        }
                    )
        except Exception as exc:
            await broadcast({"event": "genesis_error", "data": _error_data(exc, phase="genesis_run")})
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
        "pricing_known": True,
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


@app.get("/api/growth/latest")
async def get_growth_latest():
    return read_latest_summary()


@app.get("/api/growth/runs")
async def get_growth_runs():
    latest = read_latest_summary()
    return {
        "runs": list_run_summaries(),
        "latest_run_id": latest.get("latest_run_id"),
        "root": latest.get("root"),
    }


@app.get("/api/growth/runs/{run_id}")
async def get_growth_run(run_id: str):
    try:
        return read_run_bundle(run_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/growth/promotion-queue")
async def get_growth_promotion_queue():
    latest = read_latest_summary()
    candidates = list_promotion_candidates()
    return {
        "candidates": candidates,
        "total": len(candidates),
        "latest_run_id": latest.get("latest_run_id"),
        "root": latest.get("root"),
    }
