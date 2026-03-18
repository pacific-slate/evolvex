"""Tests for Bootstrap mode."""

import asyncio
import json

import evolution.bootstrap_broker as broker_module
import evolution.bootstrap_sandbox as sandbox_module
from evolution.bootstrap import run_bootstrap
from evolution.bootstrap_broker import BootstrapBroker
from evolution.bootstrap_protocol import BootstrapProtocol


def _set_workspace(monkeypatch, tmp_path):
    monkeypatch.setattr(sandbox_module, "BOOTSTRAP_WORKSPACE", tmp_path)
    monkeypatch.setattr(broker_module, "BOOTSTRAP_WORKSPACE", tmp_path)


def test_protocol_requires_adoption_and_repeated_use():
    protocol = BootstrapProtocol()

    assert protocol.propose("[SIG]", "shared signature", "Peer A", 1) is True
    assert protocol.stable_count() == 0

    protocol.record_usage("first [SIG] use", 1)
    assert protocol.vocabulary["[SIG]"].state == "pending"

    assert protocol.adopt("[SIG]", "Peer B", 1) is True
    assert protocol.vocabulary["[SIG]"].state == "adopted"

    protocol.record_usage("second [SIG] use", 2)
    assert protocol.vocabulary["[SIG]"].state == "stable"
    assert protocol.stable_count() == 1


def test_broker_rejects_locked_capability(monkeypatch, tmp_path):
    _set_workspace(monkeypatch, tmp_path)
    broker = BootstrapBroker()

    result = asyncio.run(
        broker.execute(
            {
                "capability": "write_file",
                "arguments": {"path": "notes.txt", "content": "hello"},
                "reason": "test locked capability",
            },
            peer_name="Peer A",
            round_num=1,
            allowed_capabilities=("scratchpad_write",),
        )
    )

    assert result["rejected"] is True
    assert "locked" in result["output"]


def test_broker_executes_allowed_write(monkeypatch, tmp_path):
    _set_workspace(monkeypatch, tmp_path)
    broker = BootstrapBroker()

    result = asyncio.run(
        broker.execute(
            {
                "capability": "write_file",
                "arguments": {"path": "artifact.md", "content": "bootstrap artifact"},
                "reason": "create artifact",
            },
            peer_name="Peer A",
            round_num=1,
            allowed_capabilities=("write_file",),
        )
    )

    assert result["success"] is True
    assert result["artifact_changed"] is True
    assert (tmp_path / "artifact.md").read_text() == "bootstrap artifact"


