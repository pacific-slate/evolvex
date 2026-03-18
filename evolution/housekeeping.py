"""
Housekeeping audits for repo hygiene, backup readiness, documentation drift,
and required validation checks.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path


STATE_RANK = {"ok": 0, "warn": 1, "block": 2}
DOC_FILES = {"README.md", "AGENTS.md", "arena_spec.md", "codex_plan.md", "dashboard/README.md", ".env.example"}
WATCHED_PREFIXES = ("agents/", "evolution/", "dashboard/", "scripts/", "tests/")
WATCHED_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".css",
    ".mjs",
    ".cjs",
    ".yml",
    ".yaml",
    ".toml",
}
ROOT_WATCHED_FILES = {"api.py", "requirements.txt", "pytest.ini", "pyrightconfig.json"}


@dataclass
class FileChange:
    status: str
    path: str


@dataclass
class WorktreeState:
    path: str
    branch: str
    head: str
    upstream: str | None
    ahead: int
    behind: int
    changed_files: list[FileChange]
    conflicts: list[str]

    @property
    def docs_dirty(self) -> list[str]:
        return [change.path for change in self.changed_files if _is_doc_path(change.path)]

    @property
    def source_dirty(self) -> list[str]:
        return [change.path for change in self.changed_files if _is_source_path(change.path)]

    @property
    def changed_count(self) -> int:
        return len(self.changed_files)

    @property
    def untracked_source_files(self) -> list[str]:
        return [
            change.path
            for change in self.changed_files
            if change.status == "??" and _is_source_path(change.path)
        ]


def _run_command(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def _run_git(args: list[str], cwd: Path) -> str:
    result = _run_command(["git", *args], cwd=cwd)
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip() or "unknown git error"
        raise RuntimeError(f"git {' '.join(args)} failed in {cwd}: {stderr}")
    return result.stdout.rstrip()


def _has_git_remote(cwd: Path) -> bool:
    return bool(_run_git(["remote"], cwd=cwd).strip())


def _is_doc_path(path: str) -> bool:
    return path in DOC_FILES


def _is_source_path(path: str) -> bool:
    if _is_doc_path(path):
        return False
    if path in ROOT_WATCHED_FILES:
        return True
    if path.startswith(WATCHED_PREFIXES):
        return True
    return Path(path).suffix in WATCHED_SUFFIXES


def _parse_status_line(line: str) -> FileChange:
    status = line[:2]
    raw_path = line[3:]
    path = raw_path.split(" -> ", 1)[-1]
    return FileChange(status=status, path=path)


def _make_audit(
    *,
    scope: str,
    state: str,
    summary: str,
    evidence: list[str],
    recommended_action: str | None,
    timestamp: float,
) -> dict:
    return {
        "scope": scope,
        "timestamp": timestamp,
        "state": state,
        "summary": summary,
        "evidence": evidence,
        "recommended_action": recommended_action,
    }


def list_worktrees(repo_root: Path) -> list[Path]:
    output = _run_git(["worktree", "list", "--porcelain"], cwd=repo_root)
    worktrees: list[Path] = []
    for line in output.splitlines():
        if line.startswith("worktree "):
            worktrees.append(Path(line.split(" ", 1)[1]))
    return worktrees or [repo_root]


def collect_worktree_state(path: Path) -> WorktreeState:
    branch = _run_git(["branch", "--show-current"], cwd=path)
    head = _run_git(["rev-parse", "--short", "HEAD"], cwd=path)
    status_output = _run_git(
        ["status", "--porcelain", "--untracked-files=all"],
        cwd=path,
    )
    changed_files = [
        _parse_status_line(line)
        for line in status_output.splitlines()
        if line.strip()
    ]
    conflicts = [
        change.path
        for change in changed_files
        if "U" in change.status or change.status in {"AA", "DD"}
    ]

    upstream_result = _run_command(
        ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        cwd=path,
    )
    upstream = upstream_result.stdout.strip() if upstream_result.returncode == 0 else None

    ahead = 0
    behind = 0
    if upstream:
        divergence = _run_git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], cwd=path)
        left, right = divergence.split()
        ahead = int(left)
        behind = int(right)

    return WorktreeState(
        path=str(path),
        branch=branch or "(detached)",
        head=head,
        upstream=upstream,
        ahead=ahead,
        behind=behind,
        changed_files=changed_files,
        conflicts=conflicts,
    )


def audit_repo(worktrees: list[WorktreeState], repo_root: Path, timestamp: float) -> dict:
    evidence = []
    warnings = []
    blocks = []
    root_text = str(repo_root)
    has_remote = _has_git_remote(repo_root)

    for worktree in worktrees:
        prefix = "root" if worktree.path == root_text else "worktree"
        evidence.append(
            f"{prefix} {worktree.branch} @ {worktree.head} "
            f"({worktree.changed_count} changed, ahead {worktree.ahead}, behind {worktree.behind})"
        )

        if worktree.conflicts:
            blocks.append(f"{worktree.path}: merge conflicts in {', '.join(worktree.conflicts[:4])}")
        if worktree.branch == "(detached)":
            warnings.append(f"{worktree.path}: detached HEAD")
        if worktree.behind > 0:
            warnings.append(f"{worktree.path}: branch is behind upstream by {worktree.behind} commit(s)")
        if worktree.ahead > 0 and worktree.behind > 0:
            warnings.append(f"{worktree.path}: branch has diverged from upstream")
        if has_remote and not worktree.upstream:
            warnings.append(f"{worktree.path}: branch has no upstream tracking branch configured")
        if worktree.untracked_source_files:
            blocks.append(
                f"{worktree.path}: untracked source files in active areas: {', '.join(worktree.untracked_source_files[:6])}"
            )

    if blocks:
        return _make_audit(
            scope="repo-auditor",
            state="block",
            summary="Git integrity issues need attention before the repo is inspection-ready.",
            evidence=evidence + blocks + warnings,
            recommended_action="Resolve merge conflicts, detached HEAD state, or ambiguous untracked source files before checkpointing.",
            timestamp=timestamp,
        )
    if warnings:
        return _make_audit(
            scope="repo-auditor",
            state="warn",
            summary="Repo structure is usable but there are branch hygiene issues to review.",
            evidence=evidence + warnings,
            recommended_action="Reconcile branch divergence and detached worktrees before formal inspection.",
            timestamp=timestamp,
        )
    return _make_audit(
        scope="repo-auditor",
        state="ok",
        summary="Branches and worktrees are structurally healthy.",
        evidence=evidence,
        recommended_action=None,
        timestamp=timestamp,
    )


def _checkpoint_evidence(repo_root: Path) -> list[str]:
    now = time.time()
    evidence = []

    classic_dir = repo_root / "checkpoints"
    classic_files = []
    if classic_dir.exists():
        classic_files.extend(classic_dir.glob("*.json"))
        classic_files.extend(classic_dir.glob("*.pkl"))
    if classic_files:
        latest = max(classic_files, key=lambda path: path.stat().st_mtime)
        age = int(now - latest.stat().st_mtime)
        evidence.append(f"classic checkpoint: {latest.relative_to(repo_root)} ({age}s old)")
    else:
        evidence.append("classic checkpoint: none found")

    for label, path in (
        ("bootstrap checkpoint", repo_root / ".bootstrap_workspace" / ".bootstrap_checkpoint.json"),
        ("genesis checkpoint", repo_root / "workspace" / ".checkpoint.json"),
    ):
        if path.exists():
            age = int(now - path.stat().st_mtime)
            evidence.append(f"{label}: {path.relative_to(repo_root)} ({age}s old)")
        else:
            evidence.append(f"{label}: none found")

    return evidence


def audit_backup(worktrees: list[WorktreeState], repo_root: Path, timestamp: float) -> tuple[dict, dict | None]:
    dirty_worktrees = [worktree for worktree in worktrees if worktree.changed_files]
    checkpoint_evidence = _checkpoint_evidence(repo_root)
    if not dirty_worktrees:
        return (
            _make_audit(
                scope="backup-auditor",
                state="ok",
                summary="No uncommitted changes detected across active worktrees.",
                evidence=["Every tracked worktree is currently checkpoint-safe.", *checkpoint_evidence],
                recommended_action=None,
                timestamp=timestamp,
            ),
            None,
        )

    evidence = []
    recommendation = {"worktrees": [], "summary": "Create a local checkpoint commit before further drift."}
    for worktree in dirty_worktrees:
        source_dirty = worktree.source_dirty
        changed_files = source_dirty or [change.path for change in worktree.changed_files]
        evidence.append(
            f"{worktree.path}: {len(changed_files)} pending file(s) on {worktree.branch}"
        )
        recommendation["worktrees"].append(
            {
                "path": worktree.path,
                "branch": worktree.branch,
                "changed_files": changed_files[:12],
                "changed_count": len(changed_files),
            }
        )
    evidence.extend(checkpoint_evidence)

    return (
        _make_audit(
            scope="backup-auditor",
            state="warn",
            summary="Uncommitted work exists; checkpoint coverage is incomplete.",
            evidence=evidence,
            recommended_action="Create a local checkpoint commit or explicitly defer the checkpoint.",
            timestamp=timestamp,
        ),
        recommendation,
    )


def audit_docs(worktrees: list[WorktreeState], timestamp: float) -> dict:
    drift = []
    for worktree in worktrees:
        if worktree.source_dirty and not worktree.docs_dirty:
            drift.append(
                f"{worktree.path}: source changes present without README.md, AGENTS.md, arena_spec.md, or codex_plan.md updates"
            )

    if drift:
        return _make_audit(
            scope="docs-auditor",
            state="warn",
            summary="Implementation drift is not reflected in project docs yet.",
            evidence=drift,
            recommended_action="Update the relevant operator docs before declaring the repo inspection-ready.",
            timestamp=timestamp,
        )
    return _make_audit(
        scope="docs-auditor",
        state="ok",
        summary="Documentation is aligned with the visible implementation delta.",
        evidence=["No code-only drift requiring doc updates was detected."],
        recommended_action=None,
        timestamp=timestamp,
    )


def _dashboard_validation_scripts(dashboard_dir: Path) -> list[str]:
    package_json = dashboard_dir / "package.json"
    if not package_json.exists():
        return []
    try:
        payload = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    scripts = payload.get("scripts", {})
    return [name for name in ("lint", "test", "build") if name in scripts]


def _dashboard_has_tests(dashboard_dir: Path) -> bool:
    for pattern in ("*.test.*", "*.spec.*"):
        if any(dashboard_dir.rglob(pattern)):
            return True
    return False


def audit_quality(repo_root: Path, timestamp: float) -> dict:
    evidence = []
    python_bin = repo_root / ".venv" / "bin" / "python"
    backend_cmd = [str(python_bin if python_bin.exists() else "python"), "-m", "pytest", "tests/", "-q"]
    backend_result = _run_command(backend_cmd, cwd=repo_root)
    backend_state = "ok" if backend_result.returncode == 0 else "block"
    snippet = (backend_result.stdout.strip() or backend_result.stderr.strip() or "no output")[:500]
    evidence.append(f"backend pytest: {snippet}")

    dashboard_dir = repo_root / "dashboard"
    dashboard_modules = dashboard_dir / "node_modules"
    dashboard_scripts = _dashboard_validation_scripts(dashboard_dir)
    if dashboard_scripts:
        evidence.append(f"dashboard validation scripts: {', '.join(dashboard_scripts)}")
    else:
        evidence.append("dashboard validation scripts: none declared")

    frontend_state = "ok"
    if dashboard_dir.exists() and dashboard_modules.exists() and "lint" in dashboard_scripts:
        frontend_result = _run_command(["npm", "run", "lint"], cwd=dashboard_dir)
        frontend_state = "ok" if frontend_result.returncode == 0 else "warn"
        frontend_snippet = (frontend_result.stdout.strip() or frontend_result.stderr.strip() or "no output")[:500]
        evidence.append(f"dashboard lint: {frontend_snippet}")
    elif dashboard_dir.exists() and dashboard_modules.exists():
        evidence.append("dashboard lint: skipped because no lint script is configured")
    else:
        evidence.append("dashboard lint: skipped because dashboard dependencies are not installed")

    if dashboard_dir.exists() and dashboard_modules.exists() and "test" in dashboard_scripts:
        if _dashboard_has_tests(dashboard_dir):
            frontend_test_result = _run_command(["npm", "run", "test"], cwd=dashboard_dir)
            if frontend_test_result.returncode != 0:
                frontend_state = "warn"
            frontend_test_snippet = (
                frontend_test_result.stdout.strip() or frontend_test_result.stderr.strip() or "no output"
            )[:500]
            evidence.append(f"dashboard test: {frontend_test_snippet}")
        else:
            evidence.append("dashboard test: configured but no frontend test files were detected")

    if dashboard_dir.exists() and dashboard_modules.exists():
        frontend_tsc_result = _run_command(["npx", "tsc", "--noEmit"], cwd=dashboard_dir)
        if frontend_tsc_result.returncode != 0:
            frontend_state = "warn"
        frontend_tsc_snippet = (
            frontend_tsc_result.stdout.strip() or frontend_tsc_result.stderr.strip() or "no output"
        )[:500]
        evidence.append(f"dashboard tsc: {frontend_tsc_snippet}")

    if dashboard_dir.exists() and dashboard_modules.exists() and "build" in dashboard_scripts:
        frontend_build_result = _run_command(["npm", "run", "build"], cwd=dashboard_dir)
        if frontend_build_result.returncode != 0:
            frontend_state = "warn"
        frontend_build_snippet = (
            frontend_build_result.stdout.strip() or frontend_build_result.stderr.strip() or "no output"
        )[:500]
        evidence.append(f"dashboard build: {frontend_build_snippet}")

    state = "ok"
    if backend_state == "block":
        state = "block"
    elif frontend_state == "warn":
        state = "warn"

    summary = "Required validation checks passed."
    recommendation = None
    if state == "block":
        summary = "Required backend validation is failing."
        recommendation = "Fix the failing pytest suite before blessing the repo."
    elif state == "warn":
        summary = "Backend validation passed, but dashboard lint needs attention."
        recommendation = "Resolve the dashboard lint findings or install dependencies if lint is expected."

    return _make_audit(
        scope="quality-auditor",
        state=state,
        summary=summary,
        evidence=evidence,
        recommended_action=recommendation,
        timestamp=timestamp,
    )


def _backup_coverage_summary(worktrees: list[WorktreeState], checkpoint_recommendation: dict | None) -> dict:
    dirty_worktrees = [worktree for worktree in worktrees if worktree.changed_files]
    return {
        "status": "warn" if dirty_worktrees else "ok",
        "dirty_worktree_count": len(dirty_worktrees),
        "dirty_worktree_paths": [worktree.path for worktree in dirty_worktrees],
        "checkpoint_recommended": checkpoint_recommendation is not None,
        "summary": (
            "Checkpoint coverage is incomplete."
            if dirty_worktrees
            else "All active worktrees are currently checkpoint-safe."
        ),
    }


def _active_risks(auditors: list[dict]) -> list[dict]:
    return [
        {
            "scope": audit["scope"],
            "state": audit["state"],
            "summary": audit["summary"],
        }
        for audit in auditors
        if audit["state"] != "ok"
    ]


def _recommended_next_actions(auditors: list[dict], checkpoint_recommendation: dict | None) -> list[str]:
    actions: list[str] = []
    for audit in auditors:
        action = audit.get("recommended_action")
        if action and action not in actions:
            actions.append(action)
    if checkpoint_recommendation:
        summary = checkpoint_recommendation.get("summary")
        if summary and summary not in actions:
            actions.append(summary)
    return actions


def collect_housekeeping_snapshot(repo_root: Path, run_quality_checks: bool = True) -> dict:
    timestamp = time.time()
    worktree_paths = list_worktrees(repo_root)
    worktrees = [collect_worktree_state(path) for path in worktree_paths]

    auditors = [audit_repo(worktrees, repo_root, timestamp)]
    backup_audit, checkpoint_recommendation = audit_backup(worktrees, repo_root, timestamp)
    auditors.append(backup_audit)
    auditors.append(audit_docs(worktrees, timestamp))
    if run_quality_checks:
        auditors.append(audit_quality(repo_root, timestamp))

    overall_state = "ok"
    for audit in auditors:
        if STATE_RANK[audit["state"]] > STATE_RANK[overall_state]:
            overall_state = audit["state"]

    return {
        "timestamp": timestamp,
        "repo_root": str(repo_root),
        "overall_state": overall_state,
        "worktrees": [
            {
                "path": worktree.path,
                "branch": worktree.branch,
                "head": worktree.head,
                "upstream": worktree.upstream,
                "ahead": worktree.ahead,
                "behind": worktree.behind,
                "changed_count": worktree.changed_count,
            }
            for worktree in worktrees
        ],
        "auditors": auditors,
        "backup_coverage_summary": _backup_coverage_summary(worktrees, checkpoint_recommendation),
        "active_risks": _active_risks(auditors),
        "recommended_next_actions": _recommended_next_actions(auditors, checkpoint_recommendation),
        "checkpoint_recommendation": checkpoint_recommendation,
    }


async def run_housekeeping(
    repo_root: Path,
    interval_seconds: int = 300,
    run_quality_checks: bool = True,
    max_cycles: int | None = None,
    stop_flag: list[bool] | None = None,
):
    cycle = 0
    yield {
        "event": "housekeeping_started",
        "data": {
            "repo_root": str(repo_root),
            "interval_seconds": interval_seconds,
            "run_quality_checks": run_quality_checks,
            "max_cycles": max_cycles,
        },
    }

    while True:
        if stop_flag and stop_flag[0]:
            yield {"event": "housekeeping_stopped", "data": {"cycle": cycle}}
            return

        cycle += 1
        yield {"event": "housekeeping_cycle_start", "data": {"cycle": cycle}}
        snapshot = await asyncio.to_thread(
            collect_housekeeping_snapshot,
            repo_root,
            run_quality_checks,
        )
        snapshot["cycle"] = cycle
        yield {"event": "housekeeping_audit", "data": snapshot}

        for audit in snapshot["auditors"]:
            if audit["state"] == "warn":
                yield {"event": "housekeeping_warn", "data": {"cycle": cycle, **audit}}
            elif audit["state"] == "block":
                yield {"event": "housekeeping_block", "data": {"cycle": cycle, **audit}}

        recommendation = snapshot.get("checkpoint_recommendation")
        if recommendation:
            yield {
                "event": "housekeeping_checkpoint_recommended",
                "data": {
                    "cycle": cycle,
                    **recommendation,
                },
            }

        if max_cycles is not None and cycle >= max_cycles:
            yield {
                "event": "housekeeping_complete",
                "data": {"cycles": cycle, "overall_state": snapshot["overall_state"]},
            }
            return

        await asyncio.sleep(max(interval_seconds, 1))
