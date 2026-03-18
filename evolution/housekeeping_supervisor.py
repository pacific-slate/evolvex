"""
Supervisor orchestration for housekeeping audits.

Consumes housekeeping snapshots and turns them into operator-facing reports plus
approval-gated planned actions. This layer never mutates git state by itself.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

from evolution.housekeeping import collect_housekeeping_snapshot


def _checkpoint_actions(recommendation: dict | None) -> list[dict]:
    if not recommendation:
        return []

    actions = []
    for worktree in recommendation.get("worktrees", []):
        changed_files = worktree.get("changed_files", [])
        preview = ", ".join(changed_files[:4]) or "pending changes"
        actions.append(
            {
                "scope": "backup-auditor",
                "action_type": "checkpoint_commit",
                "approval_required": True,
                "summary": f"Prepare a checkpoint commit for {worktree.get('branch', '(unknown branch)')}",
                "reason": f"{worktree.get('path')}: pending files include {preview}",
                "suggested_command": f"git -C {worktree.get('path')} status --short",
            }
        )
    return actions


def _risk_actions(auditors: list[dict]) -> list[dict]:
    actions = []
    for audit in auditors:
        if audit["scope"] == "quality-auditor" and audit["state"] == "block":
            actions.append(
                {
                    "scope": audit["scope"],
                    "action_type": "run_backend_validation",
                    "approval_required": False,
                    "summary": "Re-run and fix the backend validation suite before blessing the repo.",
                    "reason": audit["summary"],
                    "suggested_command": "source .venv/bin/activate && python -m pytest tests/ -q",
                }
            )
        elif audit["scope"] == "docs-auditor" and audit["state"] != "ok":
            actions.append(
                {
                    "scope": audit["scope"],
                    "action_type": "update_docs",
                    "approval_required": True,
                    "summary": "Update operator-facing docs to reflect the current implementation delta.",
                    "reason": audit["summary"],
                    "suggested_command": None,
                }
            )
        elif audit["scope"] == "repo-auditor" and audit["state"] != "ok":
            actions.append(
                {
                    "scope": audit["scope"],
                    "action_type": "reconcile_repo_state",
                    "approval_required": True,
                    "summary": "Inspect branch divergence or ambiguous repo state before checkpointing.",
                    "reason": audit["summary"],
                    "suggested_command": "git status --short --branch && git worktree list --porcelain",
                }
            )
    return actions


def plan_supervisor_actions(snapshot: dict) -> dict:
    auditors = snapshot.get("auditors", [])
    checkpoint_recommendation = snapshot.get("checkpoint_recommendation")
    planned_actions = _checkpoint_actions(checkpoint_recommendation)
    planned_actions.extend(_risk_actions(auditors))

    deduped_actions: list[dict] = []
    seen = set()
    for action in planned_actions:
        key = (action["scope"], action["action_type"], action["summary"])
        if key in seen:
            continue
        seen.add(key)
        deduped_actions.append(action)

    return {
        "timestamp": time.time(),
        "overall_status": snapshot.get("overall_state", "ok"),
        "backup_coverage_summary": snapshot.get("backup_coverage_summary", {}),
        "active_risks": snapshot.get("active_risks", []),
        "recommended_next_actions": snapshot.get("recommended_next_actions", []),
        "planned_actions": deduped_actions,
        "auditors": auditors,
        "worktrees": snapshot.get("worktrees", []),
        "checkpoint_recommendation": checkpoint_recommendation,
    }


async def run_housekeeping_supervisor(
    repo_root: Path,
    interval_seconds: int = 300,
    run_quality_checks: bool = True,
    max_cycles: int | None = None,
    stop_flag: list[bool] | None = None,
):
    cycle = 0
    yield {
        "event": "housekeeping_supervisor_started",
        "data": {
            "repo_root": str(repo_root),
            "interval_seconds": interval_seconds,
            "run_quality_checks": run_quality_checks,
            "max_cycles": max_cycles,
        },
    }

    while True:
        if stop_flag and stop_flag[0]:
            yield {"event": "housekeeping_supervisor_stopped", "data": {"cycle": cycle}}
            return

        cycle += 1
        yield {"event": "housekeeping_supervisor_cycle_start", "data": {"cycle": cycle}}

        snapshot = await asyncio.to_thread(
            collect_housekeeping_snapshot,
            repo_root,
            run_quality_checks,
        )
        report = plan_supervisor_actions(snapshot)
        report["cycle"] = cycle
        yield {"event": "housekeeping_supervisor_report", "data": report}

        for action in report["planned_actions"]:
            yield {
                "event": "housekeeping_supervisor_action_planned",
                "data": {"cycle": cycle, **action},
            }

        if max_cycles is not None and cycle >= max_cycles:
            yield {
                "event": "housekeeping_supervisor_complete",
                "data": {
                    "cycles": cycle,
                    "overall_status": report["overall_status"],
                    "planned_action_count": len(report["planned_actions"]),
                },
            }
            return

        await asyncio.sleep(max(interval_seconds, 1))
