"""
Bootstrap sandbox helpers.

Bootstrap mode gets its own workspace and path guards so it can evolve artifacts
without colliding with Genesis or the main repo.
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BOOTSTRAP_WORKSPACE = Path(
    os.getenv("BOOTSTRAP_WORKSPACE", str(REPO_ROOT / ".bootstrap_workspace"))
).resolve()

BLOCKED_COMMANDS: set[str] = {
    "ssh",
    "scp",
    "sftp",
    "rsync",
    "docker",
    "kubectl",
    "helm",
    "sudo",
    "su",
    "doas",
    "curl",
    "wget",
    "nc",
    "netcat",
    "ncat",
    "python3",
    "python",
    "pip",
    "pip3",
    "rm",
    "rmdir",
    "chmod",
    "chown",
    "export",
    "env",
    "systemctl",
    "service",
    "crontab",
    "git",
}


def ensure_workspace() -> Path:
    BOOTSTRAP_WORKSPACE.mkdir(parents=True, exist_ok=True)
    return BOOTSTRAP_WORKSPACE


def safe_path(relative: str) -> Path:
    resolved = (BOOTSTRAP_WORKSPACE / relative).resolve()
    if not str(resolved).startswith(str(BOOTSTRAP_WORKSPACE)):
        raise ValueError(f"Path traversal rejected: {relative!r} resolves outside workspace")
    return resolved


def safe_repo_path(relative: str) -> Path:
    resolved = (REPO_ROOT / relative).resolve()
    if not str(resolved).startswith(str(REPO_ROOT)):
        raise ValueError(f"Repo traversal rejected: {relative!r} resolves outside repo")
    return resolved


def validate_command(command: str) -> None:
    first_token = command.strip().split()[0] if command.strip() else ""
    binary = os.path.basename(first_token)
    if binary in BLOCKED_COMMANDS:
        raise ValueError(f"Command '{binary}' is blocked in the Bootstrap sandbox")


def run_subprocess(
    command: str,
    timeout: int = 30,
    extra_env: dict | None = None,
) -> tuple[bool, str]:
    validate_command(command)
    env = {**os.environ}
    if extra_env:
        env.update(extra_env)
    env["HOME"] = str(BOOTSTRAP_WORKSPACE)

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=str(BOOTSTRAP_WORKSPACE),
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
        output = (result.stdout + result.stderr).strip()
        return result.returncode == 0, output[:4096]
    except subprocess.TimeoutExpired:
        return False, f"Command timed out after {timeout}s"
    except Exception as exc:
        return False, f"Subprocess error: {exc}"


def run_python(code: str, timeout: int = 30) -> tuple[bool, str]:
    script_path = BOOTSTRAP_WORKSPACE / "_bootstrap_exec_tmp.py"
    script_path.write_text(code, encoding="utf-8")
    passthrough_keys = ["OPENAI_API_KEY", "TAVILY_API_KEY"]
    extra_env = {k: os.environ[k] for k in passthrough_keys if k in os.environ}

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(BOOTSTRAP_WORKSPACE),
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, **extra_env, "HOME": str(BOOTSTRAP_WORKSPACE)},
        )
        output = (result.stdout + result.stderr).strip()
        return result.returncode == 0, output[:4096]
    except subprocess.TimeoutExpired:
        return False, f"Python execution timed out after {timeout}s"
    except Exception as exc:
        return False, f"Execution error: {exc}"
    finally:
        script_path.unlink(missing_ok=True)
