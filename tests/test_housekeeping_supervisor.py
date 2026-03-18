"""Tests for evolution/housekeeping_supervisor.py"""

from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

from evolution.housekeeping import collect_housekeeping_snapshot
from evolution.housekeeping_supervisor import plan_supervisor_actions, run_housekeeping_supervisor


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


def test_plan_supervisor_actions_clean_repo(tmp_path):
    _init_repo(tmp_path)
    snapshot = collect_housekeeping_snapshot(tmp_path, run_quality_checks=False)

    report = plan_supervisor_actions(snapshot)

    assert report["overall_status"] == "ok"
    assert report["planned_actions"] == []
    assert report["active_risks"] == []


def test_plan_supervisor_actions_recommends_checkpoint_for_dirty_repo(tmp_path):
    _init_repo(tmp_path)
    (tmp_path / "api.py").write_text("def ping():\n    return 'dirty'\n", encoding="utf-8")
    snapshot = collect_housekeeping_snapshot(tmp_path, run_quality_checks=False)

    report = plan_supervisor_actions(snapshot)

    assert report["overall_status"] == "warn"
    assert any(action["action_type"] == "checkpoint_commit" for action in report["planned_actions"])
    assert report["recommended_next_actions"]


def test_run_housekeeping_supervisor_emits_report_and_actions(tmp_path):
    _init_repo(tmp_path)
    (tmp_path / "api.py").write_text("def ping():\n    return 'dirty'\n", encoding="utf-8")

    async def _collect():
        events = []
        async for event in run_housekeeping_supervisor(
            tmp_path,
            interval_seconds=0,
            run_quality_checks=False,
            max_cycles=1,
        ):
            events.append(event)
        return events

    events = asyncio.run(_collect())
    names = [event["event"] for event in events]
    assert "housekeeping_supervisor_started" in names
    assert "housekeeping_supervisor_report" in names
    assert "housekeeping_supervisor_action_planned" in names
    assert events[-1]["event"] == "housekeeping_supervisor_complete"
