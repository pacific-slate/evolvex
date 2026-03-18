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

Housekeeping mode:
- POST /api/housekeeping/start  — begin periodic repo stewardship audits
- POST /api/housekeeping/stop
- POST /api/housekeeping/reset
- GET  /api/housekeeping/status

WS /ws/evolution          — real-time event stream (all modes share this channel)
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

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
from evolution.bootstrap_sandbox import BOOTSTRAP_WORKSPACE
from evolution.genesis import run_genesis
from evolution.genesis_sandbox import WORKSPACE_ROOT, ensure_workspace
from evolution.genesis_tools import TOOL_DEFINITIONS
from evolution import growth_session
from evolution.housekeeping import collect_housekeeping_snapshot, run_housekeeping
from evolution.housekeeping_supervisor import plan_supervisor_actions, run_housekeeping_supervisor
from evolution.protocol import Protocol

load_dotenv()
REPO_ROOT = Path(__file__).resolve().parent

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
_growth_running = False
_growth_stop_flag: list[bool] = [False]
_growth_task: asyncio.Task | None = None
_housekeeping_running = False
_housekeeping_stop_flag: list[bool] = [False]
_housekeeping_status: dict = {
    "cycle": 0,
    "interval_seconds": 300,
    "run_quality_checks": True,
    "max_cycles": None,
    "overall_state": "idle",
    "repo_root": str(REPO_ROOT),
    "latest_audits": [],
    "worktrees": [],
    "checkpoint_recommendation": None,
    "recent_findings": [],
    "history": [],
}
_housekeeping_supervisor_running = False
_housekeeping_supervisor_stop_flag: list[bool] = [False]
_housekeeping_supervisor_status: dict = {
    "cycle": 0,
    "interval_seconds": 300,
    "run_quality_checks": True,
    "max_cycles": None,
    "overall_status": "idle",
    "repo_root": str(REPO_ROOT),
    "latest_report": None,
    "planned_actions": [],
    "active_risks": [],
    "history": [],
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


def reset_genesis_status() -> None:
    global _genesis_status
    _genesis_status = {
        "phase": "IDLE",
        "iteration": 0,
        "total_cost_usd": 0.0,
        "pricing_known": True,
        "files_created": [],
        "last_assessment": None,
    }


def update_genesis_status(event: dict) -> None:
    global _genesis_status
    ev = event.get("event", "")
    data = event.get("data", {})
    if ev == "genesis_started":
        _genesis_status["phase"] = "RESEARCH"
    elif ev == "genesis_phase_change":
        _genesis_status["phase"] = data.get("new_phase", _genesis_status["phase"])
    elif ev == "genesis_tool_call":
        _genesis_status["iteration"] = max(int(data.get("iteration", 0)), _genesis_status["iteration"])
    elif ev == "genesis_token_usage":
        _genesis_status["total_cost_usd"] = data.get("total_cost_usd", _genesis_status["total_cost_usd"])
        _genesis_status["pricing_known"] = data.get("pricing_known", _genesis_status["pricing_known"])
    elif ev == "genesis_assessment":
        _genesis_status["last_assessment"] = data.get("scores", data)
    elif ev == "genesis_file_changed":
        path = data.get("path")
        if path and path not in _genesis_status["files_created"]:
            _genesis_status["files_created"].append(path)
    elif ev == "genesis_chunk_complete":
        _genesis_status["iteration"] += int(data.get("iterations_completed", 0))
        _genesis_status["phase"] = data.get("phase", _genesis_status["phase"])
        _genesis_status["total_cost_usd"] = data.get("total_cost_usd", _genesis_status["total_cost_usd"])
        _genesis_status["pricing_known"] = data.get("pricing_known", _genesis_status["pricing_known"])
    elif ev == "genesis_complete":
        _genesis_status["files_created"] = data.get("files_created", _genesis_status["files_created"])
        _genesis_status["phase"] = "COMPLETE"
        _genesis_status["last_assessment"] = data.get("final_assessment", _genesis_status["last_assessment"])
        _genesis_status["total_cost_usd"] = data.get("total_cost_usd", _genesis_status["total_cost_usd"])
        _genesis_status["pricing_known"] = data.get("pricing_known", _genesis_status["pricing_known"])
    elif ev == "genesis_reset":
        reset_genesis_status()


def list_genesis_workspace_files() -> list[dict]:
    if not WORKSPACE_ROOT.exists():
        return []
    files = []
    for path in sorted(WORKSPACE_ROOT.rglob("*")):
        if path.is_file() and not path.name.startswith("_genesis"):
            rel = str(path.relative_to(WORKSPACE_ROOT))
            files.append({"path": rel, "size_bytes": path.stat().st_size})
    return files


def growth_allowed_genesis_tools(unlock_state: dict) -> set[str]:
    granted = set(unlock_state.get("granted_capabilities", []))
    mapping = {
        "write_file": "write_file",
        "read_file": "read_file",
        "list_directory": "list_directory",
        "execute_python": "execute_python",
        "create_test": "create_test",
        "self_assess": "self_assess",
        "run_shell": "run_shell",
        "web_search": "web_search",
        "http_get": "http_get",
        "install_package": "install_package",
    }
    allowed = {tool for capability, tool in mapping.items() if capability in granted}
    if "write_file" in granted:
        allowed.update({"read_file", "list_directory"})
    return allowed


def growth_ready_for_self_improve() -> bool:
    assessment = _bootstrap_status.get("assessment") or {}
    stable_tokens = bootstrap_protocol.stable_count() if bootstrap_protocol else 0
    return (
        int(_bootstrap_status.get("stage_id", 0)) >= len(BOOTSTRAP_STAGES) - 1
        and stable_tokens >= 3
        and int(assessment.get("overall", 0) or 0) >= 70
    )


def growth_unlock_state(active_phase: str) -> dict:
    granted = list(_bootstrap_status.get("unlocked_capabilities", []))
    stage_id = int(_bootstrap_status.get("stage_id", 0))
    next_gate = (
        "complete"
        if active_phase == "self_improve"
        else growth_session.phase_from_bootstrap_stage(stage_id + 1, "self_improve")
    )
    return {
        "stage_id": stage_id,
        "stage": active_phase,
        "granted_capabilities": granted,
        "next_gate": next_gate,
    }


def growth_checkpoint_snapshot() -> list[dict]:
    checkpoints = []
    if bootstrap_broker is not None:
        path = bootstrap_broker.checkpoint_path()
        checkpoints.append({"scope": "bootstrap", "path": str(path), "exists": path.exists()})
    checkpoints.append(
        {
            "scope": "genesis",
            "path": str(WORKSPACE_ROOT / ".checkpoint.json"),
            "exists": (WORKSPACE_ROOT / ".checkpoint.json").exists(),
        }
    )
    return checkpoints


def sync_growth_session_state(session_id: str, *, phase_override: str | None = None) -> dict:
    session = growth_session.get_session(session_id)
    if session is None:
        raise RuntimeError(f"Unknown growth session: {session_id}")
    bootstrap_files = bootstrap_broker.list_artifacts() if bootstrap_broker is not None else []
    genesis_files = list_genesis_workspace_files()
    growth_session.replace_artifacts(session_id, "bootstrap", str(BOOTSTRAP_WORKSPACE), bootstrap_files)
    growth_session.replace_artifacts(session_id, "genesis", str(WORKSPACE_ROOT), genesis_files)
    artifacts = growth_session.list_session_artifacts(session_id)
    checkpoints = growth_session.replace_checkpoints(session_id, growth_checkpoint_snapshot())
    storage_used = growth_session.sum_artifact_bytes(artifacts)
    current_phase = phase_override or (
        "self_improve"
        if growth_ready_for_self_improve()
        else growth_session.phase_from_bootstrap_stage(int(_bootstrap_status.get("stage_id", 0)))
    )
    recent_events = growth_session.list_recent_session_events(session_id, limit=60)
    scorecard = growth_session.compute_scorecard(
        budget_used_usd=float(_genesis_status.get("total_cost_usd", 0.0))
        + float((bootstrap_peer_a.total_cost_usd if bootstrap_peer_a else 0.0) + (bootstrap_peer_b.total_cost_usd if bootstrap_peer_b else 0.0)),
        budget_cap_usd=session["budget"]["cap_usd"],
        storage_used_bytes=storage_used,
        storage_cap_bytes=session["storage"]["cap_bytes"],
        bootstrap_assessment=_bootstrap_status.get("assessment"),
        bootstrap_stage_id=int(_bootstrap_status.get("stage_id", 0)),
        bootstrap_protocol=bootstrap_protocol.to_dict() if bootstrap_protocol else {},
        genesis_assessment=_genesis_status.get("last_assessment"),
        artifact_records=artifacts,
        recent_events=recent_events,
        stall_count=int(session.get("stall_count", 0)),
    )
    outputs = growth_session.detect_outputs(artifacts, checkpoints)
    objective = (
        _bootstrap_status.get("objective")
        if current_phase != "self_improve"
        else "Build, verify, and recursively improve the agent package until the target score sustains."
    )
    summary = {
        "latest_signal": recent_events[-1]["event"] if recent_events else None,
        "stable_tokens": bootstrap_protocol.stable_count() if bootstrap_protocol else 0,
        "bootstrap_stage": _bootstrap_status.get("stage"),
        "genesis_phase": _genesis_status.get("phase"),
        "artifact_count": len(artifacts),
    }
    updated = growth_session.update_session(
        session_id,
        phase=current_phase,
        current_objective=objective,
        budget_used_usd=float(_genesis_status.get("total_cost_usd", 0.0))
        + float((bootstrap_peer_a.total_cost_usd if bootstrap_peer_a else 0.0) + (bootstrap_peer_b.total_cost_usd if bootstrap_peer_b else 0.0)),
        storage_used_bytes=storage_used,
        bootstrap_round=int(_bootstrap_status.get("round", 0)),
        genesis_iterations=int(_genesis_status.get("iteration", 0)),
        scorecard=scorecard,
        unlock_state=growth_unlock_state(current_phase),
        outputs=outputs,
        summary=summary,
    )
    growth_session.append_scorecard_snapshot(session_id, scorecard)
    return updated


async def broadcast_growth_event(session_id: str, event_name: str, data: dict, *, source: str = "growth") -> None:
    growth_session.log_session_event(session_id, event_name, data, source=source)
    await broadcast({"event": event_name, "data": data, "source": source})


async def capture_worker_event(session_id: str, event: dict, *, source: str) -> None:
    growth_session.log_session_event(session_id, event.get("event", "unknown"), event.get("data", {}), source=source)
    await broadcast({**event, "source": source})


async def reset_growth_runtime_surfaces() -> None:
    global bootstrap_peer_a, bootstrap_peer_b, bootstrap_broker, bootstrap_protocol
    global _bootstrap_running, _bootstrap_stop_flag, _growth_running, _growth_stop_flag
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
    reset_genesis_status()
    _bootstrap_running = False
    _bootstrap_stop_flag = [False]
    _growth_running = False
    _growth_stop_flag = [False]
    import shutil
    if WORKSPACE_ROOT.exists():
        shutil.rmtree(WORKSPACE_ROOT)
    ensure_workspace()


async def run_growth_session_loop(session_id: str) -> None:
    global _bootstrap_running, _genesis_running, _growth_running, _growth_stop_flag
    model = require_openai_model()
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    session = growth_session.update_session(session_id, status="running")
    await broadcast_growth_event(session_id, "growth_session_started", {"session_id": session_id, "phase": session["phase"]})
    _growth_running = True
    _growth_stop_flag = [False]
    try:
        while True:
            session = growth_session.get_active_session()
            if session is None or session["session_id"] != session_id:
                return
            if _growth_stop_flag[0]:
                growth_session.update_session(session_id, status="paused")
                await broadcast_growth_event(session_id, "growth_session_paused", {"session_id": session_id, "phase": session["phase"]})
                return

            if session["phase"] != "self_improve":
                _bootstrap_running = True
                next_rounds = max(int(session.get("bootstrap_round", 0)), int(_bootstrap_status.get("round", 0))) + growth_session.DEFAULT_BOOTSTRAP_CHUNK_ROUNDS
                async for event in run_bootstrap(  # type: ignore[arg-type]
                    bootstrap_peer_a,
                    bootstrap_peer_b,
                    next_rounds,
                    model=model,
                    broker=bootstrap_broker,
                    protocol=bootstrap_protocol,
                    stop_flag=_growth_stop_flag,
                    continuous=True,
                ):
                    update_bootstrap_status(event)
                    await capture_worker_event(session_id, event, source="bootstrap")
                _bootstrap_running = False
                session = sync_growth_session_state(session_id)
                await broadcast_growth_event(session_id, "growth_scorecard_updated", {"session_id": session_id, "scorecard": session["scorecard"]})
                await broadcast_growth_event(session_id, "growth_checkpoint_saved", {"session_id": session_id, "checkpoints": growth_session.list_checkpoints(session_id)})
                if growth_ready_for_self_improve():
                    session = growth_session.update_session(
                        session_id,
                        phase="self_improve",
                        current_objective="Build, verify, and recursively improve the agent package until the target score sustains.",
                        unlock_state=growth_unlock_state("self_improve"),
                    )
                    await broadcast_growth_event(
                        session_id,
                        "growth_phase_changed",
                        {"session_id": session_id, "phase": "self_improve", "unlocked_capabilities": session["unlock_state"]["granted_capabilities"]},
                    )
                await asyncio.sleep(0)
                continue

            _genesis_running = True
            allowed_tools = growth_allowed_genesis_tools(session["unlock_state"])
            async for event in run_genesis(
                client=client,
                model=model,
                max_iterations=growth_session.DEFAULT_GENESIS_CHUNK_ITERATIONS,
                stop_flag=_growth_stop_flag,
                allowed_tools=allowed_tools,
                continuous=True,
            ):
                update_genesis_status(event)
                await capture_worker_event(session_id, event, source="genesis")
            _genesis_running = False
            session = sync_growth_session_state(session_id, phase_override="self_improve")
            completion = growth_session.evaluate_completion(
                scorecard=session["scorecard"],
                target_score=session["target_score"],
                sustained_hits=session["sustained_hits"],
                sustained_window=session["sustained_window"],
                budget_used_usd=session["budget"]["used_usd"],
                budget_cap_usd=session["budget"]["cap_usd"],
                storage_used_bytes=session["storage"]["used_bytes"],
                storage_cap_bytes=session["storage"]["cap_bytes"],
            )
            update_payload = {
                "sustained_hits": completion["sustained_hits"],
                "completion_state": completion["state"],
                "status": "completed" if completion["completed"] else ("paused" if completion["state"].endswith("_capped") else "running"),
            }
            if completion["completed"]:
                update_payload["completed_at"] = growth_session._now()  # type: ignore[attr-defined]
            session = growth_session.update_session(session_id, **update_payload)
            await broadcast_growth_event(session_id, "growth_scorecard_updated", {"session_id": session_id, "scorecard": session["scorecard"]})
            if completion["completed"]:
                await broadcast_growth_event(
                    session_id,
                    "growth_completed",
                    {"session_id": session_id, "scorecard": session["scorecard"], "outputs": session["outputs"]},
                )
                return
            if completion["state"].endswith("_capped"):
                await broadcast_growth_event(
                    session_id,
                    "growth_budget_warning",
                    {"session_id": session_id, "state": completion["state"], "budget": session["budget"], "storage": session["storage"]},
                )
                return
            await asyncio.sleep(0)
    finally:
        _bootstrap_running = False
        _genesis_running = False
        _growth_running = False


def reset_housekeeping_status() -> None:
    global _housekeeping_status
    _housekeeping_status = {
        "cycle": 0,
        "interval_seconds": 300,
        "run_quality_checks": True,
        "max_cycles": None,
        "overall_state": "idle",
        "repo_root": str(REPO_ROOT),
        "latest_audits": [],
        "worktrees": [],
        "checkpoint_recommendation": None,
        "recent_findings": [],
        "history": [],
    }


def update_housekeeping_status(event: dict) -> None:
    global _housekeeping_status
    name = event.get("event", "")
    data = event.get("data", {})

    if name == "housekeeping_started":
        _housekeeping_status.update(
            {
                "cycle": 0,
                "interval_seconds": data.get("interval_seconds", _housekeeping_status["interval_seconds"]),
                "run_quality_checks": data.get("run_quality_checks", _housekeeping_status["run_quality_checks"]),
                "max_cycles": data.get("max_cycles", _housekeeping_status["max_cycles"]),
                "repo_root": data.get("repo_root", _housekeeping_status["repo_root"]),
                "overall_state": "ok",
                "latest_audits": [],
                "checkpoint_recommendation": None,
                "recent_findings": [],
            }
        )
    elif name == "housekeeping_cycle_start":
        _housekeeping_status["cycle"] = data.get("cycle", _housekeeping_status["cycle"])
    elif name == "housekeeping_audit":
        _housekeeping_status["cycle"] = data.get("cycle", _housekeeping_status["cycle"])
        _housekeeping_status["overall_state"] = data.get("overall_state", _housekeeping_status["overall_state"])
        _housekeeping_status["latest_audits"] = data.get("auditors", [])
        _housekeeping_status["worktrees"] = data.get("worktrees", [])
        _housekeeping_status["checkpoint_recommendation"] = data.get("checkpoint_recommendation")
        history = _housekeeping_status.get("history", [])
        history.append(
            {
                "cycle": data.get("cycle", _housekeeping_status["cycle"]),
                "overall_state": data.get("overall_state", "ok"),
                "timestamp": data.get("timestamp"),
            }
        )
        _housekeeping_status["history"] = history[-20:]
    elif name in {"housekeeping_warn", "housekeeping_block"}:
        findings = _housekeeping_status.get("recent_findings", [])
        findings.append(
            {
                "cycle": data.get("cycle"),
                "scope": data.get("scope"),
                "state": data.get("state"),
                "summary": data.get("summary"),
            }
        )
        _housekeeping_status["recent_findings"] = findings[-20:]
    elif name == "housekeeping_checkpoint_recommended":
        _housekeeping_status["checkpoint_recommendation"] = data
    elif name == "housekeeping_reset":
        reset_housekeeping_status()


def reset_housekeeping_supervisor_status() -> None:
    global _housekeeping_supervisor_status
    _housekeeping_supervisor_status = {
        "cycle": 0,
        "interval_seconds": 300,
        "run_quality_checks": True,
        "max_cycles": None,
        "overall_status": "idle",
        "repo_root": str(REPO_ROOT),
        "latest_report": None,
        "planned_actions": [],
        "active_risks": [],
        "history": [],
    }


def update_housekeeping_supervisor_status(event: dict) -> None:
    global _housekeeping_supervisor_status
    name = event.get("event", "")
    data = event.get("data", {})

    if name == "housekeeping_supervisor_started":
        _housekeeping_supervisor_status.update(
            {
                "cycle": 0,
                "interval_seconds": data.get(
                    "interval_seconds", _housekeeping_supervisor_status["interval_seconds"]
                ),
                "run_quality_checks": data.get(
                    "run_quality_checks", _housekeeping_supervisor_status["run_quality_checks"]
                ),
                "max_cycles": data.get("max_cycles", _housekeeping_supervisor_status["max_cycles"]),
                "repo_root": data.get("repo_root", _housekeeping_supervisor_status["repo_root"]),
                "overall_status": "ok",
                "latest_report": None,
                "planned_actions": [],
                "active_risks": [],
            }
        )
    elif name == "housekeeping_supervisor_cycle_start":
        _housekeeping_supervisor_status["cycle"] = data.get("cycle", _housekeeping_supervisor_status["cycle"])
    elif name == "housekeeping_supervisor_report":
        _housekeeping_supervisor_status["cycle"] = data.get("cycle", _housekeeping_supervisor_status["cycle"])
        _housekeeping_supervisor_status["overall_status"] = data.get(
            "overall_status", _housekeeping_supervisor_status["overall_status"]
        )
        _housekeeping_supervisor_status["latest_report"] = data
        _housekeeping_supervisor_status["planned_actions"] = data.get("planned_actions", [])
        _housekeeping_supervisor_status["active_risks"] = data.get("active_risks", [])
        history = _housekeeping_supervisor_status.get("history", [])
        history.append(
            {
                "cycle": data.get("cycle", _housekeeping_supervisor_status["cycle"]),
                "overall_status": data.get("overall_status", "ok"),
                "timestamp": data.get("timestamp"),
                "planned_action_count": len(data.get("planned_actions", [])),
            }
        )
        _housekeeping_supervisor_status["history"] = history[-20:]
    elif name == "housekeeping_supervisor_reset":
        reset_housekeeping_supervisor_status()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global performer, analyzer, modifier, solver, challenger, arena_protocol
    global bootstrap_peer_a, bootstrap_peer_b, bootstrap_broker, bootstrap_protocol
    global _growth_task
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
    growth_session.ensure_growth_environment()
    restore_bootstrap_from_checkpoint()
    active_session = growth_session.get_active_session()
    if active_session and active_session["status"] == "running":
        _growth_task = asyncio.create_task(run_growth_session_loop(active_session["session_id"]))
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
    if _growth_running:
        return {"error": "growth session is running; stop it before starting classic mode"}
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
    if _growth_running:
        return {"error": "growth session is running; stop it before starting arena mode"}
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
    if _growth_running:
        return {"error": "growth session is running; stop it before starting bootstrap mode"}
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
    if _growth_running:
        return {"error": "growth session is running; stop it before starting genesis mode"}
    if _genesis_running:
        return {"error": "genesis already running"}
    model = require_openai_model()
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    async def _run():
        global _genesis_running, _genesis_stop_flag, _genesis_status
        _genesis_running = True
        _genesis_stop_flag = [False]
        reset_genesis_status()
        _genesis_status["phase"] = "RESEARCH"
        try:
            async for event in run_genesis(
                client=client,
                model=model,
                max_iterations=req.max_iterations,
                stop_flag=_genesis_stop_flag,
            ):
                await broadcast(event)
                update_genesis_status(event)
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
    reset_genesis_status()
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
    return {"files": list_genesis_workspace_files(), "workspace": str(WORKSPACE_ROOT)}


@app.get("/api/genesis/narrative")
async def get_genesis_narrative():
    log_path = WORKSPACE_ROOT / "BUILD_LOG.md"
    if not log_path.exists():
        return {"content": None}
    content = log_path.read_text(encoding="utf-8", errors="replace")
    return {"content": content[-4000:] if len(content) > 4000 else content}


class GrowthSessionStartRequest(BaseModel):
    budget_cap_usd: float = Field(default=growth_session.DEFAULT_BUDGET_CAP_USD, gt=0)
    storage_cap_bytes: int = Field(default=growth_session.DEFAULT_STORAGE_CAP_BYTES, gt=1024)
    target_score: float = Field(default=growth_session.DEFAULT_TARGET_SCORE, ge=50, le=100)
    sustained_window: int = Field(default=growth_session.DEFAULT_SUSTAINED_WINDOW, ge=1, le=12)


@app.post("/api/growth/session/start")
async def start_growth_session(req: GrowthSessionStartRequest):
    global _growth_task
    if _is_running or _arena_running or _bootstrap_running or _genesis_running:
        return {"error": "another mode is already running; stop it before starting the growth session"}
    active = growth_session.get_active_session()
    if _growth_running:
        return {"error": "growth session already running"}
    if active and active["status"] == "completed":
        return {"error": "active growth session is complete; archive or reset it before starting a new one"}
    if active is None:
        await reset_growth_runtime_surfaces()
        active = growth_session.create_session(
            model=require_openai_model(),
            budget_cap_usd=req.budget_cap_usd,
            storage_cap_bytes=req.storage_cap_bytes,
            target_score=req.target_score,
            sustained_window=req.sustained_window,
        )
    _growth_task = asyncio.create_task(run_growth_session_loop(active["session_id"]))
    return {"status": "started", "session_id": active["session_id"]}


@app.post("/api/growth/session/pause")
async def pause_growth_session():
    global _growth_stop_flag
    active = growth_session.get_active_session()
    if not _growth_running or active is None:
        return {"error": "growth session not running"}
    _growth_stop_flag[0] = True
    return {"status": "stopping", "session_id": active["session_id"]}


@app.post("/api/growth/session/resume")
async def resume_growth_session():
    global _growth_task
    active = growth_session.get_active_session()
    if active is None:
        return {"error": "no active growth session"}
    if _growth_running or active["status"] == "running":
        if _growth_running:
            return {"error": "growth session already running"}
    if active["status"] == "completed":
        return {"error": "active growth session is complete; reset it to begin a new lineage"}
    _growth_task = asyncio.create_task(run_growth_session_loop(active["session_id"]))
    return {"status": "resuming", "session_id": active["session_id"]}


@app.post("/api/growth/session/archive")
async def archive_growth_session():
    active = growth_session.get_active_session()
    if active is None:
        return {"error": "no active growth session"}
    if _growth_running:
        return {"error": "cannot archive while the growth session is running"}
    archived = growth_session.archive_session_bundle(
        active["session_id"],
        reason="manual_archive",
        bootstrap_workspace=BOOTSTRAP_WORKSPACE,
        genesis_workspace=WORKSPACE_ROOT,
    )
    await reset_growth_runtime_surfaces()
    await broadcast({"event": "growth_archived", "data": {"session_id": archived["session_id"], "archive_path": archived["archive_path"]}, "source": "growth"})
    return {"status": "archived", "session_id": archived["session_id"], "archive_path": archived["archive_path"]}


@app.post("/api/growth/session/reset")
async def reset_growth_session():
    active = growth_session.get_active_session()
    if _growth_running:
        return {"error": "cannot reset while the growth session is running"}
    archived = None
    if active is not None:
        archived = growth_session.archive_session_bundle(
            active["session_id"],
            reason="reset",
            bootstrap_workspace=BOOTSTRAP_WORKSPACE,
            genesis_workspace=WORKSPACE_ROOT,
        )
    await reset_growth_runtime_surfaces()
    fresh = growth_session.create_session(model=require_openai_model())
    await broadcast({"event": "growth_session_reset", "data": {"session_id": fresh["session_id"], "archived_session_id": archived["session_id"] if archived else None}, "source": "growth"})
    return {"status": "reset", "session_id": fresh["session_id"], "archived_session_id": archived["session_id"] if archived else None}


@app.get("/api/growth/session")
async def get_growth_session():
    active = growth_session.get_active_session()
    if active is None:
        return {"session": None}
    return {
        "running": _growth_running,
        "session": active,
        "artifacts": growth_session.list_session_artifacts(active["session_id"]),
        "checkpoints": growth_session.list_checkpoints(active["session_id"]),
        "events": growth_session.list_recent_session_events(active["session_id"], limit=120),
        "scorecard_history": growth_session.list_scorecard_history(active["session_id"], limit=24),
    }


@app.get("/api/growth/session/artifacts")
async def get_growth_session_artifacts():
    active = growth_session.get_active_session()
    if active is None:
        return {"files": []}
    return {"files": growth_session.list_session_artifacts(active["session_id"])}


@app.get("/api/growth/session/scorecard")
async def get_growth_session_scorecard():
    active = growth_session.get_active_session()
    if active is None:
        return {"scorecard": None, "history": []}
    return {"scorecard": active["scorecard"], "history": growth_session.list_scorecard_history(active["session_id"], limit=24)}


@app.get("/api/growth/session/constraints")
async def get_growth_session_constraints():
    active = growth_session.get_active_session()
    if active is None:
        return {"constraints": None}
    return {
        "constraints": {
            "budget": active["budget"],
            "storage": active["storage"],
            "unlock_state": active["unlock_state"],
            "completion_state": active["completion_state"],
        }
    }


@app.get("/api/growth/session/checkpoints")
async def get_growth_session_checkpoints():
    active = growth_session.get_active_session()
    if active is None:
        return {"checkpoints": []}
    return {"checkpoints": growth_session.list_checkpoints(active["session_id"])}


@app.get("/api/growth/session/events")
async def get_growth_session_events(limit: int = 120):
    active = growth_session.get_active_session()
    if active is None:
        return {"events": []}
    return {"events": growth_session.list_recent_session_events(active["session_id"], limit=min(max(limit, 1), 500))}


@app.get("/api/growth/archive")
async def get_growth_archive():
    return {"sessions": growth_session.list_archived_sessions()}


@app.get("/api/growth/archive/{session_id}")
async def get_growth_archive_session(session_id: str):
    session = growth_session.get_session(session_id)
    if session is None or session["archived_at"] is None:
        return {"error": "archived session not found"}
    return {
        "session": session,
        "artifacts": growth_session.list_session_artifacts(session_id),
        "checkpoints": growth_session.list_checkpoints(session_id),
        "events": growth_session.list_recent_session_events(session_id, limit=500),
        "scorecard_history": growth_session.list_scorecard_history(session_id, limit=100),
    }


# ── Housekeeping endpoints ───────────────────────────────────────────────────

class HousekeepingStartRequest(BaseModel):
    interval_seconds: int = Field(default=300, ge=0, le=3600)
    run_quality_checks: bool = True
    max_cycles: int | None = Field(default=None, ge=1, le=1000)


@app.post("/api/housekeeping/start")
async def start_housekeeping(req: HousekeepingStartRequest):
    global _housekeeping_running, _housekeeping_stop_flag
    if _housekeeping_running:
        return {"error": "housekeeping already running"}

    async def _run():
        global _housekeeping_running, _housekeeping_stop_flag
        _housekeeping_running = True
        _housekeeping_stop_flag = [False]
        try:
            async for event in run_housekeeping(
                repo_root=REPO_ROOT,
                interval_seconds=req.interval_seconds,
                run_quality_checks=req.run_quality_checks,
                max_cycles=req.max_cycles,
                stop_flag=_housekeeping_stop_flag,
            ):
                update_housekeeping_status(event)
                await broadcast(event)
        except Exception as exc:
            await broadcast({"event": "housekeeping_error", "data": _error_data(exc, phase="housekeeping_run")})
        finally:
            _housekeeping_running = False

    asyncio.create_task(_run())
    return {
        "status": "started",
        "interval_seconds": req.interval_seconds,
        "run_quality_checks": req.run_quality_checks,
        "max_cycles": req.max_cycles,
    }


@app.post("/api/housekeeping/stop")
async def stop_housekeeping():
    global _housekeeping_stop_flag
    if not _housekeeping_running:
        return {"error": "housekeeping not running"}
    _housekeeping_stop_flag[0] = True
    return {"status": "stopping"}


@app.post("/api/housekeeping/reset")
async def reset_housekeeping():
    if _housekeeping_running:
        return {"error": "cannot reset while running — stop first"}
    reset_housekeeping_status()
    await broadcast({"event": "housekeeping_reset", "data": {}})
    return {"status": "reset"}


@app.get("/api/housekeeping/status")
async def get_housekeeping_status():
    return {
        "status": "running" if _housekeeping_running else "idle",
        **_housekeeping_status,
    }


@app.get("/api/housekeeping/report")
async def get_housekeeping_report(run_quality_checks: bool = True):
    snapshot = await asyncio.to_thread(collect_housekeeping_snapshot, REPO_ROOT, run_quality_checks)
    snapshot["cycle"] = _housekeeping_status.get("cycle", 0)
    return snapshot


@app.get("/api/housekeeping/supervisor/report")
async def get_housekeeping_supervisor_report(run_quality_checks: bool = True):
    snapshot = await asyncio.to_thread(collect_housekeeping_snapshot, REPO_ROOT, run_quality_checks)
    report = plan_supervisor_actions(snapshot)
    report["cycle"] = _housekeeping_supervisor_status.get("cycle", 0)
    return report


@app.post("/api/housekeeping/supervisor/start")
async def start_housekeeping_supervisor(req: HousekeepingStartRequest):
    global _housekeeping_supervisor_running, _housekeeping_supervisor_stop_flag
    if _housekeeping_supervisor_running:
        return {"error": "housekeeping supervisor already running"}

    async def _run():
        global _housekeeping_supervisor_running, _housekeeping_supervisor_stop_flag
        _housekeeping_supervisor_running = True
        _housekeeping_supervisor_stop_flag = [False]
        try:
            async for event in run_housekeeping_supervisor(
                repo_root=REPO_ROOT,
                interval_seconds=req.interval_seconds,
                run_quality_checks=req.run_quality_checks,
                max_cycles=req.max_cycles,
                stop_flag=_housekeeping_supervisor_stop_flag,
            ):
                update_housekeeping_supervisor_status(event)
                await broadcast(event)
        except Exception as exc:
            await broadcast(
                {"event": "housekeeping_supervisor_error", "data": _error_data(exc, phase="housekeeping_supervisor_run")}
            )
        finally:
            _housekeeping_supervisor_running = False

    asyncio.create_task(_run())
    return {
        "status": "started",
        "interval_seconds": req.interval_seconds,
        "run_quality_checks": req.run_quality_checks,
        "max_cycles": req.max_cycles,
    }


@app.post("/api/housekeeping/supervisor/stop")
async def stop_housekeeping_supervisor():
    global _housekeeping_supervisor_stop_flag
    if not _housekeeping_supervisor_running:
        return {"error": "housekeeping supervisor not running"}
    _housekeeping_supervisor_stop_flag[0] = True
    return {"status": "stopping"}


@app.post("/api/housekeeping/supervisor/reset")
async def reset_housekeeping_supervisor():
    if _housekeeping_supervisor_running:
        return {"error": "cannot reset while running — stop first"}
    reset_housekeeping_supervisor_status()
    await broadcast({"event": "housekeeping_supervisor_reset", "data": {}})
    return {"status": "reset"}


@app.get("/api/housekeeping/supervisor/status")
async def get_housekeeping_supervisor_status():
    return {
        "status": "running" if _housekeeping_supervisor_running else "idle",
        **_housekeeping_supervisor_status,
    }
