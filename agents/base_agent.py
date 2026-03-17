"""
Base agent class. All three agents (Performer, Analyzer, Modifier) inherit from this.
Each agent has an identity, a code body it can introspect, and a generation counter.
"""

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentResult:
    success: bool
    output: Any
    duration_ms: float
    error: str | None = None


@dataclass
class Agent:
    name: str
    generation: int = 0
    fitness_score: float = 0.0
    mutation_history: list[dict] = field(default_factory=list)

    def record_mutation(self, description: str, delta_fitness: float) -> None:
        self.mutation_history.append({
            "generation": self.generation,
            "description": description,
            "delta_fitness": delta_fitness,
            "timestamp": time.time(),
        })
        self.generation += 1
        self.fitness_score += delta_fitness

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "generation": self.generation,
            "fitness_score": round(self.fitness_score, 4),
            "mutation_count": len(self.mutation_history),
        }
