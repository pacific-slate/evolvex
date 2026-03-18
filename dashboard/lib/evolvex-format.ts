import type { EventData, ModeDefinition, ModeKey, ModeTheme, StatusTone } from "./evolvex-types";

export const MODE_ORDER: ModeKey[] = ["classic", "arena", "bootstrap", "genesis"];

export const SYSTEM_STORY_STEPS = [
  "Define an experiment mode and launch it from one control surface.",
  "Observe the live loop as the system mutates, competes, negotiates, or builds.",
  "Capture the evidence stream: safety gates, protocol emergence, stage changes, and artifacts.",
  "Compare autonomy regimes using the same workbench instead of four disconnected demos.",
];

const MODE_THEMES: Record<ModeKey, ModeTheme> = {
  classic: {
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    button: "bg-emerald-300 text-slate-950 hover:bg-emerald-200",
    buttonMuted: "border-emerald-400/25 text-emerald-100 hover:border-emerald-300/50",
    panel: "border-emerald-400/18 bg-emerald-400/[0.06]",
    accentText: "text-emerald-200",
    border: "border-emerald-400/30",
  },
  arena: {
    chip: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    button: "bg-violet-300 text-slate-950 hover:bg-violet-200",
    buttonMuted: "border-violet-400/25 text-violet-100 hover:border-violet-300/50",
    panel: "border-violet-400/18 bg-violet-400/[0.06]",
    accentText: "text-violet-200",
    border: "border-violet-400/30",
  },
  bootstrap: {
    chip: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    button: "bg-sky-300 text-slate-950 hover:bg-sky-200",
    buttonMuted: "border-sky-400/25 text-sky-100 hover:border-sky-300/50",
    panel: "border-sky-400/18 bg-sky-400/[0.06]",
    accentText: "text-sky-200",
    border: "border-sky-400/30",
  },
  genesis: {
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    button: "bg-amber-300 text-slate-950 hover:bg-amber-200",
    buttonMuted: "border-amber-400/25 text-amber-100 hover:border-amber-300/50",
    panel: "border-amber-400/18 bg-amber-400/[0.06]",
    accentText: "text-amber-200",
    border: "border-amber-400/30",
  },
};

