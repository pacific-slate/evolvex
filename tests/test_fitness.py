"""Tests for evolution/fitness.py"""
from agents.base_agent import AgentResult
from evolution.fitness import score


def _result(success: bool, duration_ms: float) -> AgentResult:
    return AgentResult(success=success, output=None, duration_ms=duration_ms)


def test_failed_result_scores_zero():
    assert score(_result(False, 5.0), baseline_ms=10.0) == 0.0


def test_zero_baseline_scores_half():
    assert score(_result(True, 5.0), baseline_ms=0.0) == 0.5


def test_equal_to_baseline_scores_half():
    # ratio = 10/10 = 1.0 → 1.0/2.0 = 0.5
    assert score(_result(True, 10.0), baseline_ms=10.0) == 0.5


def test_twice_as_fast_scores_one():
    # ratio = 10/5 = 2.0 → 2.0/2.0 = 1.0 (clamped)
    assert score(_result(True, 5.0), baseline_ms=10.0) == 1.0


def test_slower_than_baseline_scores_below_half():
    # ratio = 10/20 = 0.5 → 0.5/2.0 = 0.25
    assert score(_result(True, 20.0), baseline_ms=10.0) == 0.25


def test_score_clamped_to_one():
    # 100x faster — should still be 1.0
    assert score(_result(True, 0.1), baseline_ms=100.0) == 1.0


def test_score_clamped_to_zero():
    # result is extremely slow — score floor is 0.0
    result = score(_result(True, 1_000_000.0), baseline_ms=1.0)
    assert result >= 0.0
