"""
Evolution orchestrator.
Runs one full evolution cycle: benchmark → analyze → mutate → validate → apply/rollback.
Emits events so the API layer can stream them to the dashboard via WebSocket.
"""

from typing import AsyncIterator
from agents.performer import Performer
from agents.analyzer import Analyzer
from agents.modifier import Modifier
from evolution.sandbox import validate, benchmark_proposed
from evolution.checkpoint import save as save_checkpoint, latest as latest_checkpoint
from evolution.fitness import score as fitness_score

# Benchmark dataset — large enough to show visible timing differences between algorithms
_BENCHMARK_DATA = list(range(500, 0, -1))


async def run_cycle(
    performer: Performer,
    analyzer: Analyzer,
    modifier: Modifier,
    baseline_ms: float,
    model: str,
) -> AsyncIterator[dict]:
    """
    Run one evolution cycle. Yields event dicts consumed by the WebSocket broadcaster.
    Event shapes: { "event": str, "data": dict }
    """
    # 1. Benchmark current performer
    current_code_snapshot = performer.task_code  # capture before any mutation
    result = performer.run_benchmark(_BENCHMARK_DATA)
    current_fitness = fitness_score(result, baseline_ms)

    yield {"event": "benchmark", "data": {
        "generation": performer.generation,
        "duration_ms": round(result.duration_ms, 3),
        "fitness": round(current_fitness, 4),
        "success": result.success,
    }}

    if not result.success:
        yield {"event": "error", "data": {"message": result.error}}
        return

    # 2. Analyze — get improvement suggestion
    suggestion = await analyzer.analyze(performer.task_code, result, model=model)
    yield {"event": "analysis", "data": {"suggestion": suggestion}}

    # 3. Save checkpoint before mutation
    cp = save_checkpoint(
        performer.name,
        performer.generation,
        performer.task_code,
        current_fitness,
    )
    yield {"event": "checkpoint", "data": {"generation": cp.generation}}

    # 4. Generate mutation
    proposed_code = await modifier.generate_mutation(performer.task_code, suggestion, model=model)
    yield {"event": "mutation_proposed", "data": {"code_preview": proposed_code[:200]}}

    # 5. Validate in sandbox
    passed, error = validate(proposed_code)
    if not passed:
        yield {"event": "sandbox_failed", "data": {"error": error}}
        # Rollback
        last_cp = latest_checkpoint(performer.name)
        if last_cp:
            performer.task_code = last_cp.task_code
        yield {"event": "rollback", "data": {"to_generation": performer.generation}}
        return

    # 6. Benchmark proposed code
    proposed_result = benchmark_proposed(proposed_code, _BENCHMARK_DATA)
    proposed_fitness = fitness_score(proposed_result, baseline_ms)

    yield {"event": "sandbox_passed", "data": {
        "proposed_duration_ms": round(proposed_result.duration_ms, 3),
        "proposed_fitness": round(proposed_fitness, 4),
    }}

    # 7. Apply if fitness improved
    if proposed_fitness > current_fitness:
        delta = proposed_fitness - current_fitness
        pct_improvement = ((baseline_ms - proposed_result.duration_ms) / baseline_ms) * 100
        performer.task_code = proposed_code
        performer.record_mutation(suggestion, delta)
        yield {"event": "applied", "data": {
            "generation": performer.generation,
            "delta_fitness": round(delta, 4),
            "new_fitness": round(performer.fitness_score, 4),
            "pct_improvement": round(pct_improvement, 1),
            "code": proposed_code,
            "previous_code": current_code_snapshot,
        }}
    else:
        # Mutation valid but no improvement — discard
        yield {"event": "discarded", "data": {
            "reason": "no fitness improvement",
            "proposed_fitness": round(proposed_fitness, 4),
            "current_fitness": round(current_fitness, 4),
        }}