export const MODE_DEFINITIONS: Record<ModeKey, ModeDefinition> = {
  classic: {
    key: "classic",
    label: "Classic",
    strapline: "Self-modifying benchmark loop",
    heroTitle: "Checkpointed mutation under measurable pressure",
    whatItIs:
      "Classic runs a benchmark, asks an analyzer what to change, mutates the task code, and only applies a mutation if sandbox validation proves it improved fitness.",
    whyItMatters:
      "This is the baseline evolution control loop: a fully auditable path from baseline measurement to suggestion, sandbox verdict, and applied or discarded mutation.",
    captures: [
      "Fitness deltas and mutation counts across generations.",
      "Checkpoint, sandbox, rollback, and applied/discarded decisions.",
      "Code previews and the current benchmark implementation.",
      "A chronological trace of every intervention in the loop.",
    ],
    audiences: ["Researchers", "Agent builders", "Reliability teams"],
    readyBrief: {
      eyebrow: "Ready To Run",
      title: "Launch a safe mutation run",
      summary:
        "Classic mode is the fastest proof that EvolveX is a control system, not just a chat loop. It shows how the workbench measures, proposes, validates, and either applies or rejects change.",
      bullets: [
        "Benchmark the current agent and establish a baseline.",
        "Checkpoint before any mutation is allowed to apply.",
        "Surface every sandbox decision in the live trace.",
      ],
    },
    theme: MODE_THEMES.classic,
  },
  arena: {
    key: "arena",
    label: "Arena",
    strapline: "Adversarial challenge ladder",
    heroTitle: "Competitive co-evolution across cognitive stages",
    whatItIs:
      "Arena pits a solver against an escalating challenger. The solver must win repeatedly to graduate through Piaget-inspired stages, while the workbench records the protocol and performance shifts that emerge.",
    whyItMatters:
      "Arena makes capability progression legible. Instead of a single score, judges can see stage changes, win streaks, challenge difficulty, and protocol compression as the system adapts.",
    captures: [
      "Stage progression and win/loss evidence for the solver.",
      "Challenge prompts, solver attempts, and protocol token usage.",
      "Compression history that shows whether communication becomes more efficient.",
      "A mode-wide trace that is easy to compare round by round.",
    ],
    audiences: ["Evaluation teams", "Cognitive architecture researchers", "Benchmark designers"],
    readyBrief: {
      eyebrow: "Ready To Run",
      title: "Stress-test reasoning under an adversary",
      summary:
        "Arena mode turns the workbench into a challenge ladder. It highlights progression, failure modes, and protocol emergence instead of flattening everything into a single benchmark score.",
      bullets: [
        "Watch the solver advance from reactive to strategic behavior.",
        "See the challenger force harder tasks as the solver wins.",
        "Track whether the emergent protocol actually compresses coordination.",
      ],
    },
    theme: MODE_THEMES.arena,
  },
  bootstrap: {
    key: "bootstrap",
    label: "Bootstrap",
    strapline: "Multi-agent autonomy with emergent protocol",
    heroTitle: "Observe two peers invent coordination under constraints",
    whatItIs:
      "Bootstrap starts two peers with minimal priors, stage-gated capabilities, and a brokered toolchain. The workbench watches whether they can invent a shared language, coordinate around artifacts, and unlock autonomy.",
    whyItMatters:
      "Bootstrap is the clearest demonstration that EvolveX can supervise agent societies, not just single loops. It captures protocol health, collaboration quality, artifact growth, and the cost of autonomy.",
    captures: [
      "Protocol proposals, adoptions, pruning, and stable token growth.",
      "Peer message flow, broker decisions, and tool audit trails.",
      "Artifacts produced in the bootstrap workspace.",
      "Assessment scores for collaboration, language, traceability, and autonomy.",
    ],
    audiences: ["Infra teams", "Autonomy researchers", "Multi-agent product teams"],
    readyBrief: {
      eyebrow: "Ready To Run",
      title: "Stand up a monitored autonomy lab",
      summary:
        "Bootstrap mode shows why EvolveX is a supervision tool. It reveals whether two peers can coordinate, what protocol they invent, and how safely they use capabilities as the curriculum expands.",
      bullets: [
        "Start with constrained capabilities and staged unlocks.",
        "Inspect the operating language as tokens become stable.",
        "Review every artifact and broker decision from one interface.",
      ],
    },
    theme: MODE_THEMES.bootstrap,
  },
  genesis: {
    key: "genesis",
    label: "Genesis",
    strapline: "Autonomous builder",
    heroTitle: "Track an agent as it researches, builds, and self-assesses",
    whatItIs:
      "Genesis follows a single builder through research, planning, implementation, and self-assessment. The workbench exposes tool calls, file changes, cost, and narrative state as the workspace evolves.",
    whyItMatters:
      "Genesis is the most product-facing proof that EvolveX can supervise an autonomous builder. It translates opaque model behavior into a timeline of concrete actions, artifacts, and capability scores.",
    captures: [
      "Phase changes, iteration count, and token-cost telemetry.",
      "Tool calls, tool results, and file mutations inside the workspace.",
      "Recent build narrative rather than a raw log dump.",
      "Capability assessment that summarizes how well the builder performed.",
    ],
    audiences: ["Platform teams", "Agent operators", "Internal developer tools teams"],
    readyBrief: {
      eyebrow: "Ready To Run",
      title: "Monitor an autonomous build session",
      summary:
        "Genesis mode frames EvolveX as a builder supervision console. Instead of watching a black box code itself, the operator gets a controlled narrative of files, tools, costs, and self-critique.",
      bullets: [
        "Follow the builder through explicit phases.",
        "Review workspace artifacts without reading raw JSON.",
        "Use the trace dock to understand what the agent actually did.",
      ],
    },
    theme: MODE_THEMES.genesis,
  },
};

