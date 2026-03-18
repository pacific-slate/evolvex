"""Tests for OpenAI pricing helpers."""

from evolution.openai_pricing import calculate_usage_cost, pricing_for_model, usage_counts


def test_pricing_matches_gpt_54_prefix():
    assert pricing_for_model("gpt-5.4") is not None
    assert pricing_for_model("gpt-5.4-2025-03-01") is not None


def test_usage_counts_extract_cached_tokens():
    usage = {
        "prompt_tokens": 1_000_000,
        "completion_tokens": 100_000,
        "prompt_tokens_details": {"cached_tokens": 600_000},
    }
    counts = usage_counts(usage)
    assert counts == {
        "prompt_tokens": 1_000_000,
        "cached_prompt_tokens": 600_000,
        "completion_tokens": 100_000,
    }


def test_cost_uses_cached_input_pricing_for_gpt_54():
    usage = {
        "prompt_tokens": 100_000,
        "completion_tokens": 10_000,
        "prompt_tokens_details": {"cached_tokens": 60_000},
    }
    # 40k regular input @ $2.50/M = $0.10
    # 60k cached input @ $0.25/M = $0.015
    # 10k output @ $15/M = $0.15
    assert calculate_usage_cost("gpt-5.4", usage) == 0.265


def test_unknown_model_returns_none():
    usage = {"prompt_tokens": 10, "completion_tokens": 10}
    assert calculate_usage_cost("unknown-model", usage) is None


def test_gpt_54_large_context_multiplier_applies():
    usage = {
        "prompt_tokens": 300_000,
        "completion_tokens": 100_000,
        "prompt_tokens_details": {"cached_tokens": 100_000},
    }
    # Large-context GPT-5.4 requests are 2x input/cached input and 1.5x output.
    # 200k regular input @ $2.50/M * 2 = $1.00
    # 100k cached input @ $0.25/M * 2 = $0.05
    # 100k output @ $15/M * 1.5 = $2.25
    assert calculate_usage_cost("gpt-5.4", usage) == 3.30
