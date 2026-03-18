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
  DevelopmentCapability,
  DevelopmentGauge,
  DevelopmentOutput,
  DevelopmentTimelineEntry,
  DevelopmentView,
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
const BOOTSTRAP_STAGE_LABELS = ["Handshake", "Artifacts", "Context", "Build", "Verify", "Research", "Integration"];
const GENESIS_PHASES = ["RESEARCH", "PLAN", "BUILD", "VALIDATE", "ASSESS", "COMPLETE"];

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneFromPercent(value: number): StatusTone {
  if (value >= 75) return "success";
  if (value >= 55) return "active";
  if (value >= 35) return "warning";
  return "muted";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratioPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return clampPercent((numerator / denominator) * 100);
}

function formatTraceTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

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

function buildHeaderChips(
  mode: ModeKey,
  state: WorkbenchRawState,
  changed: FormattedTrace | null,
  progressValueLabel: string,
  budgetValue: string,
): DevelopmentView["headerChips"] {
  return [
    {
      label: "Lens",
      value: MODE_DEFINITIONS[mode].label,
      tone: buildModeStatusTone(mode, state),
    },
    {
      label: "Current state",
      value: buildModeStatusLabel(mode, state),
      tone: buildModeStatusTone(mode, state),
    },
    {
      label: "Progress",
      value: progressValueLabel,
      tone: state.modeRunning[mode] ? "active" : "muted",
    },
    {
      label: "Observed spend",
      value: budgetValue,
      tone: budgetValue.startsWith("$") ? "warning" : "muted",
    },
    {
      label: "Latest shift",
      value: changed?.label ?? "Awaiting live signal",
      tone: changed?.tone ?? "idle",
    },
  ];
}

function buildTimeline(mode: ModeKey, state: WorkbenchRawState): DevelopmentTimelineEntry[] {
  const recent = buildTraceEntries(state.events, "all", 8)
    .slice()
    .reverse()
    .map((entry) => ({
      id: `${entry.ts}-${entry.event}`,
      label: entry.label,
      summary: entry.summary,
      meta: `${MODE_DEFINITIONS[entry.mode].label} · ${formatTraceTime(entry.ts)}`,
      tone: entry.tone,
      mode: entry.mode,
    }));

  if (recent.length) return recent;

  switch (mode) {
    case "bootstrap":
      return [
        {
          id: "bootstrap-ready",
          label: state.bootstrapStatus?.stage ?? "Bootstrap ready",
          summary: state.bootstrapStatus?.objective ?? "Peers are waiting for the first constrained objective and broker review.",
          meta: "Bootstrap",
          tone: state.bootstrapStatus ? "active" : "idle",
          mode,
        },
      ];
    case "arena":
      return [
        {
          id: "arena-ready",
          label: state.solver?.stage_name ?? "Arena ready",
          summary: state.solver ? "Solver state loaded and waiting for the next challenge." : "The solver will start at the first challenge as soon as the arena runs.",
          meta: "Arena",
          tone: state.solver ? "muted" : "idle",
          mode,
        },
      ];
    case "genesis":
      return [
        {
          id: "genesis-ready",
          label: state.genesisStatus?.phase ?? "Genesis ready",
          summary: state.genesisNarrative ?? "The builder is idle until a new autonomous session is launched.",
          meta: "Genesis",
          tone: state.genesisStatus ? "muted" : "idle",
          mode,
        },
      ];
    default:
      return [
        {
          id: "classic-ready",
          label: "Classic ready",
          summary: "The mutation loop is waiting for a new checkpointed evolution run.",
          meta: "Classic",
          tone: "idle",
          mode,
        },
      ];
  }
}

function buildObservedSpend(value: number | undefined, pricingKnown: boolean | undefined) {
  if (pricingKnown === false) return "Pricing unavailable";
  return formatCurrency(value ?? 0);
}

