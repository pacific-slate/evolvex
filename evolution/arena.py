"""
Arena loop -- orchestrates adversarial co-evolution between Solver and Challenger.
Each round: Challenger generates a challenge, Solver attempts it, win/loss/stage-up.
Yields event dicts consumed by the WebSocket broadcaster in api.py.
"""

from typing import AsyncIterator
from agents.solver import Solver
from agents.challenger import Challenger
from evolution.challenges import validate_challenge


async def run_arena(
    solver: Solver,
    challenger: Challenger,
    rounds: int,
    model: str,
    stop_flag: list | None = None,
) -> AsyncIterator[dict]:
    """
    Run `rounds` arena rounds. Yields arena event dicts.
    stop_flag is a mutable list[bool] so the caller can signal stop mid-loop
    without asyncio.Event (stays synchronous and testable).
    """
    if stop_flag is None:
        stop_flag = [False]

    yield {"event": "arena_started", "data": {
        "solver_stage": solver.stage_name,
        "difficulty": challenger.difficulty,
        "rounds": rounds,
    }}

    for rnd in range(1, rounds + 1):
        if stop_flag[0]:
            yield {"event": "arena_stopped", "data": {"round": rnd}}
            return

        yield {"event": "arena_round_start", "data": {
            "round": rnd,
            "of": rounds,
            "stage": solver.stage_name,
            "difficulty": challenger.difficulty,
        }}

        # 1. Challenger generates a problem
        challenge = await challenger.generate(model=model)
        yield {"event": "arena_challenge", "data": {
            "description": challenge.description,
            "difficulty": challenge.difficulty,
            "hint": challenge.hint,
        }}

        # 2. Solver attempts a solution
        code = await solver.attempt(challenge.description, model=model)
        yield {"event": "arena_solver_attempt", "data": {
            "stage": solver.stage_name,
            "code_preview": code[:300],
        }}

        # 3. Validate against challenge test cases
        passed, error = validate_challenge(challenge, code)

        if not passed:
            solver.record_loss()
            yield {"event": "arena_loss", "data": {
                "round": rnd,
                "reason": error,
                "stage": solver.stage_name,
                "consecutive_wins": solver.consecutive_wins,
            }}
            continue

        # 4. Win -- check for stage graduation
        graduated = solver.record_win()
        yield {"event": "arena_win", "data": {
            "round": rnd,
            # consecutive_wins already reset to 0 on graduation
            "consecutive_wins": solver.consecutive_wins,
            "stage": solver.stage_name,
        }}

        if graduated:
            challenger.escalate()
            yield {"event": "arena_stage_up", "data": {
                "new_stage": solver.stage_name,
                "new_stage_id": int(solver.stage),
                "total_wins": solver.total_wins,
            }}
            yield {"event": "arena_difficulty_up", "data": {
                "new_difficulty": challenger.difficulty,
            }}

    total = solver.total_wins + solver.total_losses
    yield {"event": "arena_complete", "data": {
        "solver_stage": solver.stage_name,
        "solver_stage_id": int(solver.stage),
        "total_wins": solver.total_wins,
        "total_losses": solver.total_losses,
        "win_rate": round(solver.total_wins / total, 3) if total else 0.0,
        **solver.to_dict(),
    }}
