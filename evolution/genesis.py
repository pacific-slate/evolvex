"""
Genesis loop — autonomous agent-building orchestrator.

The meta-agent is the LLM. Python is just a tool dispatcher.
Yields event dicts consumed by the WebSocket broadcaster (same pattern as loop.py).

Event prefixes: genesis_*
"""

import asyncio
import json
import time
from collections import deque
from typing import AsyncIterator

from openai import AsyncOpenAI

from agents.meta_agent import MetaAgent
from evolution.genesis_sandbox import WORKSPACE_ROOT, ensure_workspace
from evolution.genesis_tools import TOOL_DEFINITIONS, dispatch

# Budget cap in USD — warn at 80% / 95%, hard stop at 100%
BUDGET_CAP_USD = 100.0

# Loop repetition detection — if the same (tool, arg_hash) appears 3× in a row, intervene
REPEAT_WINDOW = 10
REPEAT_THRESHOLD = 3

# Phases inferred from tool usage patterns
PHASE_ORDER = ["RESEARCH", "DESIGN", "BUILDING", "TESTING", "OPTIMIZING"]

_PHASE_TRIGGERS: dict[str, str] = {
    "web_search": "RESEARCH",
    "http_get": "RESEARCH",
    "write_file": "BUILDING",
    "execute_python": "TESTING",
    "run_shell": "BUILDING",
    "install_package": "BUILDING",
    "create_test": "TESTING",
    "self_assess": "OPTIMIZING",
    "read_file": "BUILDING",
    "list_directory": "BUILDING",
}

# Intervention message injected when the agent loops
_LOOP_INTERVENTION = (
    "It looks like you've been repeating the same action several times. "
    "Try a different approach: change your strategy, write a different file, "
    "test something you've built, or assess your current progress with self_assess."
)

# Workspace file snapshot for file-change events
_file_snapshot: dict[str, int] = {}


def _detect_file_changes() -> list[dict]:
    """Diff current workspace files against last snapshot. Returns change events."""
    global _file_snapshot
    changes = []
    current: dict[str, int] = {}
    if WORKSPACE_ROOT.exists():
        for path in WORKSPACE_ROOT.rglob("*"):
            if path.is_file() and not path.name.startswith("_genesis"):
                rel = str(path.relative_to(WORKSPACE_ROOT))
                size = path.stat().st_size
                current[rel] = size

    for path, size in current.items():
        if path not in _file_snapshot:
            changes.append({"path": path, "action": "created", "size_bytes": size})
        elif _file_snapshot[path] != size:
            changes.append({"path": path, "action": "modified", "size_bytes": size})

    _file_snapshot = current
    return changes


def _detect_phase(tool_name: str, current_phase: str) -> str:
    """Advance phase based on tool usage. Phase can only move forward."""
    triggered = _PHASE_TRIGGERS.get(tool_name, "")
    if not triggered:
        return current_phase
    if triggered in PHASE_ORDER:
        ti = PHASE_ORDER.index(triggered)
        ci = PHASE_ORDER.index(current_phase) if current_phase in PHASE_ORDER else 0
        return PHASE_ORDER[max(ti, ci)]
    return current_phase


def _read_narrative() -> str | None:
    """Read BUILD_LOG.md from workspace for narrative display. Returns None if missing."""
    log_path = WORKSPACE_ROOT / "BUILD_LOG.md"
    if log_path.exists():
        content = log_path.read_text(encoding="utf-8", errors="replace")
        return content[-2000:] if len(content) > 2000 else content
    return None


