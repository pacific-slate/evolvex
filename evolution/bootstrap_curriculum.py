"""
Bootstrap curriculum definitions.

Stages control what the peers are trying to achieve and which brokered
capabilities they may request.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BootstrapStage:
    id: int
    name: str
    objective: str
    injection: str
    allowed_capabilities: tuple[str, ...]


BOOTSTRAP_STAGES: list[BootstrapStage] = [
    BootstrapStage(
        id=0,
        name="Handshake",
        objective="Invent a minimal shared interface and write a collaborative charter into scratch space.",
        injection="You are not allowed to touch the filesystem directly yet. Use only messaging, critique, and scratch space to bootstrap coordination.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read"),
    ),
    BootstrapStage(
        id=1,
        name="Artifacts",
        objective="Turn the shared interface into durable artifacts and formalize the operating language.",
        injection="You may now create files. Traceability matters: document decisions and make your protocol explicit.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read", "write_file", "read_file", "list_directory"),
    ),
    BootstrapStage(
        id=2,
        name="Context",
        objective="Inspect the local EvolveX repo and use it to infer how a stronger autonomous agent should be built.",
        injection="A limited repo reader is now available. Use existing code as scaffolding, not as a substitute for your own architecture.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read", "write_file", "read_file", "list_directory", "repo_read"),
    ),
    BootstrapStage(
        id=3,
        name="Build",
        objective="Create a runnable agent package in the bootstrap workspace and execute it.",
        injection="You can now run Python and create tests. Build incrementally and keep your trace clean.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read", "write_file", "read_file", "list_directory", "repo_read", "execute_python", "create_test", "self_assess"),
    ),
    BootstrapStage(
        id=4,
        name="Verify",
        objective="Strengthen the built agent through tests, critique, and shell-based verification.",
        injection="A constrained shell is now available. Use it for verification, not environment escape.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read", "write_file", "read_file", "list_directory", "repo_read", "execute_python", "create_test", "self_assess", "run_shell"),
    ),
    BootstrapStage(
        id=5,
        name="Research",
        objective="Compare your design against open-source agent patterns and import one concrete improvement.",
        injection="Web access is now available. Use open-source, traceable sources and record what changed because of them.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read", "write_file", "read_file", "list_directory", "repo_read", "execute_python", "create_test", "self_assess", "run_shell", "web_search", "http_get"),
    ),
    BootstrapStage(
        id=6,
        name="Integration",
        objective="Fold new research into the built agent and stabilize the operating language into a reusable system artifact.",
        injection="Package installation is now available if strictly needed. Optimize for a reproducible and observable final run.",
        allowed_capabilities=("scratchpad_write", "scratchpad_read", "write_file", "read_file", "list_directory", "repo_read", "execute_python", "create_test", "self_assess", "run_shell", "web_search", "http_get", "install_package"),
    ),
]
