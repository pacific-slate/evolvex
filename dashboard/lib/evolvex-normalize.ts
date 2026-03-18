import {
  MODE_DEFINITIONS,
  MODE_ORDER,
  eventTone,
  formatCurrency,
  formatEventLabel,
  formatEventSummary,
  formatPercent,
} from "./evolvex-format";
import type {
  FormattedTrace,
  IdleBrief,
  InspectorItem,
  InspectorSection,
  ModeKey,
  ModeRailCard,
  StatusTone,
  WorkbenchOverview,
  WorkbenchRawState,
} from "./evolvex-types";

const SAFETY_EVENTS = new Set(["sandbox_passed", "sandbox_failed"]);

function modeEventCount(state: WorkbenchRawState, mode: ModeKey) {
  return state.events.filter((event) => event.mode === mode).length;
}

function lastModeEvent(state: WorkbenchRawState, mode: ModeKey) {
  const scoped = state.events.filter((event) => event.mode === mode);
  return scoped.at(-1) ?? null;
}

function lastClassicDecision(state: WorkbenchRawState) {
  const decision = [...state.events]
    .reverse()
    .find((event) => ["applied", "discarded", "sandbox_passed", "sandbox_failed"].includes(event.event));

  if (!decision) return "Awaiting validation";
  return formatEventSummary(decision.event, decision.data);
}

function buildModeStatusLabel(mode: ModeKey, state: WorkbenchRawState) {
  switch (mode) {
    case "classic":
      if (state.modeRunning.classic) return "Mutation cycle live";
      if (state.agent) return `Generation ${state.agent.generation}`;
      return "Ready";
    case "arena":
      if (state.modeRunning.arena && state.solver?.stage_name) return state.solver.stage_name;
      if (state.solver?.stage_name) return `Stage: ${state.solver.stage_name}`;
      return "Ready";
    case "bootstrap": {
      if (state.bootstrapStatus?.round && state.bootstrapStatus?.target_rounds) {
        return `Round ${state.bootstrapStatus.round} of ${state.bootstrapStatus.target_rounds}`;
      }
      if (state.bootstrapStatus?.round) return `Round ${state.bootstrapStatus.round}`;
      if (state.bootstrapStatus?.stage) return state.bootstrapStatus.stage;
      return "Ready";
    }
    case "genesis":
      if (state.genesisStatus?.phase) return `Phase: ${state.genesisStatus.phase}`;
      return "Ready";
  }
}

function buildModeStatusTone(mode: ModeKey, state: WorkbenchRawState): StatusTone {
  if (state.modeRunning[mode]) return "active";
  const lastEvent = lastModeEvent(state, mode);
  if (!lastEvent) return "idle";
  if (lastEvent.event.includes("error") || lastEvent.event.includes("failed") || lastEvent.event.includes("loss")) return "danger";
  if (lastEvent.event.includes("complete") || lastEvent.event.includes("applied") || lastEvent.event.includes("win")) return "success";
  return "muted";
}

function buildModeEvidenceLabel(mode: ModeKey, state: WorkbenchRawState) {
  switch (mode) {
    case "classic":
      return state.agent ? `${state.agent.mutation_count} applied mutations` : "Checkpointed mutation trace";
    case "arena":
      return `${state.protocol?.vocab_size ?? 0} protocol tokens`;
    case "bootstrap":
      return `${state.bootstrapProtocol?.stable_tokens ?? 0} stable / ${state.bootstrapProtocol?.vocab_size ?? 0} total tokens`;
    case "genesis":
      return `${state.genesisFiles.length} workspace files`;
  }
}

function buildLiveItems(mode: ModeKey, state: WorkbenchRawState): InspectorItem[] {
  switch (mode) {
    case "classic":
      return [
        {
          label: "Generation",
          value: state.agent ? String(state.agent.generation) : "—",
          helper: "Current evolved performer state",
        },
        {
          label: "Fitness",
          value: state.agent ? state.agent.fitness_score.toFixed(4) : "—",
          helper: "Single source of truth for mutation decisions",
        },
        {
          label: "Last Safety Signal",
          value: lastClassicDecision(state),
        },
      ];
    case "arena":
      return [
        {
          label: "Stage",
          value: state.solver?.stage_name ?? "—",
          helper: "Current solver cognition level",
        },
        {
          label: "Win / Loss",
          value: state.solver ? `${state.solver.total_wins} / ${state.solver.total_losses}` : "—",
        },
        {
          label: "Protocol Utilization",
          value: state.protocol ? formatPercent(state.protocol.utilization_rate) : "—",
        },
      ];
    case "bootstrap":
      return [
        {
          label: "Stage",
          value: state.bootstrapStatus?.stage ?? "—",
          helper: "Curriculum position for the peer system",
        },
        {
          label: "Objective",
          value: state.bootstrapStatus?.objective ?? "Waiting for a live objective",
        },
        {
          label: "Run Cost",
          value: formatCurrency(state.bootstrapStatus?.run_cost_usd ?? 0),
          helper: "Observed autonomy cost so far",
        },
      ];
    case "genesis":
      return [
        {
          label: "Phase",
          value: state.genesisStatus?.phase ?? "—",
          helper: "Current builder phase",
        },
        {
          label: "Iteration",
          value: state.genesisStatus ? String(state.genesisStatus.iteration) : "—",
        },
        {
          label: "Cost",
          value:
            state.genesisStatus?.pricing_known === false
              ? "Pricing unavailable"
              : formatCurrency(state.genesisStatus?.total_cost_usd ?? 0),
        },
      ];
  }
}

