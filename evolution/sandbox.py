"""
Sandbox — validate proposed code mutations before applying to a live agent.
Runs the proposed code in an isolated namespace against a test suite.
Returns (passed: bool, error: str | None).

Note: uses Python exec() intentionally — this is the sandboxed test harness.
All code executed here is LLM-generated and validated before any agent applies it.
"""

import time
from agents.base_agent import AgentResult

# Canonical test cases — sorted output must match expected
_TEST_CASES: list[tuple[list, list]] = [
    ([3, 1, 4, 1, 5], [1, 1, 3, 4, 5]),
    ([9, 2, 7], [2, 7, 9]),
    ([], []),
    ([1], [1]),
    (list(range(50, 0, -1)), list(range(1, 51))),
]


def validate(proposed_code: str) -> tuple[bool, str | None]:
    """
    Execute proposed_code in an isolated namespace and run all test cases.
    Returns (True, None) on full pass, or (False, error_message) on any failure.
    """
    namespace: dict = {}
    try:
        exec(proposed_code, namespace)  # noqa: S102
    except SyntaxError as exc:
        return False, f"SyntaxError: {exc}"
    except Exception as exc:
        return False, f"ExecError: {exc}"

    run_task = namespace.get("run_task")
    if not callable(run_task):
        return False, "proposed_code must define a callable 'run_task(data)'"

    for inputs, expected in _TEST_CASES:
        try:
            result = run_task(list(inputs))
            if result != expected:
                return False, f"Wrong output for {inputs}: got {result}, expected {expected}"
        except Exception as exc:
            return False, f"RuntimeError on {inputs}: {exc}"

    return True, None


def benchmark_proposed(proposed_code: str, data: list) -> AgentResult:
    """Run proposed code and return a timed AgentResult (for fitness comparison)."""
    namespace: dict = {}
    exec(proposed_code, namespace)  # noqa: S102
    run_task = namespace["run_task"]
    start = time.perf_counter()
    try:
        output = run_task(list(data))
        return AgentResult(success=True, output=output, duration_ms=(time.perf_counter() - start) * 1000)
    except Exception as exc:
        return AgentResult(success=False, output=None, duration_ms=(time.perf_counter() - start) * 1000, error=str(exc))
