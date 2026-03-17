"""
Fitness scoring. Lower duration = higher fitness.
Score is normalized 0-1 based on baseline vs current performance.
"""

from agents.base_agent import AgentResult


def score(result: AgentResult, baseline_ms: float) -> float:
    """
    Compute a 0.0–1.0 fitness score.
    A result matching baseline scores 0.5. Faster → higher, slower/failed → lower.
    """
    if not result.success:
        return 0.0
    if baseline_ms <= 0:
        return 0.5
    ratio = baseline_ms / result.duration_ms  # >1 means faster than baseline
    # Clamp to [0, 1]
    return min(1.0, max(0.0, ratio / 2.0))