export function sanitizeRunCount(value: unknown, min: number, max: number) {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, Math.round(next)));
}

export function buildTraceEntries(events: WorkbenchRawState["events"], scope: ModeKey | "all" = "all", limit = 80): FormattedTrace[] {
  const scoped = scope === "all" ? events : events.filter((event) => event.mode === scope);
  return scoped.slice(-limit).map((event) => ({
    event: event.event,
    mode: event.mode,
    label: formatEventLabel(event.event),
    summary: formatEventSummary(event.event, event.data),
    tone: eventTone(event.event),
    ts: event.ts,
  }));
}

export function buildWorkbenchOverview(state: WorkbenchRawState): WorkbenchOverview {
  const activeModeCount = MODE_ORDER.filter((mode) => state.modeRunning[mode]).length;
  const protocolTokenCount = (state.protocol?.vocab_size ?? 0) + (state.bootstrapProtocol?.vocab_size ?? 0);
  const durableRunCount = state.growthRuns.length;
  const promotionQueueCount = state.growthPromotionQueue.length;
  const artifactCount = state.bootstrapArtifacts.length + state.genesisFiles.length + (state.growthLatest?.counts.growth_artifacts ?? 0);
  const safetyChecks = state.events.filter((event) => SAFETY_EVENTS.has(event.event)).length;
  const lastTrace = buildTraceEntries(state.events, "all", 1)[0] ?? null;

  return {
    activeModeCount,
    protocolTokenCount,
    artifactCount,
    safetyChecks,
    allModesIdle: activeModeCount === 0,
    lastTrace,
    metrics: [
      {
        label: "Experiments Live",
        value: String(activeModeCount),
        helper: activeModeCount > 0 ? "Modes currently running in the lab" : "Workbench is ready for the next run",
      },
      {
        label: "Durable Runs",
        value: String(durableRunCount),
        helper: durableRunCount > 0 ? "Registry-backed runs available for review" : "No seeded growth runs yet",
      },
      {
        label: "Promotion Queue",
        value: String(promotionQueueCount),
        helper: promotionQueueCount > 0 ? "Candidates waiting for operator review" : "No promotion candidates queued",
      },
      {
        label: "Protocol Tokens",
        value: String(protocolTokenCount),
        helper: "Emergent language across Arena and Bootstrap",
      },
      {
        label: "Artifacts Tracked",
        value: String(artifactCount),
        helper: "Live outputs plus registry-backed growth artifacts",
      },
      {
        label: "Safety Checks",
        value: String(safetyChecks),
        helper: "Classic sandbox outcomes captured in the trace",
      },
    ],
  };
}

export function buildModeRailCards(state: WorkbenchRawState): ModeRailCard[] {
  return MODE_ORDER.map((mode) => {
    const definition = MODE_DEFINITIONS[mode];
    return {
      key: mode,
      label: definition.label,
      strapline: definition.strapline,
      statusLabel: buildModeStatusLabel(mode, state),
      statusTone: buildModeStatusTone(mode, state),
      evidenceLabel: buildModeEvidenceLabel(mode, state),
      isRunning: state.modeRunning[mode],
      activityCount: modeEventCount(state, mode),
    };
  });
}

export function buildInspectorSections(mode: ModeKey, state: WorkbenchRawState): InspectorSection[] {
  const definition = MODE_DEFINITIONS[mode];
  const recent = buildTraceEntries(state.events, mode, 1)[0];
  const liveItems = buildLiveItems(mode, state);

  return [
    {
      id: `${mode}-why`,
      kicker: "Why This Matters",
      title: definition.heroTitle,
      body: definition.whyItMatters,
    },
    {
      id: `${mode}-captures`,
      kicker: "What EvolveX Captures",
      title: `${definition.label} evidence model`,
      bullets: definition.captures,
    },
    {
      id: `${mode}-live`,
      kicker: "Live Snapshot",
      title: recent ? recent.label : "Ready for observation",
      body: recent ? recent.summary : "The current view is primed with the latest known status and will enrich itself as soon as a run emits events.",
      items: liveItems,
    },
  ];
}

export function buildIdleBrief(mode: ModeKey): IdleBrief {
  return MODE_DEFINITIONS[mode].readyBrief;
}
