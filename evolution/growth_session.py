"""
Persistent growth session control-plane helpers.

The active growth session is durable in SQLite while artifacts remain on disk.
This module does not run the agent loop itself; it stores session state,
artifacts, checkpoints, lineage, and scorecard snapshots.
"""

from __future__ import annotations

import json
import os
import shutil
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
GROWTH_ROOT = Path(os.getenv("GROWTH_ROOT", str(REPO_ROOT / ".growth"))).resolve()
DB_PATH = GROWTH_ROOT / "growth.db"
ACTIVE_ROOT = GROWTH_ROOT / "active"
ARCHIVE_ROOT = GROWTH_ROOT / "archives"
ACTIVE_MANIFEST_PATH = ACTIVE_ROOT / "session.json"

DEFAULT_BUDGET_CAP_USD = 100.0
DEFAULT_STORAGE_CAP_BYTES = 250 * 1024 * 1024
DEFAULT_TARGET_SCORE = 84.0
DEFAULT_SUSTAINED_WINDOW = 3
DEFAULT_BOOTSTRAP_CHUNK_ROUNDS = 2
DEFAULT_GENESIS_CHUNK_ITERATIONS = 12

BOOTSTRAP_PHASES = {
    0: "handshake",
    1: "artifacts",
    2: "context",
    3: "build",
    4: "verify",
    5: "research",
    6: "integration",
}


def _now() -> str:
    return datetime.now(tz=UTC).isoformat()


def _json_dumps(value: Any) -> str:
    return json.dumps(value, sort_keys=True)


def _json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def ensure_growth_environment() -> None:
    GROWTH_ROOT.mkdir(parents=True, exist_ok=True)
    ACTIVE_ROOT.mkdir(parents=True, exist_ok=True)
    ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                is_active INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                phase TEXT NOT NULL,
                current_objective TEXT NOT NULL,
                model TEXT,
                budget_cap_usd REAL NOT NULL,
                budget_used_usd REAL NOT NULL DEFAULT 0,
                storage_cap_bytes INTEGER NOT NULL,
                storage_used_bytes INTEGER NOT NULL DEFAULT 0,
                target_score REAL NOT NULL,
                sustained_window INTEGER NOT NULL,
                sustained_hits INTEGER NOT NULL DEFAULT 0,
                bootstrap_round INTEGER NOT NULL DEFAULT 0,
                genesis_iterations INTEGER NOT NULL DEFAULT 0,
                stall_count INTEGER NOT NULL DEFAULT 0,
                completion_state TEXT NOT NULL DEFAULT 'incomplete',
                last_error TEXT,
                scorecard_json TEXT NOT NULL,
                unlock_state_json TEXT NOT NULL,
                outputs_json TEXT NOT NULL,
                summary_json TEXT NOT NULL,
                archive_reason TEXT,
                archive_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                archived_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active
            ON sessions(is_active)
            WHERE is_active = 1
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS session_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                event_name TEXT NOT NULL,
                source TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS artifact_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                source TEXT NOT NULL,
                workspace TEXT NOT NULL,
                path TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                recorded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checkpoint_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                scope TEXT NOT NULL,
                path TEXT NOT NULL,
                exists_flag INTEGER NOT NULL,
                recorded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scorecard_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                scorecard_json TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _connect() -> sqlite3.Connection:
    ensure_growth_environment()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def empty_scorecard() -> dict[str, float]:
    return {
        "logic": 0.0,
        "autonomy": 0.0,
        "artifact_quality": 0.0,
        "verification": 0.0,
        "stability": 0.0,
        "efficiency": 0.0,
        "overall": 0.0,
    }


def default_unlock_state() -> dict[str, Any]:
    return {
        "stage_id": 0,
        "stage": "handshake",
        "granted_capabilities": ["scratchpad_write", "scratchpad_read"],
        "next_gate": "artifacts",
    }


