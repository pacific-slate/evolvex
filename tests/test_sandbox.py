"""Tests for evolution/sandbox.py"""
from evolution.sandbox import validate, benchmark_proposed

VALID_CODE = """
def run_task(data):
    return sorted(data)
"""

SYNTAX_ERROR_CODE = """
def run_task(data):
    return sorted(data
"""

WRONG_OUTPUT_CODE = """
def run_task(data):
    return list(data)  # not sorted
"""

NO_FUNCTION_CODE = """
result = 42
"""

RUNTIME_ERROR_CODE = """
def run_task(data):
    raise ValueError("boom")
"""


def test_validate_valid_code():
    passed, err = validate(VALID_CODE)
    assert passed is True
    assert err is None


def test_validate_syntax_error():
    passed, err = validate(SYNTAX_ERROR_CODE)
    assert passed is False
    assert err is not None
    assert "SyntaxError" in err


def test_validate_wrong_output():
    passed, err = validate(WRONG_OUTPUT_CODE)
    assert passed is False
    assert err is not None
    assert "Wrong output" in err


def test_validate_missing_function():
    passed, err = validate(NO_FUNCTION_CODE)
    assert passed is False
    assert err is not None
    assert "run_task" in err


def test_validate_runtime_error():
    passed, err = validate(RUNTIME_ERROR_CODE)
    assert passed is False
    assert err is not None
    assert "RuntimeError" in err


def test_benchmark_proposed_valid():
    result = benchmark_proposed(VALID_CODE, list(range(10, 0, -1)))
    assert result.success is True
    assert result.output == list(range(1, 11))
    assert result.duration_ms >= 0
