"""
Arena loop -- orchestrates adversarial co-evolution between Solver and Challenger.
Each round: Challenger generates a challenge, Solver attempts it, win/loss/stage-up.
Yields event dicts consumed by the WebSocket broadcaster in api.py.

Protocol layer: after each round the winner proposes vocabulary tokens.
On stage transitions a consolidation LLM call prunes and merges the vocabulary.
"""

import json
from typing import AsyncIterator
from agents.solver import Solver
from agents.challenger import Challenger
from evolution.challenges import validate_challenge
from evolution.protocol import Protocol, CONSOLIDATION_PROMPT, MAX_VOCAB_SIZE
from evolution.stages import CognitiveStage


async def _consolidate_vocabulary(
    protocol: Protocol, new_stage: CognitiveStage, model: str, client
) -> list[dict]:
    """Ask LLM to prune and merge the vocabulary after a stage transition."""
    import json as _json
    vocab_json = _json.dumps([
        {"token": e.token, "meaning": e.meaning, "proposed_by": e.proposed_by,
         "round_created": e.round_created, "usage_count": e.usage_count}
        for e in protocol.vocabulary.values()
    ])
    stage_name = new_stage.name.replace("_", "-").title()
    prompt = CONSOLIDATION_PROMPT.format(
        vocab_size=len(protocol.vocabulary),
        vocab_json=vocab_json,
        new_stage=stage_name,
        max_size=MAX_VOCAB_SIZE,
    )
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        data = json.loads((response.choices[0].message.content or "").strip())
        return data.get("kept", [])
    except Exception:
        return []  # keep existing on failure


async def run_arena(
    solver: Solver,
    challenger: Challenger,
    rounds: int,
    model: str,
    stop_flag: list | None = None,
    protocol: "Protocol | None" = None,
) -> AsyncIterator[dict]:
    """
    Run `rounds` arena rounds. Yields arena event dicts.
    stop_flag is a mutable list[bool] so the caller can signal stop mid-loop.
    protocol is the shared emergent vocabulary (optional; skips protocol logic if None).
    """
    if stop_flag is None:
        stop_flag = [False]

    # Wire protocol into agents if not already set
    if protocol is not None:
        solver._protocol = protocol
        challenger._protocol = protocol

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

        # 1. Challenger generates a problem (with protocol encoding at Reflective+)
        challenge = await challenger.generate(model=model, stage=solver.stage)
        description_for_solver = challenge.description

        yield {"event": "arena_challenge", "data": {
            "description": challenge.description,
            "difficulty": challenge.difficulty,
            "hint": challenge.hint,
        }}

        # Track protocol token usage in the description
        if protocol is not None and challenge.protocol_description:
            protocol.record_usage(challenge.protocol_description)

        # Compute and emit compression ratio (Reflective+)
        if protocol is not None and solver.stage != CognitiveStage.REACTIVE:
            ratio = protocol.compression_ratio(challenge.description)
            protocol.record_round(rnd, ratio)
            yield {"event": "arena_protocol_used", "data": {
                "round": rnd,
                "compression_ratio": ratio,
                "vocab_size": len(protocol.vocabulary),
            }}

        # 2. Solver attempts a solution
        code = await solver.attempt(description_for_solver, model=model)
        yield {"event": "arena_solver_attempt", "data": {
            "stage": solver.stage_name,
            "code_preview": code[:300],
        }}

        # 3. Validate against challenge test cases
        passed, error = validate_challenge(challenge, code)

        # If failed and we have a protocol-encoded description, retry with full English
        if not passed and protocol is not None and challenge.full_english and challenge.full_english != challenge.description:
            retry_code = await solver.attempt(challenge.full_english, model=model)
            passed, error = validate_challenge(challenge, retry_code)
            if passed:
                code = retry_code

        if not passed:
            solver.record_loss()
            yield {"event": "arena_loss", "data": {
                "round": rnd,
                "reason": error,
                "stage": solver.stage_name,
                "consecutive_wins": solver.consecutive_wins,
            }}

            # Challenger lost? Let challenger propose vocabulary
            if protocol is not None:
                proposals = await challenger.propose_vocabulary(rnd, model)
                added = []
                for p in proposals:
                    token = p.get("token", "")
                    meaning = p.get("meaning", "")
                    if token and meaning and protocol.add_entry(token, meaning, "challenger", rnd):
                        added.append({"token": token, "meaning": meaning})
                if added:
                    yield {"event": "arena_protocol_entry", "data": {
                        "round": rnd,
                        "proposed_by": "challenger",
                        "entries": added,
                        "vocab_size": len(protocol.vocabulary),
                    }}
            continue

        # 4. Win -- check for stage graduation
        graduated = solver.record_win()
        yield {"event": "arena_win", "data": {
            "round": rnd,
            "consecutive_wins": solver.consecutive_wins,
            "stage": solver.stage_name,
        }}

        # Solver won? Let solver propose vocabulary
        if protocol is not None:
            proposals = await solver.propose_vocabulary(challenge.description, code, rnd, model)
            added = []
            for p in proposals:
                token = p.get("token", "")
                meaning = p.get("meaning", "")
                if token and meaning and protocol.add_entry(token, meaning, "solver", rnd):
                    added.append({"token": token, "meaning": meaning})
            if added:
                yield {"event": "arena_protocol_entry", "data": {
                    "round": rnd,
                    "proposed_by": "solver",
                    "entries": added,
                    "vocab_size": len(protocol.vocabulary),
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

            # Consolidate vocabulary on stage transition
            if protocol is not None and len(protocol.vocabulary) > 0:
                # Need the client — get it from solver
                kept = await _consolidate_vocabulary(
                    protocol, solver.stage, model, solver._client
                )
                if kept:
                    protocol.replace_vocabulary(kept)
                yield {"event": "arena_protocol_consolidate", "data": {
                    "new_stage": solver.stage_name,
                    "vocab_size": len(protocol.vocabulary),
                    "vocabulary": [
                        {"token": e.token, "meaning": e.meaning, "proposed_by": e.proposed_by}
                        for e in protocol.vocabulary.values()
                    ],
                }}

    total = solver.total_wins + solver.total_losses

    # Final protocol snapshot
    protocol_snapshot = protocol.to_dict() if protocol is not None else {}
    if protocol_snapshot:
        yield {"event": "arena_protocol_snapshot", "data": protocol_snapshot}

    yield {"event": "arena_complete", "data": {
        "solver_stage": solver.stage_name,
        "solver_stage_id": int(solver.stage),
        "total_wins": solver.total_wins,
        "total_losses": solver.total_losses,
        "win_rate": round(solver.total_wins / total, 3) if total else 0.0,
        **solver.to_dict(),
    }}