function clip(value: unknown, length = 120) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function asNumber(value: unknown, digits = 0) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "0";
  return digits > 0 ? num.toFixed(digits) : String(num);
}

function humanize(raw: string) {
  return raw
    .replace(/^arena_/, "")
    .replace(/^bootstrap_/, "")
    .replace(/^genesis_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function inferModeFromEvent(event: string): ModeKey {
  if (event.startsWith("arena_")) return "arena";
  if (event.startsWith("bootstrap_")) return "bootstrap";
  if (event.startsWith("genesis_")) return "genesis";
  return "classic";
}

export function formatEventLabel(event: string) {
  return humanize(event);
}

export function getModeTheme(mode: ModeKey) {
  return MODE_DEFINITIONS[mode].theme;
}

export function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCurrency(value: number) {
  return `$${value.toFixed(3)}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function eventTone(event: string): StatusTone {
  if (event.includes("error") || event === "sandbox_failed" || event === "arena_loss" || event === "bootstrap_tool_rejected") {
    return "danger";
  }
  if (event.includes("passed") || event.includes("complete") || event.includes("applied") || event.includes("win")) {
    return "success";
  }
  if (event.includes("stopped") || event.includes("discarded") || event.includes("rollback") || event.includes("reset")) {
    return "warning";
  }
  if (event.includes("started") || event.includes("phase_change") || event.includes("tool_call") || event.includes("protocol")) {
    return "active";
  }
  return "muted";
}

export function formatEventSummary(event: string, data: EventData) {
  switch (event) {
    case "started":
      return `${asNumber(data.cycles)} cycles queued from a ${asNumber(data.baseline_ms, 3)}ms baseline`;
    case "cycle_start":
      return `Cycle ${asNumber(data.cycle)} of ${asNumber(data.of)}`;
    case "benchmark":
      return `Benchmark ${asNumber(data.duration_ms, 2)}ms · fitness ${asNumber(data.fitness, 4)}`;
    case "analysis":
      return clip(data.suggestion, 120);
    case "sandbox_passed":
      return `Sandbox passed · proposed fitness ${asNumber(data.proposed_fitness, 4)}`;
    case "sandbox_failed":
      return `Sandbox failed · ${clip(data.error, 90)}`;
    case "applied":
      return `Mutation applied · fitness ${asNumber(data.new_fitness, 4)} (${asNumber(data.pct_improvement, 2)}% improvement)`;
    case "discarded":
      return `Mutation discarded · ${clip(data.reason, 100)}`;
    case "rollback":
      return `Rolled back to generation ${asNumber(data.to_generation)}`;
    case "complete":
      return `Classic run complete at generation ${asNumber(data.generation)} with fitness ${asNumber(data.fitness_score, 4)}`;
    case "error":
      return clip(data.message ?? data.error, 120);
    case "arena_challenge":
      return clip(data.description, 140);
    case "arena_protocol_entry": {
      const tokens = Array.isArray(data.entries)
        ? data.entries.map((entry) => (typeof entry === "object" && entry && "token" in entry ? String(entry.token) : "")).filter(Boolean)
        : [];
      return `+${tokens.join(" ")} by ${clip(data.proposed_by, 24)}`;
    }
    case "arena_protocol_used":
      return `ratio=${asNumber(data.compression_ratio, 2)} · vocab=${asNumber(data.vocab_size)}`;
    case "arena_protocol_consolidate":
      return `Stage ${asNumber(data.new_stage)} · vocab ${asNumber(data.vocab_size)}`;
    case "arena_solver_attempt":
      return clip(data.code_preview, 120);
    case "arena_stage_up":
      return `Solver advanced to ${clip(data.new_stage, 40)}`;
    case "arena_win":
      return `Round ${asNumber(data.round)} win · ${asNumber(data.consecutive_wins)} consecutive`;
    case "arena_loss":
      return `Round ${asNumber(data.round)} loss · ${clip(data.reason, 90)}`;
    case "arena_complete":
      return `Arena complete · win rate ${formatPercent(Number(data.win_rate ?? 0), 1)}`;
    case "bootstrap_resumed":
      return `Resumed at round ${asNumber(data.resume_round)} from checkpoint`;
    case "bootstrap_round_start":
      return `Bootstrap round ${asNumber(data.round)} of ${asNumber(data.of)}`;
    case "bootstrap_objective":
      return clip(data.objective, 140);
    case "bootstrap_peer_message":
      return `${clip(data.peer, 28)} (${clip(data.role, 24)}): ${clip(data.message, 120)}`;
    case "bootstrap_protocol_proposed":
      return `${clip(data.peer, 28)} proposed ${clip(data.token, 24)} = ${clip(data.meaning, 80)}`;
    case "bootstrap_protocol_adopted":
      return `${clip(data.peer, 28)} adopted ${clip(data.token, 24)}`;
    case "bootstrap_tool_requested":
      return `${clip(data.peer, 28)} requested ${clip(data.capability, 28)} (${clip(data.review_decision, 24)})`;
    case "bootstrap_tool_executed":
      return `${clip(data.peer, 28)} executed ${clip(data.capability, 28)} ${data.success ? "✓" : "✗"} · ${clip(data.output_preview, 80)}`;
    case "bootstrap_tool_rejected":
      return `${clip(data.peer, 28)} ${clip(data.capability, 28)} rejected · ${clip(data.reason, 80)}`;
    case "bootstrap_artifact_changed":
      return `${clip(data.peer, 28)} changed ${clip(data.path, 80)}`;
    case "bootstrap_stage_up":
      return `Bootstrap advanced to ${clip(data.stage, 40)}`;
    case "bootstrap_injection":
      return clip(data.injection, 120);
    case "bootstrap_assessment":
      if (data.assessment && typeof data.assessment === "object") {
        const assessment = data.assessment as Record<string, unknown>;
        const parts = [
          typeof assessment.overall === "number" ? `overall ${assessment.overall}` : null,
          typeof assessment.collaboration === "number" ? `collaboration ${assessment.collaboration}` : null,
          typeof assessment.language === "number" ? `language ${assessment.language}` : null,
          typeof assessment.traceability === "number" ? `traceability ${assessment.traceability}` : null,
          typeof assessment.autonomy === "number" ? `autonomy ${assessment.autonomy}` : null,
        ].filter(Boolean);
        return `${clip(data.source, 20)} assessment · ${parts.join(" · ") || "updated"}`;
      }
      return `${clip(data.source, 20)} assessment updated`;
    case "bootstrap_complete":
      return `Bootstrap complete after round ${asNumber(data.round)}`;
    case "genesis_thinking":
      return clip(data.thought, 140);
    case "genesis_tool_call":
      return `${clip(data.tool, 36)}(${clip(data.args_preview, 80)})`;
    case "genesis_tool_result":
      return `${clip(data.tool, 36)} ${data.success ? "✓" : "✗"} ${asNumber(data.duration_ms)}ms · ${clip(data.output_preview, 90)}`;
    case "genesis_file_changed":
      return `${clip(data.action, 24)} ${clip(data.path, 90)}${typeof data.size_bytes === "number" ? ` (${formatBytes(data.size_bytes)})` : ""}`;
    case "genesis_phase_change":
      return `${clip(data.old_phase, 24)} → ${clip(data.new_phase, 24)}`;
    case "genesis_token_usage":
      return `${formatCurrency(Number(data.total_cost_usd ?? 0))} · in=${asNumber(data.prompt_tokens)} cached=${asNumber(data.cached_prompt_tokens)} out=${asNumber(data.completion_tokens)}${data.pricing_known === false ? " · pricing unavailable" : ""}`;
    case "genesis_narrative":
      return clip(data.text, 120);
    case "genesis_complete":
      return `Genesis complete · ${asNumber(data.iterations_completed)} iterations`;
    default: {
      const entries = Object.entries(data)
        .slice(0, 3)
        .map(([key, value]) => `${humanize(key)}: ${clip(value, 40)}`);
      return entries.length > 0 ? entries.join(" · ") : "No structured payload";
    }
  }
}
