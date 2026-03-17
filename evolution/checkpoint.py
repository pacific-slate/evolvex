"""
Checkpoint system. Saves and restores agent task_code before mutations.
Rollback is automatic if sandbox validation fails.
"""

import time
from dataclasses import dataclass


@dataclass
class Checkpoint:
    agent_name: str
    generation: int
    task_code: str
    fitness_score: float
    timestamp: float = 0.0

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = time.time()


# In-memory store keyed by agent name
_store: dict[str, list[Checkpoint]] = {}


def save(agent_name: str, generation: int, task_code: str, fitness_score: float) -> Checkpoint:
    cp = Checkpoint(
        agent_name=agent_name,
        generation=generation,
        task_code=task_code,
        fitness_score=fitness_score,
    )
    _store.setdefault(agent_name, []).append(cp)
    return cp


def latest(agent_name: str) -> Checkpoint | None:
    checkpoints = _store.get(agent_name, [])
    return checkpoints[-1] if checkpoints else None


def all_checkpoints(agent_name: str) -> list[Checkpoint]:
    return list(_store.get(agent_name, []))


def clear(agent_name: str) -> None:
    _store.pop(agent_name, None)
