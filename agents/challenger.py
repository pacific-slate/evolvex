"""
Challenger agent -- generates increasingly hard coding challenges for the Solver.
Difficulty escalates when the Solver stages up.
Falls back to hardcoded challenges if LLM call fails or returns unparseable JSON.
"""

import json
from openai import AsyncOpenAI
from agents.base_agent import Agent
from evolution.challenges import Challenge, DIFFICULTY_TIERS, hardcode_challenges

_CHALLENGER_SYSTEM = """You are an adversarial coding challenge designer.
Generate a Python coding challenge at difficulty level {difficulty}.

Difficulty {difficulty}: {tier_description}

Requirements:
1. Write a clear problem statement (2-4 sentences)
2. The solver must implement: run_task(data) -> answer
3. Specify exactly what 'data' is and what to return
4. Generate exactly 4 test cases (include at least one edge case: empty, zero, or single element)
5. For list inputs, data is a list. For scalar inputs, data is the value directly.

Return ONLY valid JSON in this exact format with no other text:
{{
  "description": "...",
  "difficulty": {difficulty},
  "test_cases": [[input, expected], [input, expected], [input, expected], [input, expected]],
  "hint": "one structural hint word (e.g. sorting, two-pointer, stack, hashmap, dp)"
}}
"""


class Challenger(Agent):
    def __init__(self, client: AsyncOpenAI):
        super().__init__(name="Challenger")
        self._client = client
        self.difficulty: int = 1
        self._fallback_index: int = 0
        self._fallbacks = hardcode_challenges()

    def escalate(self) -> None:
        """Increase difficulty one tier, capped at 4."""
        self.difficulty = min(4, self.difficulty + 1)

    def _fallback(self) -> Challenge:
        """Return the next hardcoded challenge at the nearest difficulty tier."""
        matching = [c for c in self._fallbacks if c.difficulty == self.difficulty]
        pool = matching if matching else self._fallbacks
        challenge = pool[self._fallback_index % len(pool)]
        self._fallback_index += 1
        return challenge

    async def generate(self, model: str) -> Challenge:
        """Generate a challenge at the current difficulty. Falls back on parse failure."""
        system = _CHALLENGER_SYSTEM.format(
            difficulty=self.difficulty,
            tier_description=DIFFICULTY_TIERS[self.difficulty],
        )
        try:
            response = await self._client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}],
                max_tokens=600,
                temperature=0.7,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            test_cases = [tuple(tc) for tc in data["test_cases"]]
            return Challenge(
                description=data["description"],
                difficulty=int(data["difficulty"]),
                test_cases=test_cases,
                hint=data.get("hint", ""),
            )
        except Exception:
            return self._fallback()

    def to_dict(self) -> dict:
        base = super().to_dict()
        base["difficulty"] = self.difficulty
        return base
