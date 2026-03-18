"""
OpenAI pricing helpers.

This module keeps local cost accounting aligned with the current official
pricing used by EvolveX's configured models.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ModelPricing:
    input_per_million: float
    cached_input_per_million: float
    output_per_million: float
    large_context_threshold: int | None = None
    large_context_input_multiplier: float = 1.0
    large_context_output_multiplier: float = 1.0


_MODEL_PRICING: dict[str, ModelPricing] = {
    # Official pricing from https://openai.com/api/pricing/ for standard GPT-5.4 traffic.
    "gpt-5.4": ModelPricing(
        input_per_million=2.50,
        cached_input_per_million=0.25,
        output_per_million=15.00,
        large_context_threshold=272_000,
        large_context_input_multiplier=2.0,
        large_context_output_multiplier=1.5,
    ),
    "gpt-5-mini": ModelPricing(
        input_per_million=0.250,
        cached_input_per_million=0.025,
        output_per_million=2.000,
    ),
}


def _matches_model(model: str, prefix: str) -> bool:
    return model == prefix or model.startswith(prefix + "-")


def pricing_for_model(model: str) -> ModelPricing | None:
    for prefix, pricing in _MODEL_PRICING.items():
        if _matches_model(model, prefix):
            return pricing
    return None


def _read_usage_attr(obj: Any, attr: str, default: int = 0) -> int:
    if obj is None:
        return default
    if isinstance(obj, dict):
        value = obj.get(attr, default)
    else:
        value = getattr(obj, attr, default)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return default


def usage_counts(usage: Any) -> dict[str, int]:
    prompt_tokens = _read_usage_attr(usage, "prompt_tokens")
    if prompt_tokens == 0:
        prompt_tokens = _read_usage_attr(usage, "input_tokens")

    completion_tokens = _read_usage_attr(usage, "completion_tokens")
    if completion_tokens == 0:
        completion_tokens = _read_usage_attr(usage, "output_tokens")

    prompt_details = None
    if isinstance(usage, dict):
        prompt_details = usage.get("prompt_tokens_details") or usage.get("input_tokens_details")
    else:
        prompt_details = getattr(usage, "prompt_tokens_details", None) or getattr(usage, "input_tokens_details", None)

    cached_prompt_tokens = _read_usage_attr(prompt_details, "cached_tokens")

    return {
        "prompt_tokens": prompt_tokens,
        "cached_prompt_tokens": min(cached_prompt_tokens, prompt_tokens),
        "completion_tokens": completion_tokens,
    }


def calculate_usage_cost(model: str, usage: Any) -> float | None:
    pricing = pricing_for_model(model)
    if pricing is None:
        return None

    counts = usage_counts(usage)
    cached_prompt_tokens = counts["cached_prompt_tokens"]
    regular_prompt_tokens = max(0, counts["prompt_tokens"] - cached_prompt_tokens)
    completion_tokens = counts["completion_tokens"]
    input_multiplier = 1.0
    output_multiplier = 1.0
    if pricing.large_context_threshold is not None and counts["prompt_tokens"] > pricing.large_context_threshold:
        input_multiplier = pricing.large_context_input_multiplier
        output_multiplier = pricing.large_context_output_multiplier

    return (
        (regular_prompt_tokens / 1_000_000) * pricing.input_per_million * input_multiplier
        + (cached_prompt_tokens / 1_000_000) * pricing.cached_input_per_million * input_multiplier
        + (completion_tokens / 1_000_000) * pricing.output_per_million * output_multiplier
    )