function countCodeLines(source: string | null) {
  if (!source) return 0;
  return source.split(/\r?\n/).length;
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

export function buildDevelopmentView(mode: ModeKey, state: WorkbenchRawState): DevelopmentView {
  const changed = buildTraceEntries(state.events, mode, 1)[0] ?? buildTraceEntries(state.events, "all", 1)[0] ?? null;
  const timeline = buildTimeline(mode, state);
  const stateItems = buildLiveItems(mode, state);

  let title = MODE_DEFINITIONS[mode].heroTitle;
  let summary = MODE_DEFINITIONS[mode].whatItIs;
  let objective = MODE_DEFINITIONS[mode].readyBrief.summary;
  let tension = MODE_DEFINITIONS[mode].whyItMatters;
  let nextStep = MODE_DEFINITIONS[mode].readyBrief.bullets[0] ?? "Awaiting the next operator action.";
  let progressLabel = "Development state";
  let progressValue = 0;
  let progressValueLabel = "Ready";
  let progressHelper = "No live run is in motion.";
  let budgetLabel = "Observed spend";
  let budgetValue = "Not instrumented";
  let budgetHelper = "This mode does not currently expose token-cost telemetry.";
  let budgetPercent: number | null = null;
  let gauges: DevelopmentGauge[] = [];
  let capabilities: DevelopmentCapability[] = [];
  let outputs: DevelopmentOutput[] = [];
  let constraints: string[] = [];

  switch (mode) {
    case "classic": {
      const cycleEvent = [...state.events].reverse().find((event) => event.event === "cycle_start");
      const currentCycle = Number(cycleEvent?.data.cycle ?? 0);
      const totalCycles = Number(cycleEvent?.data.of ?? 0);
      const safetyPassed = state.events.filter((event) => event.event === "sandbox_passed").length;
      const safetyFailed = state.events.filter((event) => event.event === "sandbox_failed").length;
      const safetyRate = ratioPercent(safetyPassed, safetyPassed + safetyFailed);

      title = "A checkpointed mutation loop trying to improve one measurable task.";
      summary = state.modeRunning.classic
        ? "The performer is benchmarking, mutating, and asking the sandbox to prove each improvement before it can land."
        : "Classic stays deliberately narrow: one benchmark surface, one fitness signal, and one sandbox gate between suggestion and change.";
      objective = state.modeRunning.classic
        ? "Find a higher-fitness mutation that beats the current performer and survives sandbox validation."
        : "Launch a safe benchmark run and establish the next mutation sequence.";
      tension = "Nothing lands unless it improves the fitness target and clears the safety gate. Speed matters less than validated improvement.";
      nextStep = state.modeRunning.classic
        ? "Watch for the next analyzer recommendation, mutation proposal, and sandbox verdict."
        : "Start the loop to turn the current benchmark surface into a live mutation program.";
      progressLabel = "Mutation cycle";
      progressValue = totalCycles > 0 ? ratioPercent(currentCycle, totalCycles) : clampPercent((state.agent?.mutation_count ?? 0) * 15);
      progressValueLabel = totalCycles > 0 ? `${currentCycle}/${totalCycles}` : `${state.agent?.mutation_count ?? 0} applied`;
      progressHelper =
        totalCycles > 0
          ? "Current position inside the active checkpointed run."
          : "Applied mutations tracked on the current performer.";
      gauges = [
        {
          label: "Fitness",
          value: clampPercent((state.agent?.fitness_score ?? 0) * 100),
          display: state.agent ? state.agent.fitness_score.toFixed(4) : "—",
          helper: "Current performer fitness score.",
          tone: toneFromPercent((state.agent?.fitness_score ?? 0) * 100),
        },
        {
          label: "Mutation depth",
          value: clampPercent((state.agent?.mutation_count ?? 0) * 20),
          display: String(state.agent?.mutation_count ?? 0),
          helper: "Accepted mutations on the active performer.",
          tone: toneFromPercent((state.agent?.mutation_count ?? 0) * 20),
        },
        {
          label: "Safety pass rate",
          value: safetyRate,
          display: safetyPassed + safetyFailed > 0 ? `${safetyPassed}/${safetyPassed + safetyFailed}` : "—",
          helper: "Sandbox outcomes across the visible trace.",
          tone: toneFromPercent(safetyRate),
        },
      ];
      capabilities = [
        {
          label: "Benchmark loop",
          state: "active",
          helper: "Performer, analyzer, and modifier cycle is available.",
        },
        {
          label: "Sandbox gate",
          state: "active",
          helper: "Every proposed mutation must validate before it lands.",
        },
        {
          label: "Rollback safety",
          state: "active",
          helper: "Checkpointing keeps the loop reversible.",
        },
        {
          label: "External tooling",
          state: "locked",
          helper: "Classic does not reach outside the benchmark surface.",
        },
      ];
      outputs = [
        {
          label: "Code surface",
          value: state.currentCode ? `${countCodeLines(state.currentCode)} lines loaded` : "Not loaded",
          helper: state.currentCode ? "Current benchmark implementation in memory." : "No code snapshot available yet.",
        },
        {
          label: "Applied mutations",
          value: String(state.agent?.mutation_count ?? 0),
          helper: "Accepted changes recorded on the performer.",
        },
        {
          label: "Last safety decision",
          value: lastClassicDecision(state),
          helper: "Most recent validation outcome from the mutation loop.",
        },
      ];
      constraints = [
        "No mutation is allowed to apply without sandbox proof.",
        "Classic optimizes a single fitness signal rather than open-ended autonomy.",
        "This loop does not expose external tools, research, or multi-agent coordination.",
      ];
      break;
    }
    case "arena": {
      const totalRounds = (state.solver?.total_wins ?? 0) + (state.solver?.total_losses ?? 0);
      const winRate = ratioPercent(state.solver?.total_wins ?? 0, totalRounds);
      const stageProgress = state.solver
        ? clampPercent((((state.solver.stage ?? 0) + (3 - (state.solver.wins_to_next_stage ?? 3)) / 3) / 4) * 100)
        : 0;

      title = "A solver climbing a challenge ladder by changing how it reasons.";
      summary = state.modeRunning.arena
        ? "The solver is trying to beat an adversarial challenger, compress its protocol, and prove it belongs at the next cognitive stage."
        : "Arena makes progression legible. It shows wins, losses, stage shifts, and protocol efficiency instead of flattening capability into one score.";
      objective = state.solver
        ? state.solver.wins_to_next_stage > 0
          ? `Win ${state.solver.wins_to_next_stage} more adjudicated rounds to reach the next stage.`
          : "Hold the top stage and keep the protocol coherent under stronger pressure."
        : "Start the arena and place the solver on the first challenge ladder.";
      tension = "The solver cannot brute-force progress. It needs consecutive wins while the challenger keeps raising difficulty and communication costs.";
      nextStep = state.modeRunning.arena
        ? "Watch the next challenge, solver attempt, and protocol compression signal."
        : "Run the arena to establish the solver's current stage and failure pattern.";
      progressLabel = "Cognitive ladder";
      progressValue = stageProgress;
      progressValueLabel = state.solver?.stage_name ?? "Ready";
      progressHelper = state.solver
        ? state.solver.wins_to_next_stage > 0
          ? `${state.solver.wins_to_next_stage} wins remain before stage-up.`
          : "Top stage reached."
        : "No solver progression recorded yet.";
      gauges = [
        {
          label: "Win rate",
          value: winRate,
          display: totalRounds > 0 ? `${state.solver?.total_wins ?? 0}/${totalRounds}` : "—",
          helper: "Adjudicated rounds won so far.",
          tone: toneFromPercent(winRate),
        },
        {
          label: "Protocol use",
          value: clampPercent((state.protocol?.utilization_rate ?? 0) * 100),
          display: state.protocol ? formatPercent(state.protocol.utilization_rate) : "—",
          helper: "How much the emergent vocabulary is carrying coordination.",
          tone: toneFromPercent((state.protocol?.utilization_rate ?? 0) * 100),
        },
        {
          label: "Vocabulary",
          value: clampPercent((state.protocol?.vocab_size ?? 0) * 10),
          display: String(state.protocol?.vocab_size ?? 0),
          helper: "Protocol tokens currently available to the pair.",
          tone: toneFromPercent((state.protocol?.vocab_size ?? 0) * 10),
        },
      ];
      capabilities = ["Reactive", "Reflective", "Strategic", "Meta-cognitive"].map((label, index) => ({
        label,
        state: (state.solver?.stage ?? -1) > index ? "active" : (state.solver?.stage ?? -1) === index ? "emerging" : "locked",
        helper:
          (state.solver?.stage ?? -1) > index
            ? "This stage has already been cleared."
            : (state.solver?.stage ?? -1) === index
              ? "Current reasoning posture under challenge pressure."
              : "Still locked behind future wins.",
      }));
      outputs = [
        {
          label: "Round record",
          value: state.solver ? `${state.solver.total_wins}W / ${state.solver.total_losses}L` : "No rounds",
          helper: "Current adjudicated arena record.",
        },
        {
          label: "Protocol tokens",
          value: String(state.protocol?.vocab_size ?? 0),
          helper: "Vocabulary currently in circulation between solver and challenger.",
        },
        {
          label: "Current stage",
          value: state.solver?.stage_name ?? "Unassigned",
          helper: "Active reasoning stage for the solver.",
        },
      ];
      constraints = [
        "Stage progression requires consecutive wins instead of total volume.",
        "The challenger can raise task difficulty even when the solver is improving.",
        "Protocol efficiency matters alongside raw task success.",
      ];
      break;
    }
    case "bootstrap": {
      const unlocked = state.bootstrapStatus?.unlocked_capabilities ?? [];
      const stableTokens = state.bootstrapProtocol?.stable_tokens ?? 0;
      const vocabSize = state.bootstrapProtocol?.vocab_size ?? 0;
      const stableRatio = ratioPercent(stableTokens, vocabSize);
      const coordination = state.bootstrapStatus?.assessment?.overall
        ? clampPercent(state.bootstrapStatus.assessment.overall)
        : clampPercent(
            average([
              (state.bootstrapStatus?.peer_a?.contribution_score ?? 0) * 100,
              (state.bootstrapStatus?.peer_b?.contribution_score ?? 0) * 100,
            ]),
          );
      const progressByRound = state.bootstrapStatus?.target_rounds
        ? ratioPercent(state.bootstrapStatus.round ?? 0, state.bootstrapStatus.target_rounds)
        : clampPercent(((state.bootstrapStatus?.stage_id ?? 0) / (BOOTSTRAP_STAGE_LABELS.length - 1)) * 100);
      const nextStage = BOOTSTRAP_STAGE_LABELS[(state.bootstrapStatus?.stage_id ?? 0) + 1] ?? null;

      title = "Two constrained peers trying to invent enough shared structure to earn power.";
      summary = state.modeRunning.bootstrap
        ? "Bootstrap is live: the peers are negotiating, producing artifacts, and asking the broker for stronger capabilities one stage at a time."
        : "Bootstrap starts with almost nothing on purpose. The point is to watch coordination, language, and tool access emerge under pressure instead of assuming them up front.";
      objective = state.bootstrapStatus?.objective ?? "Invent a shared operating language and justify the next capability unlock.";
      tension =
        unlocked.length > 0
          ? `The pair has ${unlocked.length} brokered capabilities, but the next unlock still depends on cleaner protocol and durable evidence.`
          : "The pair is still beneath the first meaningful unlock and has to prove it can coordinate with almost nothing.";
      nextStep = state.modeRunning.bootstrap
        ? "Watch for token adoption, artifact changes, and broker decisions that justify the next unlock."
        : state.bootstrapStatus?.resumable
          ? "Resume the run and inspect whether the existing protocol can support the next broker review."
          : "Start Bootstrap to watch the peers build protocol, artifacts, and capability access from zero.";
      progressLabel = "Curriculum";
      progressValue = progressByRound;
      progressValueLabel = state.bootstrapStatus?.target_rounds
        ? `${state.bootstrapStatus?.round ?? 0}/${state.bootstrapStatus.target_rounds}`
        : state.bootstrapStatus?.stage ?? "Ready";
      progressHelper = state.bootstrapStatus?.target_rounds
        ? "Current position in the staged autonomy curriculum."
        : "Current broker-reviewed stage.";
      budgetValue = buildObservedSpend(state.bootstrapStatus?.run_cost_usd, true);
      budgetHelper = "Observed run cost only. The frontend does not yet receive a hard spend cap.";
      gauges = [
        {
          label: "Stable language",
          value: stableRatio,
          display: `${stableTokens}/${vocabSize || 0}`,
          helper: "Tokens stabilized across both peers.",
          tone: toneFromPercent(stableRatio),
        },
        {
          label: "Coordination",
          value: coordination,
          display: state.bootstrapStatus?.assessment ? String(state.bootstrapStatus.assessment.overall) : `${coordination}`,
          helper: "Assessment score or peer-contribution proxy.",
          tone: toneFromPercent(coordination),
        },
        {
          label: "Capability access",
          value: clampPercent((unlocked.length / 6) * 100),
          display: `${unlocked.length} unlocked`,
          helper: "Brokered capabilities currently available.",
          tone: toneFromPercent((unlocked.length / 6) * 100),
        },
      ];
      capabilities = [
        ...unlocked.slice(0, 4).map((capability) => ({
          label: capability,
          state: "active" as const,
          helper: "Currently granted by the broker.",
        })),
        {
          label: nextStage ? `Next gate: ${nextStage}` : "Curriculum ceiling",
          state: nextStage ? ("emerging" as const) : ("active" as const),
          helper: nextStage
            ? "Further capability access depends on another clean stage review."
            : "The current stage is already at the top of the defined curriculum.",
        },
      ];
      outputs = [
        {
          label: "Artifacts captured",
          value: String(state.bootstrapArtifacts.length),
          helper: "Files retained from the bootstrap workspace.",
        },
        {
          label: "Protocol",
          value: `${stableTokens} stable / ${vocabSize} total`,
          helper: "Shared language currently present in the peer system.",
        },
        {
          label: "Promotion queue",
          value: String(state.growthPromotionQueue.length),
          helper: "Durable candidates now visible to the operator layer.",
        },
      ];
      constraints = [
        "Peers cannot bypass brokered capability review.",
        (state.bootstrapStatus?.stage_id ?? 0) < 3
          ? "Repo access and execution remain withheld until later curriculum stages."
          : "Execution is available, but stronger action still depends on broker approval.",
        (state.bootstrapStatus?.stage_id ?? 0) < 5
          ? "Outside research stays blocked until the research stage unlocks."
          : "Research is unlocked, but it still has to justify itself through durable outputs.",
      ];
      break;
    }
    case "genesis": {
      const phaseIndex = Math.max(0, GENESIS_PHASES.indexOf(state.genesisStatus?.phase ?? "RESEARCH"));
      const phaseProgress = clampPercent((phaseIndex / (GENESIS_PHASES.length - 1)) * 100);
      const assessment = state.genesisStatus?.last_assessment?.overall ?? 0;
      const iterationDepth = clampPercent((state.genesisStatus?.iteration ?? 0) * 8);
      const currentPhase = state.genesisStatus?.phase ?? "RESEARCH";

      title = "A builder rewriting its workspace while judging whether it is actually improving.";
      summary = state.modeRunning.genesis
        ? "Genesis is live: the builder is moving through research, planning, implementation, and assessment while leaving a visible artifact trail."
        : "Genesis is the clearest path to a self-constructing agent surface: tools, files, cost, and self-assessment stay inspectable instead of collapsing into one final answer.";
      objective = state.modeRunning.genesis
        ? `Continue iterating through ${currentPhase.toLowerCase()} while increasing the quality of the workspace outputs.`
        : "Launch a new build session and turn the workspace into an inspectable development trace.";
      tension = "The builder only earns credibility through tangible files, instrumented tool calls, and assessments that do not collapse under inspection.";
      nextStep = state.modeRunning.genesis
        ? "Watch for phase changes, file mutations, and assessment updates that indicate genuine forward motion."
        : "Start Genesis to see whether the builder can turn its reasoning into durable outputs.";
      progressLabel = "Build loop";
      progressValue = state.genesisStatus?.phase === "COMPLETE" ? 100 : phaseProgress;
      progressValueLabel = currentPhase;
      progressHelper = state.genesisStatus
        ? `Iteration ${state.genesisStatus.iteration} in the current autonomous session.`
        : "No autonomous build session is active.";
      budgetValue = buildObservedSpend(state.genesisStatus?.total_cost_usd, state.genesisStatus?.pricing_known);
      budgetHelper = "Observed spend only. No hard token budget has been surfaced to the frontend yet.";
      gauges = [
        {
          label: "Assessment",
          value: clampPercent(assessment),
          display: state.genesisStatus?.last_assessment ? String(assessment) : "—",
          helper: "Latest self-assessed capability score.",
          tone: toneFromPercent(assessment),
        },
        {
          label: "Workspace output",
          value: clampPercent(state.genesisFiles.length * 18),
          display: String(state.genesisFiles.length),
          helper: "Files currently present in the build workspace.",
          tone: toneFromPercent(state.genesisFiles.length * 18),
        },
        {
          label: "Iteration depth",
          value: iterationDepth,
          display: String(state.genesisStatus?.iteration ?? 0),
          helper: "Tool-driven build iterations completed so far.",
          tone: toneFromPercent(iterationDepth),
        },
      ];
      capabilities = ["Research", "Plan", "Build", "Validate", "Assess"].map((label, index) => ({
        label,
        state: phaseIndex > index ? "active" : phaseIndex === index ? "emerging" : "locked",
        helper:
          phaseIndex > index
            ? "This phase has already been crossed in the current run."
            : phaseIndex === index
              ? "Current dominant build posture."
              : "Not reached yet in the active build loop.",
      }));
      outputs = [
        {
          label: "Workspace files",
          value: String(state.genesisFiles.length),
          helper: "Durable files currently present in the sandbox workspace.",
        },
        {
          label: "Narrative stream",
          value: state.genesisNarrative ? "Live" : "Unavailable",
          helper: state.genesisNarrative ? state.genesisNarrative.slice(0, 110) : "No narrative emitted yet.",
        },
        {
          label: "Growth artifacts",
          value: String(state.growthLatest?.counts.growth_artifacts ?? 0),
          helper: "Registry-backed outputs already visible to the operator.",
        },
      ];
      constraints = [
        "Progress only counts when tool calls and file mutations leave durable evidence.",
        "The frontend currently shows observed cost rather than a remaining budget runway.",
        "Long-term autonomy still depends on outputs escaping the sandbox and entering the growth ledger.",
      ];
      break;
    }
  }

  return {
    mode,
    eyebrow: `${MODE_DEFINITIONS[mode].label} lens`,
    title,
    summary,
    objective,
    tension,
    nextStep,
    progressLabel,
    progressValue,
    progressValueLabel,
    progressHelper,
    budgetLabel,
    budgetValue,
    budgetHelper,
    budgetPercent,
    headerChips: buildHeaderChips(mode, state, changed, progressValueLabel, budgetValue),
    stateItems,
    gauges,
    capabilities,
    outputs,
    constraints,
    timeline,
    changed,
  };
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
