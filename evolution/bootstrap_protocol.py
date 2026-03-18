"""
Bootstrap operating language state.

Tokens become first-class artifacts in Bootstrap mode. They start pending,
must be adopted by the other peer, and become stable after repeated use.
"""

from dataclasses import dataclass


@dataclass
class ProtocolEntry:
    token: str
    meaning: str
    proposed_by: str
    round_created: int
    accepted_by: str | None = None
    state: str = "pending"
    usage_count: int = 0
    first_used_round: int | None = None
    stable_round: int | None = None


class BootstrapProtocol:
    def __init__(self) -> None:
        self.vocabulary: dict[str, ProtocolEntry] = {}
        self.round_history: list[dict] = []

    def propose(self, token: str, meaning: str, proposed_by: str, round_num: int) -> bool:
        token = token.strip()[:24]
        meaning = meaning.strip()[:160]
        if not token or not meaning:
            return False
        if token in self.vocabulary:
            return False
        lowered_meaning = meaning.lower()
        for entry in self.vocabulary.values():
            if entry.meaning.lower() == lowered_meaning:
                return False
        self.vocabulary[token] = ProtocolEntry(
            token=token,
            meaning=meaning,
            proposed_by=proposed_by,
            round_created=round_num,
        )
        return True

    def adopt(self, token: str, accepted_by: str, round_num: int) -> bool:
        entry = self.vocabulary.get(token)
        if entry is None:
            return False
        if entry.proposed_by == accepted_by:
            return False
        entry.accepted_by = accepted_by
        if entry.state == "pending":
            entry.state = "adopted"
        if entry.usage_count >= 2 and entry.stable_round is None:
            entry.state = "stable"
            entry.stable_round = round_num
        return True

    def record_usage(self, text: str, round_num: int) -> list[str]:
        hits: list[str] = []
        for token, entry in self.vocabulary.items():
            if token in text:
                hits.append(token)
                entry.usage_count += 1
                if entry.first_used_round is None:
                    entry.first_used_round = round_num
                if entry.accepted_by and entry.usage_count >= 2 and entry.stable_round is None:
                    entry.state = "stable"
                    entry.stable_round = round_num
        return hits

    def stable_count(self) -> int:
        return sum(1 for entry in self.vocabulary.values() if entry.state == "stable")

    def utilization_rate(self) -> float:
        if not self.vocabulary:
            return 0.0
        used = sum(1 for entry in self.vocabulary.values() if entry.usage_count > 0)
        return round(used / len(self.vocabulary), 3)

    def compression_ratio(self, texts: list[str]) -> float:
        if not texts:
            return 1.0
        full_text = "\n".join(texts)
        total = max(1, len(full_text))
        adjusted = len(full_text)
        for token in self.vocabulary:
            adjusted -= full_text.count(token) * len(token)
        return round(max(0.0, min(1.0, adjusted / total)), 3)

    def consolidate(self, round_num: int) -> list[str]:
        removed: list[str] = []
        for token, entry in list(self.vocabulary.items()):
            stale_pending = entry.state == "pending" and (round_num - entry.round_created) >= 2
            stale_adopted = entry.state == "adopted" and entry.usage_count == 0 and (round_num - entry.round_created) >= 3
            if stale_pending or stale_adopted:
                removed.append(token)
                del self.vocabulary[token]
        return removed

    def record_round(self, round_num: int, texts: list[str]) -> None:
        self.round_history.append(
            {
                "round": round_num,
                "compression_ratio": self.compression_ratio(texts),
                "vocab_size": len(self.vocabulary),
                "stable_tokens": self.stable_count(),
            }
        )

    def summary(self) -> str:
        if not self.vocabulary:
            return "(no shared tokens yet)"
        lines = []
        for entry in list(self.vocabulary.values())[-12:]:
            lines.append(
                f"{entry.token} = {entry.meaning} "
                f"[state={entry.state}, usage={entry.usage_count}, proposer={entry.proposed_by}, accepter={entry.accepted_by or '-'}]"
            )
        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "vocabulary": [
                {
                    "token": entry.token,
                    "meaning": entry.meaning,
                    "proposed_by": entry.proposed_by,
                    "accepted_by": entry.accepted_by,
                    "state": entry.state,
                    "round_created": entry.round_created,
                    "usage_count": entry.usage_count,
                    "first_used_round": entry.first_used_round,
                    "stable_round": entry.stable_round,
                }
                for entry in self.vocabulary.values()
            ],
            "vocab_size": len(self.vocabulary),
            "stable_tokens": self.stable_count(),
            "utilization_rate": self.utilization_rate(),
            "round_history": self.round_history[-20:],
        }

    def restore_state(self, state: dict | None) -> None:
        self.vocabulary = {}
        self.round_history = []
        state = state or {}
        for entry in state.get("vocabulary", []):
            token = entry.get("token")
            meaning = entry.get("meaning")
            proposed_by = entry.get("proposed_by")
            round_created = entry.get("round_created")
            if not token or not meaning or proposed_by is None or round_created is None:
                continue
            self.vocabulary[token] = ProtocolEntry(
                token=token,
                meaning=meaning,
                proposed_by=proposed_by,
                round_created=int(round_created),
                accepted_by=entry.get("accepted_by"),
                state=entry.get("state", "pending"),
                usage_count=int(entry.get("usage_count", 0)),
                first_used_round=entry.get("first_used_round"),
                stable_round=entry.get("stable_round"),
            )
        self.round_history = list(state.get("round_history", []))[-20:]
