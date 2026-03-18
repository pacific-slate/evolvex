"""
Genesis Tools — 10 tool implementations + OpenAI function-calling definitions.

Each tool is a plain async function returning (success: bool, output: str).
The dispatch table maps tool name → function.
"""

import asyncio
import json
import os

import httpx

from evolution.genesis_sandbox import (
    WORKSPACE_ROOT,
    run_python,
    run_subprocess,
    safe_path,
)

# ── OpenAI tool definitions ─────────────────────────────────────────────────

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "execute_python",
            "description": "Execute Python code in a sandboxed subprocess inside the workspace. OPENAI_API_KEY and TAVILY_API_KEY are available. Use for testing, running agents, computation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python source code to execute"},
                    "timeout": {"type": "integer", "description": "Max seconds to run (default 30, max 60)", "default": 30},
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file in the workspace. Creates parent directories as needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path within workspace (e.g. 'agent/core.py')"},
                    "content": {"type": "string", "description": "File content to write"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file from the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path within workspace"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "List files and directories in the workspace. Use '.' for the root.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path within workspace (default: '.')", "default": "."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web using Tavily. Returns top results with titles, URLs, and content snippets.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "description": "Max results to return (1-5, default 5)", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "http_get",
            "description": "Fetch the content of a URL. Returns up to 10KB of text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to fetch"},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell",
            "description": "Run a shell command in the workspace directory. Blocked commands: ssh, docker, sudo, rm, git, curl, wget. Use write_file + execute_python instead of python/pip.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to run"},
                    "timeout": {"type": "integer", "description": "Max seconds (default 30)", "default": 30},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "install_package",
            "description": "Install a Python package using pip into the current Python environment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Package name (e.g. 'requests', 'numpy'). No version specifiers with special chars."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_test",
            "description": "Write a pytest test file to the workspace and run it immediately. Returns pass/fail and output.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Test filename (e.g. 'test_agent.py')"},
                    "code": {"type": "string", "description": "Pytest test code"},
                },
                "required": ["name", "code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "self_assess",
            "description": "Run a benchmark evaluation of the agent you've built. Looks for agent/core.py or main.py in workspace and scores it across 5 dimensions (0-100 each).",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]


# ── Tool implementations ────────────────────────────────────────────────────

async def tool_execute_python(code: str, timeout: int = 30) -> tuple[bool, str]:
    timeout = min(max(timeout, 1), 60)
    loop = asyncio.get_event_loop()
    success, output = await loop.run_in_executor(None, run_python, code, timeout)
    return success, output


async def tool_write_file(path: str, content: str) -> tuple[bool, str]:
    try:
        target = safe_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        size = target.stat().st_size
        return True, f"Wrote {size} bytes to {path}"
    except ValueError as exc:
        return False, str(exc)
    except Exception as exc:
        return False, f"Write failed: {exc}"


async def tool_read_file(path: str) -> tuple[bool, str]:
    try:
        target = safe_path(path)
        if not target.exists():
            return False, f"File not found: {path}"
        content = target.read_text(encoding="utf-8", errors="replace")
        if len(content) > 8192:
            content = content[:8192] + f"\n... (truncated, total {len(content)} chars)"
        return True, content
    except ValueError as exc:
        return False, str(exc)
    except Exception as exc:
        return False, f"Read failed: {exc}"


async def tool_list_directory(path: str = ".") -> tuple[bool, str]:
    try:
        target = safe_path(path)
        if not target.exists():
            return False, f"Directory not found: {path}"
        entries = []
        for item in sorted(target.iterdir()):
            rel = item.relative_to(WORKSPACE_ROOT)
            if item.is_dir():
                entries.append(f"[DIR]  {rel}/")
            else:
                size = item.stat().st_size
                entries.append(f"[FILE] {rel} ({size}B)")
        if not entries:
            return True, "(empty directory)"
        return True, "\n".join(entries)
    except ValueError as exc:
        return False, str(exc)
    except Exception as exc:
        return False, f"List failed: {exc}"


async def tool_web_search(query: str, max_results: int = 5) -> tuple[bool, str]:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return False, "TAVILY_API_KEY not set"
    max_results = min(max(max_results, 1), 5)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={"api_key": api_key, "query": query, "max_results": max_results},
            )
            resp.raise_for_status()
            data = resp.json()
        results = data.get("results", [])
        if not results:
            return True, "No results found."
        lines = []
        for r in results:
            lines.append(f"Title: {r.get('title', '')}")
            lines.append(f"URL: {r.get('url', '')}")
            snippet = r.get("content", "")[:300]
            lines.append(f"Snippet: {snippet}")
            lines.append("")
        return True, "\n".join(lines).strip()
    except Exception as exc:
        return False, f"Search failed: {exc}"


async def tool_http_get(url: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "EvolveX-Genesis/1.0"})
            resp.raise_for_status()
            text = resp.text[:10240]
            return True, text
    except Exception as exc:
        return False, f"HTTP GET failed: {exc}"


async def tool_run_shell(command: str, timeout: int = 30) -> tuple[bool, str]:
    timeout = min(max(timeout, 1), 60)
    loop = asyncio.get_event_loop()
    success, output = await loop.run_in_executor(None, run_subprocess, command, timeout, None)
    return success, output


