"""Tests for evolution/housekeeping.py"""

from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

from evolution.housekeeping import collect_housekeeping_snapshot, run_housekeeping


def _git(args: list[str], cwd: Path) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


def _init_repo(path: Path) -> None:
    _git(["init", "-b", "main"], cwd=path)
    _git(["config", "user.name", "Test User"], cwd=path)
    _git(["config", "user.email", "test@example.com"], cwd=path)
    (path / "README.md").write_text("# Test Repo\n", encoding="utf-8")
    (path / "api.py").write_text("def ping():\n    return 'pong'\n", encoding="utf-8")
    (path / "tests").mkdir()
    (path / "tests" / "test_smoke.py").write_text("def test_smoke():\n    assert True\n", encoding="utf-8")
    _git(["add", "."], cwd=path)
    _git(["commit", "-m", "initial"], cwd=path)


def test_collect_housekeeping_snapshot_clean_repo(tmp_path):
    _init_repo(tmp_path)

    snapshot = collect_housekeeping_snapshot(tmp_path, run_quality_checks=False)

    assert snapshot["overall_state"] == "ok"
    scopes = {audit["scope"]: audit["state"] for audit in snapshot["auditors"]}
    assert scopes["repo-auditor"] == "ok"
    assert scopes["backup-auditor"] == "ok"
    assert scopes["docs-auditor"] == "ok"
    assert snapshot["active_risks"] == []
    assert snapshot["backup_coverage_summary"]["status"] == "ok"
    assert all("timestamp" in audit for audit in snapshot["auditors"])
    assert snapshot["checkpoint_recommendation"] is None


def test_collect_housekeeping_snapshot_recommends_checkpoint_for_dirty_code(tmp_path):
    _init_repo(tmp_path)
    (tmp_path / "api.py").write_text("def ping():\n    return 'changed'\n", encoding="utf-8")

    snapshot = collect_housekeeping_snapshot(tmp_path, run_quality_checks=False)

    assert snapshot["overall_state"] == "warn"
    backup_audit = next(audit for audit in snapshot["auditors"] if audit["scope"] == "backup-auditor")
    assert backup_audit["state"] == "warn"
    assert snapshot["backup_coverage_summary"]["checkpoint_recommended"] is True
    assert snapshot["recommended_next_actions"]
    assert snapshot["checkpoint_recommendation"] is not None
    assert snapshot["checkpoint_recommendation"]["worktrees"][0]["changed_files"] == ["api.py"]


def test_collect_housekeeping_snapshot_flags_doc_drift(tmp_path):
    _init_repo(tmp_path)
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / "worker.py").write_text("def work():\n    return 1\n", encoding="utf-8")

    snapshot = collect_housekeeping_snapshot(tmp_path, run_quality_checks=False)

    docs_audit = next(audit for audit in snapshot["auditors"] if audit["scope"] == "docs-auditor")
    assert docs_audit["state"] == "warn"
    assert "source changes present" in docs_audit["evidence"][0]


def test_collect_housekeeping_snapshot_blocks_untracked_source_files(tmp_path):
    _init_repo(tmp_path)
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts" / "new_tool.py").write_text("def run():\n    return 1\n", encoding="utf-8")

    snapshot = collect_housekeeping_snapshot(tmp_path, run_quality_checks=False)

    repo_audit = next(audit for audit in snapshot["auditors"] if audit["scope"] == "repo-auditor")
    assert snapshot["overall_state"] == "block"
    assert repo_audit["state"] == "block"
    assert "untracked source files" in repo_audit["evidence"][-1]


def test_run_housekeeping_emits_checkpoint_event_for_dirty_repo(tmp_path):
    _init_repo(tmp_path)
    (tmp_path / "api.py").write_text("def ping():\n    return 'dirty'\n", encoding="utf-8")

    async def _collect():
        events = []
        async for event in run_housekeeping(
            tmp_path,
            interval_seconds=0,
            run_quality_checks=False,
            max_cycles=1,
        ):
            events.append(event)
        return events

    events = asyncio.run(_collect())
    names = [event["event"] for event in events]
    assert "housekeeping_started" in names
    assert "housekeeping_audit" in names
    assert "housekeeping_checkpoint_recommended" in names
    assert events[-1]["event"] == "housekeeping_complete"