def create_session(
    *,
    model: str,
    budget_cap_usd: float = DEFAULT_BUDGET_CAP_USD,
    storage_cap_bytes: int = DEFAULT_STORAGE_CAP_BYTES,
    target_score: float = DEFAULT_TARGET_SCORE,
    sustained_window: int = DEFAULT_SUSTAINED_WINDOW,
) -> dict[str, Any]:
    now = _now()
    session_id = f"session-{uuid.uuid4().hex[:12]}"
    payload = {
        "session_id": session_id,
        "is_active": 1,
        "status": "idle",
        "phase": "handshake",
        "current_objective": "Invent a minimal shared interface and begin durable self-construction.",
        "model": model,
        "budget_cap_usd": float(budget_cap_usd),
        "budget_used_usd": 0.0,
        "storage_cap_bytes": int(storage_cap_bytes),
        "storage_used_bytes": 0,
        "target_score": float(target_score),
        "sustained_window": int(sustained_window),
        "sustained_hits": 0,
        "bootstrap_round": 0,
        "genesis_iterations": 0,
        "stall_count": 0,
        "completion_state": "incomplete",
        "last_error": None,
        "scorecard_json": _json_dumps(empty_scorecard()),
        "unlock_state_json": _json_dumps(default_unlock_state()),
        "outputs_json": _json_dumps({}),
        "summary_json": _json_dumps({}),
        "archive_reason": None,
        "archive_path": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        "archived_at": None,
    }
    with _connect() as conn:
        conn.execute("UPDATE sessions SET is_active = 0 WHERE is_active = 1")
        conn.execute(
            """
            INSERT INTO sessions (
                session_id, is_active, status, phase, current_objective, model,
                budget_cap_usd, budget_used_usd, storage_cap_bytes, storage_used_bytes,
                target_score, sustained_window, sustained_hits, bootstrap_round,
                genesis_iterations, stall_count, completion_state, last_error,
                scorecard_json, unlock_state_json, outputs_json, summary_json,
                archive_reason, archive_path, created_at, updated_at,
                completed_at, archived_at
            ) VALUES (
                :session_id, :is_active, :status, :phase, :current_objective, :model,
                :budget_cap_usd, :budget_used_usd, :storage_cap_bytes, :storage_used_bytes,
                :target_score, :sustained_window, :sustained_hits, :bootstrap_round,
                :genesis_iterations, :stall_count, :completion_state, :last_error,
                :scorecard_json, :unlock_state_json, :outputs_json, :summary_json,
                :archive_reason, :archive_path, :created_at, :updated_at,
                :completed_at, :archived_at
            )
            """,
            payload,
        )
        conn.commit()
    session = get_session(session_id)
    if session:
        write_active_manifest(session)
        return session
    raise RuntimeError("Failed to create growth session")


