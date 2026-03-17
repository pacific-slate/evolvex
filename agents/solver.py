"""
Solver agent -- stage-aware problem solver.
Attempts LLM-generated code solutions to challenges issued by the Challenger.
Tracks consecutive wins and graduates through CognitiveStage levels.
"""

from openai import AsyncOpenAI
from agents.base_agent import Agent
from evolution.stages import CognitiveStage, STAGE_NAMES, STAGE_PROMPTS, should_graduate, next_stage

_SOLVER_BASE_SYSTEM = """You are a Python programmer solving algorithmic challenges.

Rules:
- Define a single function: run_task(data) that accepts one argument
- Return the answer directly from run_task -- no printing, no side effects
- Plain Python only -- no third-party libraries
- Imports allowed at module top level only (not inside run_task)
- Return ONLY the raw Python code, no markdown fences, no explanation

Strategy guidance: {stage_guidance}
"""


class Solver(Agent):
    def __init__(self, client: AsyncOpenAI):
        super().__init__(name="Solver")
        self._client = client
        self.stage = CognitiveStage.REACTIVE
        self.consecutive_wins: int = 0
        self.total_wins: int = 0
        self.total_losses: int = 0

    @property
    def stage_name(self) -> str:
        return STAGE_NAMES[self.stage]

    def record_win(self) -> bool:
        """Record a win. Returns True if a stage graduation occurred."""
        self.consecutive_wins += 1
        self.total_wins += 1
        self.record_mutation(f"win at stage {self.stage_name}", delta_fitness=0.1)
        if should_graduate(self.consecutive_wins):
            old_stage = self.stage
            self.stage = next_stage(self.stage)
            self.consecutive_wins = 0
            return self.stage != old_stage  # True only if actually promoted (not already at max)
        return False

    def record_loss(self) -> None:
        self.consecutive_wins = 0
        self.total_losses += 1
        self.record_mutation(f"loss at stage {self.stage_name}", delta_fitness=-0.05)

    async def attempt(self, challenge_description: str, model: str) -> str:
        """Generate a run_task(data) solution for the given challenge description."""
        system = _SOLVER_BASE_SYSTEM.format(stage_guidance=STAGE_PROMPTS[self.stage])
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": challenge_description},
            ],
            max_tokens=400,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update({
            "stage": int(self.stage),
            "stage_name": self.stage_name,
            "consecutive_wins": self.consecutive_wins,
            "total_wins": self.total_wins,
            "total_losses": self.total_losses,
            "wins_to_next_stage": max(0, 3 - self.consecutive_wins),
        })
        return base
