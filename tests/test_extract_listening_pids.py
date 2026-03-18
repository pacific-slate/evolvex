"""Tests for scripts/extract_listening_pids.awk"""

from __future__ import annotations

import subprocess
from pathlib import Path


SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "extract_listening_pids.awk"
DEPLOY_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "deploy_frontend.sh"


def extract_pids(port: int, output: str) -> list[str]:
    completed = subprocess.run(
        ["awk", "-v", f"port={port}", "-f", str(SCRIPT)],
        input=output,
        text=True,
        capture_output=True,
        check=True,
    )
    return [line for line in completed.stdout.splitlines() if line]


def test_extract_listening_pids_matches_only_exact_port():
    ss_output = """\
State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      511    0.0.0.0:3002       0.0.0.0:*         users:(("node",pid=111,fd=22))
LISTEN 0      511    0.0.0.0:30020      0.0.0.0:*         users:(("node",pid=222,fd=23))
LISTEN 0      511    [::]:3002          [::]:*            users:(("node",pid=333,fd=24))
"""

    assert extract_pids(3002, ss_output) == ["111", "333"]


def test_deploy_frontend_uses_exact_port_pid_extractor():
    contents = DEPLOY_SCRIPT.read_text(encoding="utf-8")

    assert 'extract_listening_pids.awk' in contents
    assert 'index($0, port)' not in contents
