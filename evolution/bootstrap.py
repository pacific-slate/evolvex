"""
Bootstrap loop.

This mode runs two symmetric peers that must coordinate, build an operating
language, and bootstrap stronger autonomy under brokered tool access.
"""

import asyncio
import json
from typing import AsyncIterator

from agents.bootstrap_peer import BootstrapPeer
from evolution.bootstrap_broker import BootstrapBroker
from evolution.bootstrap_curriculum import BOOTSTRAP_STAGES, BootstrapStage
from evolution.bootstrap_protocol import BootstrapProtocol
from evolution.bootstrap_sandbox import BOOTSTRAP_WORKSPACE

_MAX_PEER_RETRIES = 3


def _event_tail(events: list[dict], limit: int = 8) -> str:
    tail = events[-limit:]
    if not tail:
        return "(no prior events)"
    return "\n".join(f"{item['event']}: {json.dumps(item['data'])[:220]}" for item in tail)


def _normalize_tokens(items: list[dict]) -> list[dict]:
    normalized = []
    for item in items[:3]:
        if not isinstance(item, dict):
            continue
        token = str(item.get("token", "")).strip()
        meaning = str(item.get("meaning", "")).strip()
        if token and meaning:
            normalized.append({"token": token, "meaning": meaning})
    return normalized


def _fallback_step(error_message: str) -> dict:
    return {
        "message": f"Bootstrap peer failed and entered fallback mode: {error_message[:180]}",
        "protocol_proposals": [],
        "adopt_tokens": [],
        "critique": "Fallback path engaged due to peer execution failure.",
        "review": {"decision": "revise", "reason": error_message[:200]},
        "action_request": {"capability": "none", "arguments": {}, "reason": ""},
        "assessment": "Peer step failed; preserving progress and continuing from current checkpoint.",
        "raw": "{}",
    }


def _is_fatal_peer_error(message: str) -> bool:
    lowered = message.lower()
    fatal_markers = (
        "unsupported parameter",
        "invalid_request_error",
        "authenticationerror",
        "insufficient_quota",
        "model_not_found",
    )
    return any(marker in lowered for marker in fatal_markers)