async def tool_install_package(name: str) -> tuple[bool, str]:
    import re
    # Basic package name validation — letters, digits, dash, underscore, dot
    if not re.match(r"^[A-Za-z0-9_.\-]+$", name):
        return False, f"Invalid package name: {name!r}"
    import sys
    cmd = f"{sys.executable} -m pip install {name} -q"
    loop = asyncio.get_event_loop()
    success, output = await loop.run_in_executor(None, run_subprocess, cmd, 120, None)
    return success, output or ("Installed." if success else "pip failed (no output)")


async def tool_create_test(name: str, code: str) -> tuple[bool, str]:
    if not name.endswith(".py"):
        name = name + ".py"
    ok, msg = await tool_write_file(name, code)
    if not ok:
        return False, msg
    # Run via pytest
    import sys
    test_path = safe_path(name)
    cmd = f"{sys.executable} -m pytest {test_path} -v --tb=short 2>&1"
    loop = asyncio.get_event_loop()
    success, output = await loop.run_in_executor(None, run_subprocess, cmd, 60, None)
    return success, output[:3000]


_ASSESS_CODE = '''
import os, sys, json, time
sys.path.insert(0, ".")

scores = {"reasoning": 0, "tool_use": 0, "error_handling": 0, "self_improvement": 0, "overall": 0}
notes = []

# Check for core agent file
core_candidates = ["agent/core.py", "agent.py", "main.py", "src/agent.py"]
core_file = None
for c in core_candidates:
    if os.path.exists(c):
        core_file = c
        break

if not core_file:
    notes.append("No agent entry point found (looked for agent/core.py, agent.py, main.py)")
    print(json.dumps({"scores": scores, "notes": notes}))
    sys.exit(0)

content = open(core_file).read()
notes.append(f"Found entry point: {core_file} ({len(content)} chars)")

# Reasoning: has structured thinking, chain of thought, planning
reasoning = 0
for kw in ["plan", "step", "think", "reason", "decompose", "strategy", "chain", "reflect"]:
    if kw in content.lower(): reasoning += 10
scores["reasoning"] = min(reasoning, 80)

# Tool use: has tools, functions, apis
tool_use = 0
for kw in ["tool", "function", "api", "call", "invoke", "dispatch"]:
    if kw in content.lower(): tool_use += 10
if "def " in content: tool_use += 15
if "async def" in content: tool_use += 10
scores["tool_use"] = min(tool_use, 80)

# Error handling: try/except, validation, retry
eh = 0
for kw in ["try:", "except", "retry", "fallback", "error", "raise", "assert"]:
    if kw in content.lower(): eh += 10
scores["error_handling"] = min(eh, 80)

# Self-improvement: can the agent modify itself / reflect on failures?
si = 0
for kw in ["self_", "improve", "feedback", "score", "eval", "benchmark", "assess", "learn"]:
    if kw in content.lower(): si += 10
scores["self_improvement"] = min(si, 80)

# Bonus: BUILD_LOG, tests exist, multiple files
if os.path.exists("BUILD_LOG.md"):
    scores["reasoning"] = min(scores["reasoning"] + 15, 100)
    notes.append("BUILD_LOG.md present (+15 reasoning)")
if os.path.exists("PROTOCOL.md"):
    scores["self_improvement"] = min(scores["self_improvement"] + 10, 100)
    notes.append("PROTOCOL.md present (+10 self_improvement)")

# Count files
file_count = sum(1 for r,d,fs in os.walk(".") for f in fs
                 if f.endswith(".py") and not f.startswith("_genesis"))
if file_count > 3: scores["tool_use"] = min(scores["tool_use"] + 10, 100)
notes.append(f"{file_count} Python files in workspace")

# Try importing and running the agent
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location("_agent_under_test", core_file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    notes.append("Agent imported successfully")
    for dim in ["reasoning", "tool_use", "error_handling", "self_improvement"]:
        scores[dim] = min(scores[dim] + 5, 100)
except Exception as e:
    notes.append(f"Import failed: {e}")
    for dim in ["reasoning", "tool_use", "error_handling", "self_improvement"]:
        scores[dim] = max(scores[dim] - 10, 0)

scores["overall"] = int(sum(scores[k] for k in ["reasoning","tool_use","error_handling","self_improvement"]) / 4)
print(json.dumps({"scores": scores, "notes": notes}))
'''


async def tool_self_assess() -> tuple[bool, str]:
    ok, output = await tool_execute_python(_ASSESS_CODE, timeout=30)
    if not ok:
        return False, f"Assessment script failed: {output}"
    try:
        data = json.loads(output.strip().splitlines()[-1])
        return True, json.dumps(data)
    except Exception:
        return True, output  # return raw if not parseable


# ── Dispatch table ──────────────────────────────────────────────────────────

TOOL_DISPATCH: dict = {
    "execute_python": tool_execute_python,
    "write_file": tool_write_file,
    "read_file": tool_read_file,
    "list_directory": tool_list_directory,
    "web_search": tool_web_search,
    "http_get": tool_http_get,
    "run_shell": tool_run_shell,
    "install_package": tool_install_package,
    "create_test": tool_create_test,
    "self_assess": tool_self_assess,
}


async def dispatch(tool_name: str, args: dict) -> tuple[bool, str]:
    """Route a tool call to its implementation. Returns (success, output)."""
    fn = TOOL_DISPATCH.get(tool_name)
    if fn is None:
        return False, f"Unknown tool: {tool_name}"
    try:
        return await fn(**args)
    except TypeError as exc:
        return False, f"Bad arguments for {tool_name}: {exc}"
    except Exception as exc:
        return False, f"Tool {tool_name} raised: {exc}"
