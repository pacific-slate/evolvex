"""
Challenge dataclass and difficulty tiers for the Challenger agent.
Each challenge is a coding problem the Solver must implement as run_task(data).
validate_challenge() runs proposed code against test cases — same pattern as sandbox.py.
"""

import copy
from dataclasses import dataclass

# Difficulty levels 1-4, loosely aligned with CognitiveStage (0-indexed) + 1
DIFFICULTY_TIERS = {
    1: "Easy -- basic algorithmic problems (sorting, searching, simple transforms)",
    2: "Medium -- intermediate algorithms (two-pointer, sliding window, basic DP)",
    3: "Hard -- edge-case-heavy problems, multi-constraint, or tricky invariants",
    4: "Expert -- adversarial inputs, worst-case analysis, degenerate edge cases",
}


@dataclass
class Challenge:
    description: str          # Natural language problem statement
    difficulty: int           # 1-4
    test_cases: list          # [(input, expected_output), ...]
    hint: str = ""            # Optional structural hint for the Solver


def hardcode_challenges() -> list:
    """
    Fallback: return hardcoded challenges covering all 4 difficulty tiers.
    Used when the LLM call fails or for budget-conscious demos.
    """
    return [
        Challenge(
            description=(
                "Sort a list of integers in ascending order and return the sorted list."
            ),
            difficulty=1,
            test_cases=[
                ([3, 1, 2], [1, 2, 3]),
                ([], []),
                ([1], [1]),
                ([5, 5, 5], [5, 5, 5]),
                ([9, 2, 7, 0, 4], [0, 2, 4, 7, 9]),
            ],
            hint="sorting",
        ),
        Challenge(
            description=(
                "Given a list [numbers, target] where numbers is a list of integers and target is "
                "an integer, return the two numbers that sum to target as a sorted list [a, b]. "
                "Return an empty list [] if no such pair exists."
            ),
            difficulty=2,
            test_cases=[
                ([[2, 7, 11, 15], 9], [2, 7]),
                ([[3, 2, 4], 6], [2, 4]),
                ([[1, 2, 3], 10], []),
                ([[0, 0], 0], [0, 0]),
            ],
            hint="two-pointer",
        ),
        Challenge(
            description=(
                "Given a list of integers, return the length of the longest contiguous "
                "subarray in which all elements are unique."
            ),
            difficulty=3,
            test_cases=[
                ([1, 2, 3, 1, 2, 3], 3),
                ([1, 1, 1], 1),
                ([1, 2, 3, 4], 4),
                ([], 0),
                ([1, 2, 1, 3, 2, 1], 3),
            ],
            hint="sliding-window",
        ),
        Challenge(
            description=(
                "Given a list of non-negative integers representing bar chart heights, "
                "return the maximum rectangular area that fits within the bars. "
                "Each bar has width 1."
            ),
            difficulty=4,
            test_cases=[
                ([2, 1, 5, 6, 2, 3], 10),
                ([2, 4], 4),
                ([1], 1),
                ([], 0),
                ([6, 2, 5, 4, 5, 1, 6], 12),
            ],
            hint="stack",
        ),
    ]


def validate_challenge(challenge: Challenge, proposed_code: str):
    """
    Run proposed_code against all challenge test cases.
    Returns (True, None) on full pass, (False, error_message) on any failure.
    The proposed code must define run_task(data) with the correct signature.
    Note: uses Python exec() intentionally -- same controlled pattern as sandbox.py.
    """
    namespace = {}
    try:
        exec(proposed_code, namespace)  # noqa: S102
    except SyntaxError as exc:
        return False, f"SyntaxError: {exc}"
    except Exception as exc:
        return False, f"ExecError: {exc}"

    run_task = namespace.get("run_task")
    if not callable(run_task):
        return False, "Code must define a callable 'run_task(data)'"

    for inputs, expected in challenge.test_cases:
        try:
            result = run_task(copy.deepcopy(inputs))
            if result != expected:
                return False, f"Wrong output for {inputs!r}: got {result!r}, expected {expected!r}"
        except Exception as exc:
            return False, f"RuntimeError on {inputs!r}: {exc}"

    return True, None