def _assessment(
    *,
    stage: BootstrapStage,
    broker: BootstrapBroker,
    protocol: BootstrapProtocol,
    peer_a: BootstrapPeer,
    peer_b: BootstrapPeer,
) -> dict:
    artifacts = broker.list_artifacts()
    stable_tokens = protocol.stable_count()
    collaboration = 100 if min(peer_a.message_count, peer_b.message_count) > 0 else 40
    collaboration += min(20, int(min(peer_a.dependency_score, peer_b.dependency_score) * 5))
    collaboration = min(100, collaboration)
    language = min(100, 20 + stable_tokens * 20 + int(protocol.utilization_rate() * 20))
    traceability = min(100, 35 + len(artifacts) * 4 + len(broker.audit_log) // 2)
    autonomy = min(100, 20 + sum(broker.action_counts.values()) * 4 + stage.id * 8)
    overall = int((collaboration + language + traceability + autonomy) / 4)
    return {
        "stage": stage.name,
        "collaboration": collaboration,
        "language": language,
        "traceability": traceability,
        "autonomy": autonomy,
        "overall": overall,
    }


def _stage_passed(
    stage: BootstrapStage,
    broker: BootstrapBroker,
    protocol: BootstrapProtocol,
) -> bool:
    if stage.id == 0:
        return protocol.stable_count() >= 1 and broker.action_counts["scratchpad_write"] >= 1
    if stage.id == 1:
        return broker.action_counts["write_file"] >= 1 and broker.has_artifact("PROTOCOL.md", "README.md")
    if stage.id == 2:
        return broker.action_counts["repo_read"] >= 1
    if stage.id == 3:
        return broker.action_counts["execute_python"] >= 1 and broker.has_artifact("bootstrap_agent.py", "main.py", "agent/core.py")
    if stage.id == 4:
        return broker.action_counts["create_test"] >= 1 or broker.action_counts["run_shell"] >= 1 or (broker.last_assessment or {}).get("scores", {}).get("overall", 0) >= 40
    if stage.id == 5:
        return broker.action_counts["web_search"] + broker.action_counts["http_get"] >= 1
    if stage.id == 6:
        return protocol.stable_count() >= 3 and (broker.last_assessment or {}).get("scores", {}).get("overall", 0) >= 50
    return False


def _checkpoint_state(
    *,
    broker: BootstrapBroker,
    protocol: BootstrapProtocol,
    peer_a: BootstrapPeer,
    peer_b: BootstrapPeer,
    stage_index: int,
    round_num: int,
    target_rounds: int,
    round_events: list[dict],
    completed: bool,
    system_assessment: dict | None = None,
) -> dict:
    return {
        "version": 1,
        "completed": completed,
        "stage_index": stage_index,
        "round": round_num,
        "next_round": round_num + 1,
        "target_rounds": target_rounds,
        "round_events": round_events[-20:],
        "peer_a": peer_a.snapshot_state(),
        "peer_b": peer_b.snapshot_state(),
        "protocol": protocol.to_dict(),
        "broker": broker.snapshot_state(),
        "system_assessment": system_assessment,
    }


async def _peer_step_with_retries(
    *,
    peer: BootstrapPeer,
    rnd: int,
    role: str,
    model: str,
    objective: str,
    injection: str,
    allowed_capabilities: tuple[str, ...],
    protocol_summary: str,
    workspace_summary: str,
    recent_events: str,
    latest_peer_message: str,
) -> tuple[dict, list[dict]]:
    errors: list[dict] = []
    for attempt in range(1, _MAX_PEER_RETRIES + 1):
        try:
            step = await peer.step(
                model=model,
                role=role,
                objective=objective,
                injection=injection,
                allowed_capabilities=allowed_capabilities,
                protocol_summary=protocol_summary,
                workspace_summary=workspace_summary,
                recent_events=recent_events,
                latest_peer_message=latest_peer_message,
            )
            return step, errors
        except Exception as exc:
            message = f"{type(exc).__name__}: {exc}"
            errors.append(
                {
                    "event": "bootstrap_error",
                    "data": {
                        "round": rnd,
                        "peer": peer.name,
                        "phase": role,
                        "attempt": attempt,
                        "message": message,
                    },
                }
            )
            if _is_fatal_peer_error(message):
                break
            if attempt < _MAX_PEER_RETRIES:
                await asyncio.sleep(2 ** (attempt - 1))
    return _fallback_step(errors[-1]["data"]["message"] if errors else "unknown error"), errors


async def run_bootstrap(
    peer_a: BootstrapPeer,
    peer_b: BootstrapPeer,
    rounds: int,
    *,
    model: str,
    broker: BootstrapBroker,
    protocol: BootstrapProtocol,
    stop_flag: list[bool] | None = None,
    continuous: bool = False,
) -> AsyncIterator[dict]:
    stop_flag = stop_flag or [False]
    round_events: list[dict] = []
    stage_index = 0
    start_round = 1
    checkpoint = broker.load_checkpoint()
    resumed_from_checkpoint = False
    if checkpoint and not checkpoint.get("completed"):
        resumed_from_checkpoint = True
        stage_index = min(int(checkpoint.get("stage_index", 0)), len(BOOTSTRAP_STAGES) - 1)
        start_round = max(1, int(checkpoint.get("next_round", 1)))
        rounds = max(int(checkpoint.get("target_rounds", rounds)), rounds)
        round_events = list(checkpoint.get("round_events", []))[-20:]
        peer_a.restore_state(checkpoint.get("peer_a"))
        peer_b.restore_state(checkpoint.get("peer_b"))
        protocol.restore_state(checkpoint.get("protocol"))
        broker.restore_state(checkpoint.get("broker"))
        yield {
            "event": "bootstrap_resumed",
            "data": {
                "from_round": max(1, start_round - 1),
                "resume_round": start_round,
                "stage": BOOTSTRAP_STAGES[stage_index].name,
                "target_rounds": rounds,
            },
        }
    elif checkpoint and checkpoint.get("completed"):
        broker.clear_checkpoint()

    stage = BOOTSTRAP_STAGES[stage_index]
    yield {
        "event": "bootstrap_started",
        "data": {
            "rounds": rounds,
            "stage": stage.name,
            "stage_id": stage.id,
            "objective": stage.objective,
            "unlocked_capabilities": list(stage.allowed_capabilities),
            "workspace_path": str(BOOTSTRAP_WORKSPACE),
            "resumed_from_checkpoint": resumed_from_checkpoint,
        },
    }
    yield {"event": "bootstrap_injection", "data": {"stage": stage.name, "injection": stage.injection}}

    for rnd in range(start_round, rounds + 1):
        if stop_flag[0]:
            broker.save_checkpoint(
                _checkpoint_state(
                    broker=broker,
                    protocol=protocol,
                    peer_a=peer_a,
                    peer_b=peer_b,
                    stage_index=stage_index,
                    round_num=max(rnd - 1, 0),
                    target_rounds=rounds,
                    round_events=round_events,
                    completed=False,
                    system_assessment=None,
                )
            )
            yield {"event": "bootstrap_stopped", "data": {"round": rnd}}
            return

        stage = BOOTSTRAP_STAGES[stage_index]
        leader = peer_a if rnd % 2 == 1 else peer_b
        reviewer = peer_b if leader is peer_a else peer_a

        round_start = {
            "event": "bootstrap_round_start",
            "data": {
                "round": rnd,
                "of": rounds,
                "stage": stage.name,
                "leader": leader.name,
                "reviewer": reviewer.name,
            },
        }
        round_events.append(round_start)
        yield round_start

        objective_event = {
            "event": "bootstrap_objective",
            "data": {
                "round": rnd,
                "objective": stage.objective,
                "allowed_capabilities": list(stage.allowed_capabilities),
            },
        }
        round_events.append(objective_event)
        yield objective_event

        leader_step, leader_errors = await _peer_step_with_retries(
            peer=leader,
            rnd=rnd,
            role="leader",
            model=model,
            objective=stage.objective,
            injection=stage.injection,
            allowed_capabilities=stage.allowed_capabilities,
            protocol_summary=protocol.summary(),
            workspace_summary=broker.workspace_summary(),
            recent_events=_event_tail(round_events),
            latest_peer_message="",
        )
        for error_event in leader_errors:
            round_events.append(error_event)
            yield error_event
        if leader_errors and _is_fatal_peer_error(leader_errors[-1]["data"]["message"]):
            broker.save_checkpoint(
                _checkpoint_state(
                    broker=broker,
                    protocol=protocol,
                    peer_a=peer_a,
                    peer_b=peer_b,
                    stage_index=stage_index,
                    round_num=max(rnd - 1, 0),
                    target_rounds=rounds,
                    round_events=round_events,
                    completed=False,
                    system_assessment=None,
                )
            )
            yield {
                "event": "bootstrap_stopped",
                "data": {
                    "round": rnd,
                    "reason": leader_errors[-1]["data"]["message"],
                },
            }
            return
        leader_message = {
            "event": "bootstrap_peer_message",
            "data": {
                "round": rnd,
                "peer": leader.name,
                "role": "leader",
                "message": leader_step["message"],
                "critique": leader_step["critique"],
                "assessment": leader_step["assessment"],
            },
        }
        round_events.append(leader_message)
        broker.append_transcript(
            f"## Round {rnd} — {leader.name} (leader)\n\nMessage: {leader_step['message']}\n\nAssessment: {leader_step['assessment']}\n"
        )
        protocol.record_usage(leader_step["message"], rnd)
        yield leader_message

        for proposal in _normalize_tokens(leader_step["protocol_proposals"]):
            if protocol.propose(proposal["token"], proposal["meaning"], leader.name, rnd):
                event = {
                    "event": "bootstrap_protocol_proposed",
                    "data": {
                        "round": rnd,
                        "peer": leader.name,
                        "token": proposal["token"],
                        "meaning": proposal["meaning"],
                    },
                }
                round_events.append(event)
                yield event

        if stop_flag[0]:
            broker.save_checkpoint(
                _checkpoint_state(
                    broker=broker,
                    protocol=protocol,
                    peer_a=peer_a,
                    peer_b=peer_b,
                    stage_index=stage_index,
                    round_num=max(rnd - 1, 0),
                    target_rounds=rounds,
                    round_events=round_events,
                    completed=False,
                    system_assessment=None,
                )
            )
            yield {"event": "bootstrap_stopped", "data": {"round": rnd}}
            return

        reviewer_step, reviewer_errors = await _peer_step_with_retries(
            peer=reviewer,
            rnd=rnd,
            role="reviewer",
            model=model,
            objective=stage.objective,
            injection=stage.injection,
            allowed_capabilities=stage.allowed_capabilities,
            protocol_summary=protocol.summary(),
            workspace_summary=broker.workspace_summary(),
            recent_events=_event_tail(round_events),
            latest_peer_message=leader_step["message"],
        )
        for error_event in reviewer_errors:
            round_events.append(error_event)
            yield error_event
        if reviewer_errors and _is_fatal_peer_error(reviewer_errors[-1]["data"]["message"]):
            broker.save_checkpoint(
                _checkpoint_state(
                    broker=broker,
                    protocol=protocol,
                    peer_a=peer_a,
                    peer_b=peer_b,
                    stage_index=stage_index,
                    round_num=max(rnd - 1, 0),
                    target_rounds=rounds,
                    round_events=round_events,
                    completed=False,
                    system_assessment=None,
                )
            )
            yield {
                "event": "bootstrap_stopped",
                "data": {
                    "round": rnd,
                    "reason": reviewer_errors[-1]["data"]["message"],
                },
            }
            return
        reviewer_message = {
            "event": "bootstrap_peer_message",
            "data": {
                "round": rnd,
                "peer": reviewer.name,
                "role": "reviewer",
                "message": reviewer_step["message"],
                "critique": reviewer_step["critique"],
                "assessment": reviewer_step["assessment"],
            },
        }
        round_events.append(reviewer_message)
        broker.append_transcript(
            f"### {reviewer.name} (reviewer)\n\nMessage: {reviewer_step['message']}\n\nCritique: {reviewer_step['critique']}\n"
        )
        protocol.record_usage(reviewer_step["message"], rnd)
        yield reviewer_message

        for token in [str(item).strip() for item in reviewer_step["adopt_tokens"][:3]]:
            if protocol.adopt(token, reviewer.name, rnd):
                reviewer.record_review("approve")
                event = {
                    "event": "bootstrap_protocol_adopted",
                    "data": {
                        "round": rnd,
                        "peer": reviewer.name,
                        "token": token,
                    },
                }
                round_events.append(event)
                yield event

        for proposal in _normalize_tokens(reviewer_step["protocol_proposals"]):
            if protocol.propose(proposal["token"], proposal["meaning"], reviewer.name, rnd):
                event = {
                    "event": "bootstrap_protocol_proposed",
                    "data": {
                        "round": rnd,
                        "peer": reviewer.name,
                        "token": proposal["token"],
                        "meaning": proposal["meaning"],
                    },
                }
                round_events.append(event)
                yield event

        review = reviewer_step.get("review") or {"decision": "approve", "reason": "No review provided."}
        review_decision = str(review.get("decision", "approve")).lower()
        review_reason = str(review.get("reason", ""))
        reviewer.record_review(review_decision)
        request = leader_step.get("action_request") or {"capability": "none", "arguments": {}, "reason": ""}
        request_capability = str(request.get("capability", "none") or "none")
        if request_capability != "none":
            requested = {
                "event": "bootstrap_tool_requested",
                "data": {
                    "round": rnd,
                    "peer": leader.name,
                    "capability": request_capability,
                    "reason": str(request.get("reason", "")),
                    "review_decision": review_decision,
                    "review_reason": review_reason,
                },
            }
            round_events.append(requested)
            yield requested

            mutating_capabilities = {"scratchpad_write", "write_file", "create_test", "install_package"}
            if request_capability in mutating_capabilities and review_decision != "approve":
                rejected = {
                    "event": "bootstrap_tool_rejected",
                    "data": {
                        "round": rnd,
                        "peer": leader.name,
                        "capability": request_capability,
                        "reason": f"Peer review marked the action as {review_decision}: {review_reason}",
                    },
                }
                round_events.append(rejected)
                leader.record_action_result(f"rejected {request_capability}", success=False)
                yield rejected
            else:
                try:
                    result = await broker.execute(
                        request,
                        peer_name=leader.name,
                        round_num=rnd,
                        allowed_capabilities=stage.allowed_capabilities,
                    )
                except Exception as exc:
                    error_event = {
                        "event": "bootstrap_error",
                        "data": {
                            "round": rnd,
                            "peer": leader.name,
                            "phase": "broker_execute",
                            "message": f"{type(exc).__name__}: {exc}",
                        },
                    }
                    round_events.append(error_event)
                    leader.record_action_result(f"broker failure {request_capability}", success=False)
                    yield error_event
                    result = {
                        "rejected": True,
                        "output": str(exc),
                        "success": False,
                        "artifact_changed": False,
                        "path": None,
                    }
                if result["rejected"]:
                    event = {
                        "event": "bootstrap_tool_rejected",
                        "data": {
                            "round": rnd,
                            "peer": leader.name,
                            "capability": request_capability,
                            "reason": result["output"],
                        },
                    }
                    leader.record_action_result(f"rejected {request_capability}", success=False)
                    round_events.append(event)
                    yield event
                else:
                    event = {
                        "event": "bootstrap_tool_executed",
                        "data": {
                            "round": rnd,
                            "peer": leader.name,
                            "capability": request_capability,
                            "success": result["success"],
                            "output_preview": str(result["output"])[:400],
                        },
                    }
                    round_events.append(event)
                    leader.record_action_result(f"{request_capability} via broker", success=bool(result["success"]))
                    yield event

                    if result["artifact_changed"]:
                        artifact = {
                            "event": "bootstrap_artifact_changed",
                            "data": {
                                "round": rnd,
                                "peer": leader.name,
                                "capability": request_capability,
                                "path": result["path"],
                            },
                        }
                        round_events.append(artifact)
                        yield artifact

                    if request_capability == "self_assess" and result["success"]:
                        try:
                            parsed = json.loads(result["output"])
                        except json.JSONDecodeError:
                            parsed = {"raw": result["output"]}
                        assessment_event = {
                            "event": "bootstrap_assessment",
                            "data": {
                                "round": rnd,
                                "source": "workspace",
                                "assessment": parsed,
                            },
                        }
                        round_events.append(assessment_event)
                        yield assessment_event

        protocol.record_round(rnd, [leader_step["message"], reviewer_step["message"]])
        protocol_removed = protocol.consolidate(rnd)
        if protocol_removed:
            round_events.append(
                {
                    "event": "bootstrap_protocol_pruned",
                    "data": {"round": rnd, "tokens": protocol_removed},
                }
            )
            yield round_events[-1]

        broker.sync_protocol_file(protocol.to_dict())
        scorecard = _assessment(stage=stage, broker=broker, protocol=protocol, peer_a=peer_a, peer_b=peer_b)
        assessment = {"event": "bootstrap_assessment", "data": {"round": rnd, "source": "system", "assessment": scorecard}}
        round_events.append(assessment)
        yield assessment

        if stage_index < len(BOOTSTRAP_STAGES) - 1 and _stage_passed(stage, broker, protocol):
            stage_index += 1
            next_stage = BOOTSTRAP_STAGES[stage_index]
            stage_event = {
                "event": "bootstrap_stage_up",
                "data": {
                    "round": rnd,
                    "stage": next_stage.name,
                    "stage_id": next_stage.id,
                    "unlocked_capabilities": list(next_stage.allowed_capabilities),
                },
            }
            round_events.append(stage_event)
            yield stage_event
            injection = {
                "event": "bootstrap_injection",
                "data": {
                    "round": rnd,
                    "stage": next_stage.name,
                    "injection": next_stage.injection,
                },
            }
            round_events.append(injection)
            yield injection

        broker.save_checkpoint(
            _checkpoint_state(
                broker=broker,
                protocol=protocol,
                peer_a=peer_a,
                peer_b=peer_b,
                stage_index=stage_index,
                round_num=rnd,
                target_rounds=rounds,
                round_events=round_events,
                completed=False,
                system_assessment=scorecard,
            )
        )

    final_assessment = _assessment(
        stage=BOOTSTRAP_STAGES[stage_index],
        broker=broker,
        protocol=protocol,
        peer_a=peer_a,
        peer_b=peer_b,
    )
    if continuous:
        broker.save_checkpoint(
            _checkpoint_state(
                broker=broker,
                protocol=protocol,
                peer_a=peer_a,
                peer_b=peer_b,
                stage_index=stage_index,
                round_num=rounds,
                target_rounds=rounds,
                round_events=round_events,
                completed=False,
                system_assessment=final_assessment,
            )
        )
        yield {
            "event": "bootstrap_checkpoint_saved",
            "data": {
                "round": rounds,
                "stage": BOOTSTRAP_STAGES[stage_index].name,
                "stage_id": BOOTSTRAP_STAGES[stage_index].id,
                "assessment": final_assessment,
                "target_rounds": rounds,
            },
        }
        return
    broker.save_checkpoint(
        _checkpoint_state(
            broker=broker,
            protocol=protocol,
            peer_a=peer_a,
            peer_b=peer_b,
            stage_index=stage_index,
            round_num=rounds,
            target_rounds=rounds,
            round_events=round_events,
            completed=True,
            system_assessment=final_assessment,
        )
    )
    yield {
        "event": "bootstrap_complete",
        "data": {
            "stage": BOOTSTRAP_STAGES[stage_index].name,
            "stage_id": stage_index,
            "peer_a": peer_a.to_dict(),
            "peer_b": peer_b.to_dict(),
            "protocol": protocol.to_dict(),
            "assessment": final_assessment,
            "artifacts": broker.list_artifacts(),
            "run_cost_usd": round(peer_a.total_cost_usd + peer_b.total_cost_usd, 4),
        },
    }