async def run_genesis(
    client: AsyncOpenAI,
    model: str,
    max_iterations: int = 1000,
    stop_flag: list[bool] | None = None,
) -> AsyncIterator[dict]:
    """
    Main Genesis loop. Async generator — yields event dicts.

    The meta-agent runs until:
    - max_iterations reached
    - stop_flag[0] is True
    - Budget cap exceeded
    - finish_reason == "stop" with no tool calls (agent declares done)
    """
    global _file_snapshot
    _file_snapshot = {}
    stop_flag = stop_flag or [False]

    # Init workspace
    ensure_workspace()

    CHECKPOINT_PATH = str(WORKSPACE_ROOT / ".checkpoint.json")
    CHECKPOINT_EVERY = 10  # iterations between saves

    agent = MetaAgent(client=client, model=model, tools=TOOL_DEFINITIONS)
    current_phase = "RESEARCH"
    iteration = 0
    recent_actions: deque = deque(maxlen=REPEAT_WINDOW)
    consecutive_repeats: dict[str, int] = {}

    # Attempt checkpoint resume
    restored = agent.load_checkpoint(CHECKPOINT_PATH)
    if restored:
        current_phase = "BUILDING"  # safe assumption mid-run
        yield {
            "event": "genesis_started",
            "data": {
                "max_iterations": max_iterations,
                "workspace_path": str(WORKSPACE_ROOT),
                "resumed_from_checkpoint": True,
                "messages_restored": restored,
            },
        }
        opening = (
            f"[RESUMED] You were interrupted mid-run. Your workspace files are intact. "
            f"Check BUILD_LOG.md and your workspace to orient yourself, then continue building."
        )
    else:
        yield {
            "event": "genesis_started",
            "data": {
                "max_iterations": max_iterations,
                "workspace_path": str(WORKSPACE_ROOT),
                "resumed_from_checkpoint": False,
            },
        }
        # Kick off: send the opening user message
        opening = (
            "Begin. You have full autonomy to build the most capable AI agent you can. "
            "Start by researching what makes agents capable, then plan and build. "
            "Document everything in BUILD_LOG.md."
        )

    while iteration < max_iterations:
        if stop_flag[0]:
            yield {"event": "genesis_stopped", "data": {"iteration": iteration}}
            return

        # Budget check
        cost = agent.total_cost_usd
        if cost >= BUDGET_CAP_USD:
            yield {
                "event": "genesis_error",
                "data": {"message": f"Budget cap ${BUDGET_CAP_USD:.0f} reached (spent ${cost:.2f}). Stopping."},
            }
            return
        if cost >= BUDGET_CAP_USD * 0.95:
            yield {
                "event": "genesis_token_usage",
                "data": {**agent.token_usage, "warning": "95% of budget used"},
            }
        elif cost >= BUDGET_CAP_USD * 0.80:
            yield {
                "event": "genesis_token_usage",
                "data": {**agent.token_usage, "warning": "80% of budget used"},
            }

        # ── Inference step ──────────────────────────────────────────────────
        try:
            result = await agent.step(user_message=opening if iteration == 0 else None)
        except Exception as exc:
            yield {"event": "genesis_error", "data": {"message": f"Inference error: {exc}"}}
            await asyncio.sleep(2)
            continue

        opening = None  # Only send opening message on iteration 0

        # Emit thought if present
        if result["content"]:
            thought = str(result["content"])[:500]
            yield {"event": "genesis_thinking", "data": {"thought": thought, "iteration": iteration}}

        # Token usage every 10 iterations
        if iteration % 10 == 0:
            yield {"event": "genesis_token_usage", "data": agent.token_usage}

        # ── Tool calls ──────────────────────────────────────────────────────
        tool_calls = result.get("tool_calls") or []

        if not tool_calls:
            # No tool calls — either done or thinking step
            if result["finish_reason"] == "stop":
                # Agent declared it's done
                break
            iteration += 1
            continue

        for tc in tool_calls:
            tool_name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            # Phase detection
            new_phase = _detect_phase(tool_name, current_phase)
            if new_phase != current_phase:
                yield {
                    "event": "genesis_phase_change",
                    "data": {"old_phase": current_phase, "new_phase": new_phase},
                }
                current_phase = new_phase

            # Repetition detection
            args_preview = str(args)[:80]
            action_key = f"{tool_name}:{args_preview}"
            recent_actions.append(action_key)
            consecutive_repeats[action_key] = consecutive_repeats.get(action_key, 0) + 1

            if consecutive_repeats.get(action_key, 0) >= REPEAT_THRESHOLD:
                # Inject intervention — reset counter to avoid spamming
                consecutive_repeats[action_key] = 0
                agent.feed_tool_result(tc.id, tool_name, _LOOP_INTERVENTION)
                yield {
                    "event": "genesis_thinking",
                    "data": {"thought": f"[Loop detected on {tool_name}] Intervention injected.", "iteration": iteration},
                }
                continue

            # Emit tool call event
            yield {
                "event": "genesis_tool_call",
                "data": {
                    "tool": tool_name,
                    "args_preview": args_preview,
                    "iteration": iteration,
                },
            }

            # ── Execute tool ────────────────────────────────────────────────
            t0 = time.monotonic()
            success, output = await dispatch(tool_name, args)
            duration_ms = int((time.monotonic() - t0) * 1000)

            output_preview = output[:200] if output else ""
            yield {
                "event": "genesis_tool_result",
                "data": {
                    "tool": tool_name,
                    "success": success,
                    "output_preview": output_preview,
                    "duration_ms": duration_ms,
                },
            }

            # Feed result back to agent
            result_content = f"{'SUCCESS' if success else 'FAILED'}: {output}" if output else ("OK" if success else "FAILED")
            agent.feed_tool_result(tc.id, tool_name, result_content[:4096])

            # File change detection after write operations
            if tool_name in ("write_file", "execute_python", "create_test", "install_package"):
                for change in _detect_file_changes():
                    yield {"event": "genesis_file_changed", "data": change}

            # Self-assess results → emit dedicated event
            if tool_name == "self_assess" and success:
                try:
                    assess_data = json.loads(output)
                    yield {"event": "genesis_assessment", "data": assess_data}
                except Exception:
                    pass

            # Narrative update every time BUILD_LOG changes
            if tool_name == "write_file" and "BUILD_LOG" in str(args.get("path", "")):
                narrative = _read_narrative()
                if narrative:
                    yield {"event": "genesis_narrative", "data": {"text": narrative}}

        iteration += 1

        # Checkpoint every N iterations (atomic write — crash-safe)
        if iteration % CHECKPOINT_EVERY == 0:
            try:
                agent.save_checkpoint(CHECKPOINT_PATH)
            except Exception:
                pass  # never let a checkpoint failure kill the run

    # ── Completion ──────────────────────────────────────────────────────────
    # Final assessment
    _, final_output = await dispatch("self_assess", {})
    try:
        final_assessment = json.loads(final_output)
    except Exception:
        final_assessment = {"raw": final_output}

    files_created = list(_file_snapshot.keys())

    yield {
        "event": "genesis_complete",
        "data": {
            "iterations_completed": iteration,
            "final_assessment": final_assessment,
            "files_created": files_created,
            **agent.token_usage,
        },
    }
