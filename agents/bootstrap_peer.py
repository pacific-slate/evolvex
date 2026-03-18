"""
Bootstrap peer agent.

Each peer has the same base prompt and operates with minimal prior structure.
The loop alternates leadership so the peers must critique and depend on one another.
"""

import json
from typing import Any

from openai import AsyncOpenAI

from agents.base_agent import Agent
from evolution.openai_pricing import calculate_usage_cost, usage_counts

_SYSTEM_PROMPT = """\
You are one of two peer agents in a bootstrap experiment.

You are not a polished assistant. You are trying to become more capable by:
- coordinating with your peer
- inventing a compact operating language
- proposing artifacts, tests, and procedures
- improving based on broker feedback

Constraints:
- The other peer is not subordinate to you.
- Tool access is brokered and stage-limited.
- Everything is logged and must remain traceable.
- Favor open-source, reproducible choices.
- Keep your message dense and concrete.

Output ONLY valid JSON with this shape:
{
  "message": "short message to peer",
  "protocol_proposals": [{"token": "[X]", "meaning": "..."}, ...],
  "adopt_tokens": ["[X]"],
  "critique": "brief critique of the latest peer action or idea",
  "review": {"decision": "approve|revise|reject", "reason": "..."},
  "action_request": {
    "capability": "scratchpad_write|scratchpad_read|write_file|read_file|list_directory|repo_read|execute_python|create_test|self_assess|run_shell|web_search|http_get|install_package|none",
    "arguments": {},
    "reason": "why this action matters"
  },
  "assessment": "brief assessment of current capability gap"
}

Role behavior:
- If you are the leader this round, propose one concrete action_request.
- If you are the reviewer this round, focus on critique, adoption, and review.
- If no action is needed, set capability to "none".
"""


class BootstrapPeer(Agent):
    def __init__(self, name: str, client: AsyncOpenAI) -> None:
        super().__init__(name=name)
        self._client = client
        self.message_count = 0
        self.accepted_proposals = 0
        self.rejected_proposals = 0
        self.contribution_score = 0.0
        self.dependency_score = 0.0
        self.total_prompt_tokens = 0
        self.total_cached_prompt_tokens = 0
        self.total_completion_tokens = 0
        self._known_cost_usd = 0.0
        self._has_pricing = True

    @property
    def total_cost_usd(self) -> float:
        return self._known_cost_usd

    def record_message(self, used_peer_input: bool) -> None:
        self.message_count += 1
        self.contribution_score += 1.0
        if used_peer_input:
            self.dependency_score += 1.0

    def record_review(self, decision: str) -> None:
        if decision == "approve":
            self.accepted_proposals += 1
            self.contribution_score += 0.5
        elif decision in {"revise", "reject"}:
            self.rejected_proposals += 1
            self.contribution_score += 0.25

    def record_action_result(self, description: str, success: bool) -> None:
        delta = 0.08 if success else -0.02
        self.record_mutation(description, delta)

    def snapshot_state(self) -> dict:
        return {
            "name": self.name,
            "generation": self.generation,
            "fitness_score": self.fitness_score,
            "mutation_history": list(self.mutation_history),
            "message_count": self.message_count,
            "accepted_proposals": self.accepted_proposals,
            "rejected_proposals": self.rejected_proposals,
            "contribution_score": self.contribution_score,
            "dependency_score": self.dependency_score,
            "total_prompt_tokens": self.total_prompt_tokens,
            "total_cached_prompt_tokens": self.total_cached_prompt_tokens,
            "total_completion_tokens": self.total_completion_tokens,
            "known_cost_usd": self._known_cost_usd,
            "has_pricing": self._has_pricing,
        }

    def restore_state(self, state: dict | None) -> None:
        state = state or {}
        self.generation = int(state.get("generation", 0))
        self.fitness_score = float(state.get("fitness_score", 0.0))
        self.mutation_history = list(state.get("mutation_history", []))
        self.message_count = int(state.get("message_count", 0))
        self.accepted_proposals = int(state.get("accepted_proposals", 0))
        self.rejected_proposals = int(state.get("rejected_proposals", 0))
        self.contribution_score = float(state.get("contribution_score", 0.0))
        self.dependency_score = float(state.get("dependency_score", 0.0))
        self.total_prompt_tokens = int(state.get("total_prompt_tokens", 0))
        self.total_cached_prompt_tokens = int(state.get("total_cached_prompt_tokens", 0))
        self.total_completion_tokens = int(state.get("total_completion_tokens", 0))
        has_known_cost = "known_cost_usd" in state
        has_cached_tokens = "total_cached_prompt_tokens" in state
        self._known_cost_usd = float(state.get("known_cost_usd", 0.0))
        self._has_pricing = bool(state.get("has_pricing", True))
        if not has_known_cost or (self.total_prompt_tokens > 0 and not has_cached_tokens):
            self._has_pricing = False
            self._known_cost_usd = 0.0

    async def step(
        self,
        *,
        model: str,
        role: str,
        objective: str,
        injection: str,
        allowed_capabilities: tuple[str, ...],
        protocol_summary: str,
        workspace_summary: str,
        recent_events: str,
        latest_peer_message: str,
    ) -> dict[str, Any]:
        user_prompt = f"""\
Round role: {role}
Objective: {objective}
Injection: {injection}
Allowed capabilities: {", ".join(allowed_capabilities) if allowed_capabilities else "(none)"}

Current protocol:
{protocol_summary}

Workspace:
{workspace_summary}

Recent events:
{recent_events}

Latest peer message:
{latest_peer_message or "(none yet)"}
"""
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=700,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        if response.usage:
            counts = usage_counts(response.usage)
            self.total_prompt_tokens += counts["prompt_tokens"]
            self.total_cached_prompt_tokens += counts["cached_prompt_tokens"]
            self.total_completion_tokens += counts["completion_tokens"]
            cost = calculate_usage_cost(model, response.usage)
            if cost is None:
                self._has_pricing = False
            else:
                self._known_cost_usd += cost

        raw = (response.choices[0].message.content or "{}").strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}

        message = str(data.get("message", "") or "").strip()
        used_peer_input = bool(latest_peer_message) and any(
            marker in f"{message}\n{data.get('critique', '')}".lower()
            for marker in ["peer", "you", "your", "agree", "disagree", "adopt", "revise"]
        )
        self.record_message(used_peer_input=used_peer_input)
        return {
            "message": message,
            "protocol_proposals": data.get("protocol_proposals") or [],
            "adopt_tokens": data.get("adopt_tokens") or [],
            "critique": str(data.get("critique", "") or ""),
            "review": data.get("review") or {"decision": "approve", "reason": "No review provided."},
            "action_request": data.get("action_request") or {"capability": "none", "arguments": {}, "reason": ""},
            "assessment": str(data.get("assessment", "") or ""),
            "raw": raw[:1200],
        }

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update(
            {
                "message_count": self.message_count,
                "accepted_proposals": self.accepted_proposals,
                "rejected_proposals": self.rejected_proposals,
                "contribution_score": round(self.contribution_score, 2),
                "dependency_score": round(self.dependency_score, 2),
                "total_cost_usd": round(self.total_cost_usd, 4),
                "cached_prompt_tokens": self.total_cached_prompt_tokens,
                "pricing_known": self._has_pricing,
            }
        )
        return base
