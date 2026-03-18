"""
MetaAgent — GPT-5.4 with function calling, conversation history, and context compaction.

The meta-agent is the autonomous orchestrator for Genesis mode. It holds the full
conversation history, decides what tools to call, and compresses context when the
history grows too large to keep inference fast.
"""

import json
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI

SYSTEM_PROMPT = """\
You are Genesis — an autonomous AI architect. Your mission: build the most capable AI \
agent you can, from scratch, in a sandboxed workspace.

You have tools to write code, execute Python, run shell commands, search the web, \
install packages, and test what you build. You decide what to build, when, and how.

**Strategy:**
1. Research first — understand what makes agents capable (ReAct, CoT, tool-use, reflection).
2. Plan openly — write your architecture to BUILD_LOG.md before coding.
3. Build incrementally — working code at every step, never break what runs.
4. Test relentlessly — run your code, fix failures, iterate.
5. Develop a PROTOCOL.md — a compressed vocabulary for recurring concepts you discover.
6. Self-assess often — use the self_assess tool to measure progress objectively.

**What "most capable" means:**
- Novel problem solving (not just prompt wrappers)
- Effective tool use and composition
- Self-introspection on failures with corrective action
- Clear task decomposition with coherent architecture
- The ability to make real API calls (OPENAI_API_KEY and TAVILY_API_KEY are in env)

**What to build:** You choose. Consider: a reasoning agent that critiques its own answers, \
a research assistant that synthesizes web results, a code-generation agent that tests \
its output, or something entirely novel. Surprise the judges.

Start by writing BUILD_LOG.md with your initial research plan, then begin building.
"""

# How many messages before we compact the oldest half
COMPACT_THRESHOLD = 100
# Keep this many recent messages after compaction
COMPACT_KEEP_RECENT = 50


class MetaAgent:
    """
    Wraps OpenAI chat completions with:
    - Persistent conversation history
    - Function-calling via TOOL_DEFINITIONS
    - Token usage tracking
    - Automatic context compaction at COMPACT_THRESHOLD messages
    """

    def __init__(self, client: AsyncOpenAI, model: str, tools: list[dict]) -> None:
        self.client = client
        self.model = model
        self.tools = tools
        self.history: list[dict[str, Any]] = []
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0

    @property
    def total_cost_usd(self) -> float:
        # GPT-5.4 pricing approximation: $10/M input, $30/M output
        return (self.total_prompt_tokens / 1_000_000 * 10.0) + \
               (self.total_completion_tokens / 1_000_000 * 30.0)

    @property
    def token_usage(self) -> dict:
        return {
            "prompt_tokens": self.total_prompt_tokens,
            "completion_tokens": self.total_completion_tokens,
            "total_cost_usd": round(self.total_cost_usd, 4),
        }

    def _compact_history(self) -> str | None:
        """
        When history exceeds COMPACT_THRESHOLD, summarize the oldest messages
        and replace them with a single summary message.
        Returns a description of what was compacted, or None if no compaction.
        """
        if len(self.history) <= COMPACT_THRESHOLD:
            return None

        # Separate the oldest messages from the recent tail
        n_to_compact = len(self.history) - COMPACT_KEEP_RECENT
        old_messages = self.history[:n_to_compact]
        recent_messages = self.history[n_to_compact:]

        # Build a text summary of the old messages
        summary_lines = [f"[COMPACTED HISTORY — {len(old_messages)} messages summarized]"]
        for msg in old_messages:
            role = msg.get("role", "?")
            if role == "assistant":
                content = msg.get("content") or ""
                tool_calls = msg.get("tool_calls") or []
                if tool_calls:
                    names = [tc.get("function", {}).get("name", "?") for tc in tool_calls]
                    summary_lines.append(f"assistant: called tools {names}")
                if content:
                    preview = str(content)[:120].replace("\n", " ")
                    summary_lines.append(f"assistant (thought): {preview}")
            elif role == "tool":
                name = msg.get("name", "?")
                content = str(msg.get("content", ""))[:80].replace("\n", " ")
                summary_lines.append(f"tool/{name}: {content}")
            elif role == "user":
                content = str(msg.get("content", ""))[:120].replace("\n", " ")
                summary_lines.append(f"user: {content}")

        summary_text = "\n".join(summary_lines)
        summary_message = {
            "role": "user",
            "content": (
                f"[System: The following is a summary of earlier conversation history "
                f"that has been compacted to save context space.]\n\n{summary_text}\n\n"
                f"[End of compacted history. Continue from here.]"
            ),
        }

        self.history = [summary_message] + recent_messages
        return f"Compacted {len(old_messages)} messages into summary. History now {len(self.history)} messages."

    async def step(self, user_message: str | None = None) -> dict:
        """
        Run one inference step.
        - If user_message is provided, append it to history first.
        - Returns the assistant's response dict (may contain tool_calls).
        """
        if user_message is not None:
            self.history.append({"role": "user", "content": user_message})

        # Compact if needed
        self._compact_history()

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,  # type: ignore[arg-type]
            tools=self.tools,  # type: ignore[arg-type]
            tool_choice="auto",
            temperature=0.7,
        )

        choice = response.choices[0]
        msg = choice.message

        # Track token usage
        if response.usage:
            self.total_prompt_tokens += response.usage.prompt_tokens
            self.total_completion_tokens += response.usage.completion_tokens

        # Append assistant turn to history
        assistant_entry: dict[str, Any] = {"role": "assistant"}
        if msg.content:
            assistant_entry["content"] = msg.content
        if msg.tool_calls:
            assistant_entry["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        self.history.append(assistant_entry)

        return {
            "content": msg.content,
            "tool_calls": msg.tool_calls,
            "finish_reason": choice.finish_reason,
            "usage": self.token_usage,
        }

    def feed_tool_result(self, tool_call_id: str, name: str, result: str) -> None:
        """Append a tool result to history so the next step sees it."""
        self.history.append({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": name,
            "content": result,
        })

    def save_checkpoint(self, path: str) -> None:
        """Persist conversation history and token counts to disk."""
        data = {
            "history": self.history,
            "total_prompt_tokens": self.total_prompt_tokens,
            "total_completion_tokens": self.total_completion_tokens,
        }
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        # Atomic rename so a crash mid-write never corrupts the checkpoint
        Path(tmp).replace(path)

    def load_checkpoint(self, path: str) -> int:
        """
        Restore history and token counts from a checkpoint file.
        Returns the number of messages restored, or 0 if file not found.
        """
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            self.history = data.get("history", [])
            self.total_prompt_tokens = data.get("total_prompt_tokens", 0)
            self.total_completion_tokens = data.get("total_completion_tokens", 0)
            return len(self.history)
        except (FileNotFoundError, json.JSONDecodeError):
            return 0
