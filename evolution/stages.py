"""
Piaget-inspired cognitive development stages for the Solver agent.
Each stage changes the prompt strategy used when attempting challenges.
"""

from enum import IntEnum


class CognitiveStage(IntEnum):
    REACTIVE = 0         # Apply the first reasonable approach
    REFLECTIVE = 1       # Weigh trade-offs and verify edge cases
    STRATEGIC = 2        # Plan multi-step, consider algorithmic complexity
    META_COGNITIVE = 3   # Reason about the reasoning strategy itself


STAGE_NAMES = {
    CognitiveStage.REACTIVE: "Reactive",
    CognitiveStage.REFLECTIVE: "Reflective",
    CognitiveStage.STRATEGIC: "Strategic",
    CognitiveStage.META_COGNITIVE: "Meta-cognitive",
}

# Consecutive wins required to graduate to the next stage
WINS_TO_GRADUATE = 3

# Per-stage prompt fragments appended to the Solver system prompt
STAGE_PROMPTS = {
    CognitiveStage.REACTIVE: (
        "Apply the first approach that seems correct. Implement immediately without overthinking."
    ),
    CognitiveStage.REFLECTIVE: (
        "Before coding, consider at least two approaches. "
        "Check edge cases: empty input, single element, duplicates, large input."
    ),
    CognitiveStage.STRATEGIC: (
        "Before coding: (1) state the problem constraints, (2) identify time/space complexity goals, "
        "(3) pick the optimal algorithm, (4) then implement cleanly."
    ),
    CognitiveStage.META_COGNITIVE: (
        "Before coding: reflect on your own strategy. What assumptions are you making? "
        "Could a different framing of the problem lead to a better solution? "
        "Explicitly state your reasoning chain, then implement."
    ),
}


def should_graduate(consecutive_wins: int) -> bool:
    """Return True if the solver has earned enough consecutive wins to stage up."""
    return consecutive_wins >= WINS_TO_GRADUATE


def next_stage(stage: CognitiveStage) -> CognitiveStage:
    """Return the next stage, capped at META_COGNITIVE."""
    max_stage = max(CognitiveStage)
    return CognitiveStage(min(int(stage) + 1, int(max_stage)))
