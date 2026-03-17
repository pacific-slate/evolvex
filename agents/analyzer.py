"""
Agent B — Analyzer.
Reads benchmark results and identifies what to improve.
Outputs a natural-language improvement suggestion fed to the Modifier.
"""

from openai import AsyncOpenAI
from agents.base_agent import Agent, AgentResult

_SYSTEM = """You are a code performance analyst.
Given Python code and its benchmark result, identify one specific, safe improvement.
Return only a plain-English description of the change — no code, no markdown, no explanation.
Example: "Replace the nested loop with Python's built-in sorted() function."
"""


class Analyzer(Agent):
    def __init__(self, client: AsyncOpenAI):
        super().__init__(name="Analyzer")
        self._client = client

    async def analyze(self, task_code: str, result: AgentResult, model: str) -> str:
        """Return a one-line improvement suggestion for the given code + result."""
        user_msg = (
            f"Code:\n```python\n{task_code}\n```\n\n"
            f"Benchmark: {result.duration_ms:.2f}ms, success={result.success}"
        )
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=100,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
