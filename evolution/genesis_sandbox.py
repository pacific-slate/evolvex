"""
Genesis Sandbox — workspace path validation and subprocess wrappers.

All file and shell operations from the meta-agent are funneled through here.
The workspace is an absolute path that no operation may escape via traversal.
"""

import os
import subprocess
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(os.getenv("GENESIS_WORKSPACE", "/opt/evolvex/workspace")).resolve()

# Commands the meta-agent may NEVER run — system-escaping tools
BLOCKED_COMMANDS: set[str] = {
    "ssh", "scp", "sftp", "rsync",
    "docker", "kubectl", "helm",
    "sudo", "su", "doas",
    "curl", "wget",               # use the dedicated http_get tool instead
    "nc", "netcat", "ncat",
    "python3", "python",          # use execute_python tool instead
    "pip", "pip3",                # use install_package tool instead
    "rm", "rmdir",                # prevent workspace wipeout
    "chmod", "chown",
    "export", "env",              # can't override injected env
    "systemctl", "service",
    "crontab",
    "git",                        # no pushing out of sandbox
}


def ensure_workspace() -> Path:
    """Create workspace dir if it doesn't exist. Returns resolved path."""
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    return WORKSPACE_ROOT


def safe_path(relative: str) -> Path:
    """
    Resolve a relative path against WORKSPACE_ROOT.
    Raises ValueError if the result escapes the workspace.
    """
    resolved = (WORKSPACE_ROOT / relative).resolve()
    if not str(resolved).startswith(str(WORKSPACE_ROOT)):
        raise ValueError(f"Path traversal rejected: {relative!r} resolves outside workspace")
    return resolved


def validate_command(command: str) -> None:
    """
    Reject commands that start with any blocked token.
    Raises ValueError on a match.
    """
    first_token = command.strip().split()[0] if command.strip() else ""
    # Strip any path prefix (e.g. /usr/bin/sudo → sudo)
    binary = os.path.basename(first_token)
    if binary in BLOCKED_COMMANDS:
        raise ValueError(f"Command '{binary}' is blocked in the Genesis sandbox")


def run_subprocess(
    command: str,
    timeout: int = 30,
    extra_env: dict | None = None,
) -> tuple[bool, str]:
    """
    Run a shell command in WORKSPACE_ROOT with a timeout.
    Returns (success, output_or_error).
    Command must pass validate_command() first.
    """
    validate_command(command)

    env = {**os.environ}
    if extra_env:
        env.update(extra_env)
    # Always lock cwd to workspace
    env["HOME"] = str(WORKSPACE_ROOT)

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=str(WORKSPACE_ROOT),
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
        output = (result.stdout + result.stderr).strip()
        return result.returncode == 0, output[:4096]  # cap output
    except subprocess.TimeoutExpired:
        return False, f"Command timed out after {timeout}s"
    except Exception as exc:
        return False, f"Subprocess error: {exc}"


def run_python(code: str, timeout: int = 30) -> tuple[bool, str]:
    """
    Execute Python code in a subprocess locked to the workspace.
    OPENAI_API_KEY and TAVILY_API_KEY are passed through so the built agent
    can make live LLM/search calls.
    """
    script_path = WORKSPACE_ROOT / "_genesis_exec_tmp.py"
    script_path.write_text(code, encoding="utf-8")

    passthrough_keys = ["OPENAI_API_KEY", "TAVILY_API_KEY"]
    extra_env = {k: os.environ[k] for k in passthrough_keys if k in os.environ}

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(WORKSPACE_ROOT),
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, **extra_env, "HOME": str(WORKSPACE_ROOT)},
        )
        output = (result.stdout + result.stderr).strip()
        return result.returncode == 0, output[:4096]
    except subprocess.TimeoutExpired:
        return False, f"Python execution timed out after {timeout}s"
    except Exception as exc:
        return False, f"Execution error: {exc}"
    finally:
        script_path.unlink(missing_ok=True)
