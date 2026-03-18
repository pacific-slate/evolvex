"""
Agent C — Modifier.
Takes an improvement suggestion from the Analyzer and generates new task_code.
All output goes through sandbox validation before being applied.
"""

from openai import AsyncOpenAI
from agents.base_agent import Agent

_SYSTEM = """You are a Python code optimizer.
Given existing Python code and a suggested improvement, rewrite the code to apply that improvement.

Rules:
- The function MUST be named run_task(data) and accept one list argument
- Return the sorted list
- No imports inside the function
- Plain Python only — no third-party libraries
- Return ONLY the raw Python code, no markdown fences, no explanation
"""


class Modifier(Agent):
    def __init__(self, client: AsyncOpenAI):
        super().__init__(name="Modifier")
        self._client = client

    async def generate_mutation(
        self,
        current_code: str,
        suggestion: str,
        model: str,
    ) -> str:
        """Generate new task_code applying the Analyzer's suggestion."""
        user_msg = (
            f"Current code:\n```python\n{current_code}\n```\n\n"
            f"Improvement to apply: {suggestion}"
        )
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            max_completion_tokens=300,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
