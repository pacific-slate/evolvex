"""
Emergent protocol layer -- shared compressed language developed by Solver and Challenger.
Agents propose compact tokens after each round; vocabulary grows and gets consolidated
on stage transitions. Compression ratio is the primary protocol metric.
"""

from dataclasses import dataclass
from typing import Optional
from evolution.stages import CognitiveStage


@dataclass
class ProtocolEntry:
    token: str           # Compact symbol, e.g. "[SRT]"
    meaning: str         # Natural-language meaning, e.g. "sort operation"
    proposed_by: str     # "challenger" | "solver"
    round_created: int
    usage_count: int = 0


# How many tokens to use per stage (approximate percentage of description in protocol)
PROTOCOL_MODES: dict[CognitiveStage, str] = {
    CognitiveStage.REACTIVE: "english_only",
    CognitiveStage.REFLECTIVE: "hybrid",        # ~30% protocol tokens
    CognitiveStage.STRATEGIC: "protocol_dominant",  # ~70% protocol tokens
    CognitiveStage.META_COGNITIVE: "near_pure",     # ~90% protocol tokens
}

MAX_VOCAB_SIZE = 30

# Prompt injected after round to elicit vocabulary proposals (max_tokens=100)
PROPOSAL_PROMPT = """You are developing a compressed notation for coding challenges.
Current vocabulary: {vocab_summary}
Round {round_num} challenge: {challenge_desc}

Propose 1-3 compact tokens that would make future challenges more concise.
Avoid duplicating existing tokens. Focus on patterns that will recur.

Return ONLY valid JSON:
{{"proposals": [{{"token": "[XYZ]", "meaning": "brief meaning"}}, ...]}}"""

# Prompt for stage-transition vocabulary consolidation (max_tokens=200)
CONSOLIDATION_PROMPT = """You are curating a compressed notation vocabulary.
Current vocabulary ({vocab_size} tokens): {vocab_json}

The agent has graduated to stage: {new_stage}
Prune tokens with usage_count=0 and merge near-duplicates.
Keep the most expressive tokens, max {max_size}.

Return ONLY valid JSON:
{{"kept": [{{"token": "...", "meaning": "...", "proposed_by": "...", "round_created": N, "usage_count": N}}, ...]}}"""


class Protocol:
    """Shared emergent vocabulary between Solver and Challenger."""

    def __init__(self) -> None:
        self.vocabulary: dict[str, ProtocolEntry] = {}
        self.round_history: list[dict] = []   # [{round, compression_ratio, vocab_size}]

    # ── Vocabulary management ────────────────────────────────────────────────

    def add_entry(self, token: str, meaning: str, proposed_by: str, round_num: int) -> bool:
        """Add a vocabulary entry. Returns True if added (False if token already exists)."""
        if token in self.vocabulary or len(self.vocabulary) >= MAX_VOCAB_SIZE:
            return False
        self.vocabulary[token] = ProtocolEntry(
            token=token,
            meaning=meaning,
            proposed_by=proposed_by,
            round_created=round_num,
        )
        return True

    def record_usage(self, description: str) -> int:
        """Scan description for known tokens, increment usage counts. Returns hit count."""
        hits = 0
        for token, entry in self.vocabulary.items():
            if token in description:
                entry.usage_count += 1
                hits += 1
        return hits

    def record_round(self, round_num: int, compression_ratio: float) -> None:
        self.round_history.append({
            "round": round_num,
            "compression_ratio": round(compression_ratio, 3),
            "vocab_size": len(self.vocabulary),
        })

    def replace_vocabulary(self, entries: list[dict]) -> None:
        """Replace vocabulary after consolidation (stage transition)."""
        self.vocabulary = {}
        for e in entries:
            self.vocabulary[e["token"]] = ProtocolEntry(
                token=e["token"],
                meaning=e["meaning"],
                proposed_by=e.get("proposed_by", "system"),
                round_created=e.get("round_created", 0),
                usage_count=e.get("usage_count", 0),
            )

    # ── Prompt helpers ───────────────────────────────────────────────────────

    def get_vocabulary_prompt(self, stage: CognitiveStage) -> str:
        """Return a system-prompt block describing the current vocabulary and mode."""
        mode = PROTOCOL_MODES[stage]
        if mode == "english_only" or not self.vocabulary:
            return ""

        vocab_lines = "\n".join(
            f"  {e.token}: {e.meaning}" for e in self.vocabulary.values()
        )
        mode_instruction = {
            "hybrid": (
                "Use a HYBRID format: write the challenge in plain English, then append "
                "a compact annotation line using vocabulary tokens for key concepts. "
                "Example: 'Find the longest unique subarray. [LST UNIQ CNTG MAX_LEN] [EDG: EMP SNG]'"
            ),
            "protocol_dominant": (
                "Use PROTOCOL-DOMINANT format: lead with token annotations, "
                "use English only for type signatures and novel concepts not in vocabulary. "
                "Example: '[MAX_LEN CNTG UNIQ LST] data:int[]->int [TC:4] [EDG:EMP,SNG,ALL_SAME]'"
            ),
            "near_pure": (
                "Use NEAR-PURE PROTOCOL: almost all tokens, English only for irreducible novelty. "
                "Example: '[HIST_MAX_RECT STK] int[]->int [TC:5] [EDG:EMP,SNG,FLAT,PEAK] [CMPLX:O(n)]'"
            ),
        }.get(mode, "")

        return (
            f"\n\n## Emergent Protocol Vocabulary\n{vocab_lines}\n\n"
            f"## Protocol Mode: {mode}\n{mode_instruction}"
        )

    def get_decoder_prompt(self, stage: CognitiveStage) -> str:
        """Return a system-prompt decoder block for the Solver."""
        if stage == CognitiveStage.REACTIVE or not self.vocabulary:
            return ""
        vocab_lines = "\n".join(
            f"  {e.token} = {e.meaning}" for e in self.vocabulary.values()
        )
        return f"\n\n## Protocol Decoder\nThe challenge may use compact tokens. Decode:\n{vocab_lines}"

    def vocab_summary(self) -> str:
        """One-line vocab summary for proposal prompts."""
        if not self.vocabulary:
            return "(empty)"
        return ", ".join(f"{e.token}={e.meaning}" for e in list(self.vocabulary.values())[:10])

    # ── Metrics ──────────────────────────────────────────────────────────────

    def compression_ratio(self, description: Optional[str] = None) -> float:
        """
        Ratio of protocol chars to total chars in description (0.0 = pure English, lower = more compressed).
        If no description given, returns 1.0 (no compression yet).
        """
        if description is None or not self.vocabulary:
            return 1.0
        total = max(len(description), 1)
        english_chars = len(description)
        for token in self.vocabulary:
            if token in description:
                # Each token replaces ~20 chars of English on average
                english_chars -= len(token)
        ratio = max(0.0, min(1.0, english_chars / total))
        return round(ratio, 3)

    def utilization_rate(self) -> float:
        """Fraction of vocabulary tokens that have been used at least once."""
        if not self.vocabulary:
            return 0.0
        used = sum(1 for e in self.vocabulary.values() if e.usage_count > 0)
        return round(used / len(self.vocabulary), 3)

    # ── Serialization ────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "vocabulary": [
                {
                    "token": e.token,
                    "meaning": e.meaning,
                    "proposed_by": e.proposed_by,
                    "round_created": e.round_created,
                    "usage_count": e.usage_count,
                }
                for e in self.vocabulary.values()
            ],
            "vocab_size": len(self.vocabulary),
            "utilization_rate": self.utilization_rate(),
            "round_history": self.round_history[-20:],  # last 20 for payload size
        }
