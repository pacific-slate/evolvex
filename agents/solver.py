"""
Solver agent -- stage-aware problem solver.
Attempts LLM-generated code solutions to challenges issued by the Challenger.
Tracks consecutive wins and graduates through CognitiveStage levels.
Supports an optional emergent protocol layer that decodes compressed challenge descriptions.
"""

import json
from openai import AsyncOpenAI
from agents.base_agent import Agent
from evolution.stages import CognitiveStage, STAGE_NAMES, STAGE_PROMPTS, should_graduate, next_stage
from evolution.protocol import Protocol, PROPOSAL_PROMPT

_SOLVER_BASE_SYSTEM = """You are a Python programmer solving algorithmic challenges.

Rules:
- Define a single function: run_task(data) that accepts one argument
- Return the answer directly from run_task -- no printing, no side effects
- Plain Python only -- no third-party libraries
- Imports allowed at module top level only (not inside run_task)
- Return ONLY the raw Python code, no markdown fences, no explanation

Strategy guidance: {stage_guidance}{decoder_block}
"""


class Solver(Agent):
    def __init__(self, client: AsyncOpenAI, protocol: "Protocol | None" = None):
        super().__init__(name="Solver")
        self._client = client
        self.stage = CognitiveStage.REACTIVE
        self.consecutive_wins: int = 0
        self.total_wins: int = 0
        self.total_losses: int = 0
        self._protocol = protocol

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
        decoder_block = ""
        if self._protocol is not None:
            decoder_block = self._protocol.get_decoder_prompt(self.stage)
        system = _SOLVER_BASE_SYSTEM.format(
            stage_guidance=STAGE_PROMPTS[self.stage],
            decoder_block=decoder_block,
        )
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": challenge_description},
            ],
            max_completion_tokens=400,
            temperature=0.2,
        )
        return (response.choices[0].message.content or "").strip()

    async def propose_vocabulary(
        self, challenge_desc: str, _code: str, round_num: int, model: str
    ) -> list[dict]:
        """
        Called when Solver wins. Propose 1-3 vocabulary tokens based on the solved challenge.
        Uses a small LLM call (max_completion_tokens=100). Returns list of {token, meaning} dicts.
        """
        if self._protocol is None:
            return []
        prompt = PROPOSAL_PROMPT.format(
            vocab_summary=self._protocol.vocab_summary(),
            round_num=round_num,
            challenge_desc=challenge_desc[:200],
        )
        try:
            response = await self._client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=100,
                temperature=0.8,
                response_format={"type": "json_object"},
            )
            data = json.loads((response.choices[0].message.content or "").strip())
            return data.get("proposals", [])
        except Exception:
            return []

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