def _row_to_session(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "session_id": row["session_id"],
        "is_active": bool(row["is_active"]),
        "status": row["status"],
        "phase": row["phase"],
        "current_objective": row["current_objective"],
        "model": row["model"],
        "budget": {
            "cap_usd": float(row["budget_cap_usd"]),
            "used_usd": float(row["budget_used_usd"]),
            "remaining_usd": max(0.0, float(row["budget_cap_usd"]) - float(row["budget_used_usd"])),
        },
        "storage": {
            "cap_bytes": int(row["storage_cap_bytes"]),
            "used_bytes": int(row["storage_used_bytes"]),
            "remaining_bytes": max(0, int(row["storage_cap_bytes"]) - int(row["storage_used_bytes"])),
        },
        "target_score": float(row["target_score"]),
        "sustained_window": int(row["sustained_window"]),
        "sustained_hits": int(row["sustained_hits"]),
        "bootstrap_round": int(row["bootstrap_round"]),
        "genesis_iterations": int(row["genesis_iterations"]),
        "stall_count": int(row["stall_count"]),
        "completion_state": row["completion_state"],
        "last_error": row["last_error"],
        "scorecard": _json_loads(row["scorecard_json"], empty_scorecard()),
        "unlock_state": _json_loads(row["unlock_state_json"], default_unlock_state()),
        "outputs": _json_loads(row["outputs_json"], {}),
        "summary": _json_loads(row["summary_json"], {}),
        "archive_reason": row["archive_reason"],
        "archive_path": row["archive_path"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "completed_at": row["completed_at"],
        "archived_at": row["archived_at"],
    }


def get_active_session() -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE is_active = 1").fetchone()
    return _row_to_session(row)


def get_session(session_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    return _row_to_session(row)


def update_session(session_id: str, **changes: Any) -> dict[str, Any]:
    if not changes:
        session = get_session(session_id)
        if session is None:
            raise RuntimeError(f"Unknown session: {session_id}")
        return session
    encoded = dict(changes)
    for key in ("scorecard", "unlock_state", "outputs", "summary"):
        if key in encoded:
            encoded[f"{key}_json"] = _json_dumps(encoded.pop(key))
    encoded["updated_at"] = _now()
    sets = ", ".join(f"{key} = :{key}" for key in encoded)
    encoded["session_id"] = session_id
    with _connect() as conn:
        conn.execute(f"UPDATE sessions SET {sets} WHERE session_id = :session_id", encoded)
        conn.commit()
    session = get_session(session_id)
    if session is None:
        raise RuntimeError(f"Unknown session: {session_id}")
    if session["is_active"]:
        write_active_manifest(session)
    return session


def log_session_event(session_id: str, event_name: str, payload: dict[str, Any], *, source: str) -> None:
    ts = _now()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO session_events (session_id, ts, event_name, source, payload_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, ts, event_name, source, _json_dumps(payload)),
        )
        conn.commit()


def list_recent_session_events(session_id: str, limit: int = 120) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT ts, event_name, source, payload_json
            FROM session_events
            WHERE session_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
    return [
        {
            "ts": row["ts"],
            "event": row["event_name"],
            "source": row["source"],
            "data": _json_loads(row["payload_json"], {}),
        }
        for row in reversed(rows)
    ]


def replace_artifacts(session_id: str, source: str, workspace: str, files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recorded_at = _now()
    with _connect() as conn:
        conn.execute(
            "DELETE FROM artifact_records WHERE session_id = ? AND source = ?",
            (session_id, source),
        )
        conn.executemany(
            """
            INSERT INTO artifact_records (session_id, source, workspace, path, size_bytes, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    session_id,
                    source,
                    workspace,
                    str(item.get("path", "")),
                    int(item.get("size_bytes", 0)),
                    recorded_at,
                )
                for item in files
            ],
        )
        conn.commit()
    return list_session_artifacts(session_id)


def list_session_artifacts(session_id: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT source, workspace, path, size_bytes, recorded_at
            FROM artifact_records
            WHERE session_id = ?
            ORDER BY source, path
            """,
            (session_id,),
        ).fetchall()
    return [
        {
            "source": row["source"],
            "workspace": row["workspace"],
            "path": row["path"],
            "size_bytes": int(row["size_bytes"]),
            "recorded_at": row["recorded_at"],
        }
        for row in rows
    ]


def replace_checkpoints(session_id: str, checkpoints: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recorded_at = _now()
    with _connect() as conn:
        conn.execute("DELETE FROM checkpoint_records WHERE session_id = ?", (session_id,))
        conn.executemany(
            """
            INSERT INTO checkpoint_records (session_id, scope, path, exists_flag, recorded_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    session_id,
                    str(item.get("scope", "")),
                    str(item.get("path", "")),
                    1 if item.get("exists") else 0,
                    recorded_at,
                )
                for item in checkpoints
            ],
        )
        conn.commit()
    return list_checkpoints(session_id)


def list_checkpoints(session_id: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT scope, path, exists_flag, recorded_at
            FROM checkpoint_records
            WHERE session_id = ?
            ORDER BY scope
            """,
            (session_id,),
        ).fetchall()
    return [
        {
            "scope": row["scope"],
            "path": row["path"],
            "exists": bool(row["exists_flag"]),
            "recorded_at": row["recorded_at"],
        }
        for row in rows
    ]


def append_scorecard_snapshot(session_id: str, scorecard: dict[str, Any]) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO scorecard_snapshots (session_id, ts, scorecard_json) VALUES (?, ?, ?)",
            (session_id, _now(), _json_dumps(scorecard)),
        )
        conn.commit()


def list_scorecard_history(session_id: str, limit: int = 24) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT ts, scorecard_json
            FROM scorecard_snapshots
            WHERE session_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
    return [
        {
            "ts": row["ts"],
            "scorecard": _json_loads(row["scorecard_json"], empty_scorecard()),
        }
        for row in reversed(rows)
    ]


def archive_session_bundle(
    session_id: str,
    *,
    reason: str,
    bootstrap_workspace: Path | None,
    genesis_workspace: Path | None,
) -> dict[str, Any]:
    session = get_session(session_id)
    if session is None:
        raise RuntimeError(f"Unknown session: {session_id}")
    archive_dir = ARCHIVE_ROOT / session_id
    archive_dir.mkdir(parents=True, exist_ok=True)
    if bootstrap_workspace and bootstrap_workspace.exists():
        shutil.copytree(bootstrap_workspace, archive_dir / "bootstrap_workspace", dirs_exist_ok=True)
    if genesis_workspace and genesis_workspace.exists():
        shutil.copytree(genesis_workspace, archive_dir / "genesis_workspace", dirs_exist_ok=True)

    manifest = {
        "session": session,
        "artifacts": list_session_artifacts(session_id),
        "checkpoints": list_checkpoints(session_id),
        "events": list_recent_session_events(session_id, limit=500),
        "archived_at": _now(),
        "archive_reason": reason,
    }
    (archive_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with _connect() as conn:
        conn.execute(
            """
            UPDATE sessions
            SET is_active = 0,
                status = 'archived',
                archive_reason = ?,
                archive_path = ?,
                archived_at = ?,
                updated_at = ?
            WHERE session_id = ?
            """,
            (reason, str(archive_dir), manifest["archived_at"], manifest["archived_at"], session_id),
        )
        conn.commit()
    clear_active_manifest()
    archived = get_session(session_id)
    if archived is None:
        raise RuntimeError(f"Failed to archive session: {session_id}")
    return archived


def list_archived_sessions(limit: int = 40) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM sessions
            WHERE archived_at IS NOT NULL
            ORDER BY archived_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [_row_to_session(row) for row in rows if row is not None]


def write_active_manifest(session: dict[str, Any]) -> None:
    ensure_growth_environment()
    ACTIVE_MANIFEST_PATH.write_text(json.dumps(session, indent=2), encoding="utf-8")


def clear_active_manifest() -> None:
    ACTIVE_MANIFEST_PATH.unlink(missing_ok=True)


def sum_artifact_bytes(files: list[dict[str, Any]]) -> int:
    return sum(int(item.get("size_bytes", 0)) for item in files)


def detect_outputs(artifacts: list[dict[str, Any]], checkpoints: list[dict[str, Any]]) -> dict[str, Any]:
    paths = {item["path"] for item in artifacts}
    entry_candidates = ("agent/core.py", "agent.py", "main.py", "bootstrap_agent.py", "src/agent.py")
    entrypoint = next((path for path in entry_candidates if path in paths), None)
    return {
        "entrypoint": entrypoint,
        "artifact_count": len(artifacts),
        "checkpoint_count": sum(1 for item in checkpoints if item.get("exists")),
        "has_build_log": "BUILD_LOG.md" in paths,
        "has_protocol": "PROTOCOL.md" in paths,
        "has_readme": "README.md" in paths,
        "has_tests": any(path.startswith("test_") or "/test_" in path or path.startswith("tests/") for path in paths),
    }


def compute_scorecard(
    *,
    budget_used_usd: float,
    budget_cap_usd: float,
    storage_used_bytes: int,
    storage_cap_bytes: int,
    bootstrap_assessment: dict[str, Any] | None,
    bootstrap_stage_id: int,
    bootstrap_protocol: dict[str, Any] | None,
    genesis_assessment: dict[str, Any] | None,
    artifact_records: list[dict[str, Any]],
    recent_events: list[dict[str, Any]],
    stall_count: int,
) -> dict[str, float]:
    bootstrap_assessment = bootstrap_assessment or {}
    bootstrap_protocol = bootstrap_protocol or {}
    genesis_assessment = genesis_assessment or {}
    stable_tokens = int(bootstrap_protocol.get("stable_tokens", 0) or 0)
    error_events = sum(
        1
        for item in recent_events[-25:]
        if any(token in item.get("event", "") for token in ("error", "failed", "rejected", "stalled"))
    )
    artifact_count = len(artifact_records)
    has_tests = any(
        record["path"].startswith("test_") or "/test_" in record["path"] or record["path"].startswith("tests/")
        for record in artifact_records
    )
    has_entrypoint = any(
        record["path"] in {"agent/core.py", "agent.py", "main.py", "bootstrap_agent.py", "src/agent.py"}
        for record in artifact_records
    )
    logic = max(
        float(genesis_assessment.get("reasoning", 0) or 0),
        float(bootstrap_assessment.get("language", 0) or 0),
        float(stable_tokens * 20),
    )
    autonomy = max(
        float(genesis_assessment.get("self_improvement", 0) or 0),
        float(bootstrap_assessment.get("autonomy", 0) or 0),
        float(25 + bootstrap_stage_id * 10),
    )
    artifact_quality = min(
        100.0,
        float(20 + artifact_count * 6 + (15 if has_entrypoint else 0) + (10 if "BUILD_LOG.md" in {a["path"] for a in artifact_records} else 0)),
    )
    verification = min(
        100.0,
        max(
            float(genesis_assessment.get("error_handling", 0) or 0),
            float(bootstrap_assessment.get("traceability", 0) or 0),
        )
        + (10 if has_tests else 0),
    )
    stability = max(0.0, min(100.0, 85.0 - error_events * 12.0 - stall_count * 10.0 + (5.0 if artifact_count > 0 else 0.0)))
    budget_ratio = 0.0 if budget_cap_usd <= 0 else min(1.0, budget_used_usd / budget_cap_usd)
    storage_ratio = 0.0 if storage_cap_bytes <= 0 else min(1.0, storage_used_bytes / storage_cap_bytes)
    efficiency = max(
        0.0,
        min(
            100.0,
            100.0
            - budget_ratio * 45.0
            - storage_ratio * 35.0
            + min(20.0, artifact_count * 2.0),
        ),
    )
    overall = (
        logic * 0.25
        + autonomy * 0.20
        + artifact_quality * 0.20
        + verification * 0.20
        + stability * 0.10
        + efficiency * 0.05
    )
    return {
        "logic": round(min(100.0, logic), 1),
        "autonomy": round(min(100.0, autonomy), 1),
        "artifact_quality": round(artifact_quality, 1),
        "verification": round(verification, 1),
        "stability": round(stability, 1),
        "efficiency": round(efficiency, 1),
        "overall": round(min(100.0, overall), 1),
    }


def evaluate_completion(
    *,
    scorecard: dict[str, float],
    target_score: float,
    sustained_hits: int,
    sustained_window: int,
    budget_used_usd: float,
    budget_cap_usd: float,
    storage_used_bytes: int,
    storage_cap_bytes: int,
) -> dict[str, Any]:
    if budget_cap_usd > 0 and budget_used_usd >= budget_cap_usd:
        return {"state": "budget_capped", "sustained_hits": 0, "completed": False}
    if storage_cap_bytes > 0 and storage_used_bytes >= storage_cap_bytes:
        return {"state": "storage_capped", "sustained_hits": 0, "completed": False}
    meets = (
        scorecard.get("overall", 0.0) >= target_score
        and scorecard.get("logic", 0.0) >= max(70.0, target_score - 12.0)
        and scorecard.get("verification", 0.0) >= 65.0
        and scorecard.get("stability", 0.0) >= 60.0
        and scorecard.get("autonomy", 0.0) >= 65.0
    )
    next_hits = sustained_hits + 1 if meets else 0
    return {
        "state": "complete" if next_hits >= sustained_window else "incomplete",
        "sustained_hits": next_hits,
        "completed": next_hits >= sustained_window,
    }


def phase_from_bootstrap_stage(stage_id: int, fallback: str = "handshake") -> str:
    return BOOTSTRAP_PHASES.get(stage_id, fallback)
