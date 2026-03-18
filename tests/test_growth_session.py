from pathlib import Path

from evolution import growth_session


def _configure_growth_root(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(growth_session, "GROWTH_ROOT", tmp_path)
    monkeypatch.setattr(growth_session, "DB_PATH", tmp_path / "growth.db")
    monkeypatch.setattr(growth_session, "ACTIVE_ROOT", tmp_path / "active")
    monkeypatch.setattr(growth_session, "ARCHIVE_ROOT", tmp_path / "archives")
    monkeypatch.setattr(growth_session, "ACTIVE_MANIFEST_PATH", tmp_path / "active" / "session.json")
    growth_session.ensure_growth_environment()


def test_growth_session_lifecycle(monkeypatch, tmp_path):
    _configure_growth_root(monkeypatch, tmp_path)

    session = growth_session.create_session(model="gpt-test", budget_cap_usd=42, storage_cap_bytes=4096, target_score=88, sustained_window=2)

    assert session["status"] == "idle"
    assert session["budget"]["cap_usd"] == 42
    assert growth_session.get_active_session()["session_id"] == session["session_id"]
    assert (tmp_path / "active" / "session.json").exists()

    growth_session.log_session_event(session["session_id"], "growth_session_started", {"phase": "handshake"}, source="growth")
    growth_session.replace_artifacts(
        session["session_id"],
        "genesis",
        str(tmp_path / "workspace"),
        [{"path": "agent.py", "size_bytes": 128}, {"path": "BUILD_LOG.md", "size_bytes": 64}],
    )
    growth_session.replace_checkpoints(
        session["session_id"],
        [{"scope": "genesis", "path": str(tmp_path / "workspace" / ".checkpoint.json"), "exists": True}],
    )
    updated = growth_session.update_session(
        session["session_id"],
        status="paused",
        phase="self_improve",
        scorecard={"logic": 82, "autonomy": 77, "artifact_quality": 80, "verification": 76, "stability": 71, "efficiency": 69, "overall": 78},
    )

    assert updated["status"] == "paused"
    assert updated["phase"] == "self_improve"
    assert updated["scorecard"]["logic"] == 82
    assert len(growth_session.list_recent_session_events(session["session_id"])) == 1
    assert len(growth_session.list_session_artifacts(session["session_id"])) == 2
    assert growth_session.list_checkpoints(session["session_id"])[0]["exists"] is True

    bootstrap_workspace = tmp_path / "bootstrap_workspace"
    genesis_workspace = tmp_path / "genesis_workspace"
    bootstrap_workspace.mkdir()
    genesis_workspace.mkdir()
    (bootstrap_workspace / "PROTOCOL.md").write_text("# protocol\n", encoding="utf-8")
    (genesis_workspace / "agent.py").write_text("def main():\n    return True\n", encoding="utf-8")

    archived = growth_session.archive_session_bundle(
        session["session_id"],
        reason="test_archive",
        bootstrap_workspace=bootstrap_workspace,
        genesis_workspace=genesis_workspace,
    )

    assert archived["status"] == "archived"
    assert archived["archive_reason"] == "test_archive"
    assert Path(archived["archive_path"]).exists()
    assert (Path(archived["archive_path"]) / "manifest.json").exists()
    assert growth_session.get_active_session() is None


def test_scorecard_and_completion_logic(monkeypatch, tmp_path):
    _configure_growth_root(monkeypatch, tmp_path)

    scorecard = growth_session.compute_scorecard(
        budget_used_usd=12.5,
        budget_cap_usd=100.0,
        storage_used_bytes=4096,
        storage_cap_bytes=1024 * 1024,
        bootstrap_assessment={"autonomy": 74, "language": 68, "traceability": 70, "overall": 72},
        bootstrap_stage_id=6,
        bootstrap_protocol={"stable_tokens": 4},
        genesis_assessment={"reasoning": 88, "self_improvement": 83, "error_handling": 79},
        artifact_records=[
            {"path": "agent.py", "size_bytes": 128},
            {"path": "BUILD_LOG.md", "size_bytes": 64},
            {"path": "tests/test_agent.py", "size_bytes": 64},
        ],
        recent_events=[{"event": "growth_scorecard_updated"}, {"event": "genesis_chunk_complete"}],
        stall_count=0,
    )

    assert scorecard["logic"] >= 80
    assert scorecard["verification"] >= 79
    assert scorecard["overall"] > 70

    incomplete = growth_session.evaluate_completion(
        scorecard=scorecard,
        target_score=90,
        sustained_hits=0,
        sustained_window=2,
        budget_used_usd=12.5,
        budget_cap_usd=100.0,
        storage_used_bytes=4096,
        storage_cap_bytes=1024 * 1024,
    )
    assert incomplete["completed"] is False

    complete = growth_session.evaluate_completion(
        scorecard={**scorecard, "overall": 92.0, "logic": 90.0, "verification": 80.0, "stability": 80.0, "autonomy": 85.0},
        target_score=90,
        sustained_hits=1,
        sustained_window=2,
        budget_used_usd=12.5,
        budget_cap_usd=100.0,
        storage_used_bytes=4096,
        storage_cap_bytes=1024 * 1024,
    )
    assert complete["completed"] is True
    assert complete["state"] == "complete"