class _FakePeer:
    def __init__(self, name: str):
        self.name = name
        self.message_count = 0
        self.accepted_proposals = 0
        self.rejected_proposals = 0
        self.contribution_score = 0.0
        self.dependency_score = 0.0
        self.total_cost_usd = 0.0
        self.generation = 0
        self.fitness_score = 0.0
        self.mutation_count = 0

    async def step(self, **kwargs):
        role = kwargs["role"]
        allowed = kwargs["allowed_capabilities"]

        if role == "leader":
            if "write_file" in allowed:
                return {
                    "message": "I am formalizing our language in PROTOCOL.md using [SIG].",
                    "protocol_proposals": [],
                    "adopt_tokens": [],
                    "critique": "",
                    "review": {"decision": "approve", "reason": "Looks good."},
                    "action_request": {
                        "capability": "write_file",
                        "arguments": {"path": "peer_notes.md", "content": "formalized protocol"},
                        "reason": "Create a durable artifact.",
                    },
                    "assessment": "Durable artifacts are the next step.",
                }
            return {
                "message": "I propose [SIG] as our shared token and want to write a charter.",
                "protocol_proposals": [{"token": "[SIG]", "meaning": "shared coordination signature"}],
                "adopt_tokens": [],
                "critique": "",
                "review": {"decision": "approve", "reason": "Looks good."},
                "action_request": {
                    "capability": "scratchpad_write",
                    "arguments": {"name": "charter", "content": "bootstrap charter"},
                    "reason": "Create the first shared artifact.",
                },
                "assessment": "We need a mutual interface first.",
            }

        return {
            "message": "I adopt [SIG] and approve the proposed action.",
            "protocol_proposals": [],
            "adopt_tokens": ["[SIG]"],
            "critique": "The plan is coherent.",
            "review": {"decision": "approve", "reason": "Proceed."},
            "action_request": {"capability": "none", "arguments": {}, "reason": ""},
            "assessment": "Dependency is working.",
        }

    def record_review(self, decision: str):
        if decision == "approve":
            self.accepted_proposals += 1

    def record_action_result(self, description: str, success: bool):
        self.mutation_count += 1
        if success:
            self.generation += 1

    def to_dict(self):
        return {
            "name": self.name,
            "generation": self.generation,
            "fitness_score": self.fitness_score,
            "mutation_count": self.mutation_count,
            "message_count": self.message_count,
            "accepted_proposals": self.accepted_proposals,
            "rejected_proposals": self.rejected_proposals,
            "contribution_score": self.contribution_score,
            "dependency_score": self.dependency_score,
            "total_cost_usd": self.total_cost_usd,
        }

    def snapshot_state(self):
        return {
            "name": self.name,
            "generation": self.generation,
            "fitness_score": self.fitness_score,
            "mutation_history": [],
            "message_count": self.message_count,
            "accepted_proposals": self.accepted_proposals,
            "rejected_proposals": self.rejected_proposals,
            "contribution_score": self.contribution_score,
            "dependency_score": self.dependency_score,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
        }

    def restore_state(self, state):
        state = state or {}
        self.generation = state.get("generation", 0)
        self.fitness_score = state.get("fitness_score", 0.0)
        self.message_count = state.get("message_count", 0)
        self.accepted_proposals = state.get("accepted_proposals", 0)
        self.rejected_proposals = state.get("rejected_proposals", 0)
        self.contribution_score = state.get("contribution_score", 0.0)
        self.dependency_score = state.get("dependency_score", 0.0)


def test_bootstrap_loop_reaches_next_stage(monkeypatch, tmp_path):
    _set_workspace(monkeypatch, tmp_path)
    broker = BootstrapBroker()
    protocol = BootstrapProtocol()

    async def _collect():
        return [
            event
            async for event in run_bootstrap(
                _FakePeer("Peer A"),
                _FakePeer("Peer B"),
                2,
                model="fake",
                broker=broker,
                protocol=protocol,
            )
        ]

    events = asyncio.run(_collect())
    names = [event["event"] for event in events]

    assert "bootstrap_stage_up" in names
    assert "bootstrap_tool_executed" in names
    assert protocol.stable_count() >= 1
    assert any(item["data"].get("stage") == "Artifacts" for item in events if item["event"] == "bootstrap_stage_up")


def test_bootstrap_resumes_from_checkpoint(monkeypatch, tmp_path):
    _set_workspace(monkeypatch, tmp_path)

    async def _run_once(rounds: int):
        broker = BootstrapBroker()
        protocol = BootstrapProtocol()
        return [
            event
            async for event in run_bootstrap(
                _FakePeer("Peer A"),
                _FakePeer("Peer B"),
                rounds,
                model="fake",
                broker=broker,
                protocol=protocol,
            )
        ]

    first_events = asyncio.run(_run_once(1))
    assert first_events[-1]["event"] == "bootstrap_complete"

    checkpoint_path = tmp_path / ".bootstrap_checkpoint.json"
    checkpoint = json.loads(checkpoint_path.read_text())
    assert checkpoint["completed"] is True

    # Convert the completed checkpoint into an interrupted run and confirm resume.
    checkpoint["completed"] = False
    checkpoint_path.write_text(json.dumps(checkpoint), encoding="utf-8")

    resumed_events = asyncio.run(_run_once(2))
    names = [event["event"] for event in resumed_events]

    assert "bootstrap_resumed" in names
    resumed = next(event for event in resumed_events if event["event"] == "bootstrap_resumed")
    assert resumed["data"]["resume_round"] == 2
