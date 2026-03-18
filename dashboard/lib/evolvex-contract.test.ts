import { describe, expect, it } from "vitest";

import { formatEventSummary, inferModeFromEvent } from "./evolvex-format";
import { buildModeRailCards, buildWorkbenchOverview, sanitizeRunCount } from "./evolvex-normalize";
import { resolveApiBase, resolveWsUrl } from "./runtime";
import type {
  BootstrapProtocolState,
  BootstrapStatus,
  EvolutionEvent,
  GenesisFile,
  GenesisStatus,
  ProtocolState,
  SolverState,
  WorkbenchRawState,
} from "./evolvex-types";

function makeEvent(event: string, data: Record<string, unknown>, ts: number): EvolutionEvent {
  return {
    event,
    data,
    ts,
    mode: inferModeFromEvent(event),
  };
}

function makeState(overrides: Partial<WorkbenchRawState> = {}): WorkbenchRawState {
  const protocol: ProtocolState = {
    vocabulary: [],
    vocab_size: 7,
    utilization_rate: 0.42,
    round_history: [{ round: 1, compression_ratio: 0.42, vocab_size: 7 }],
  };

  const bootstrapProtocol: BootstrapProtocolState = {
    vocabulary: [],
    vocab_size: 4,
    stable_tokens: 2,
    utilization_rate: 0.65,
    round_history: [{ round: 3, compression_ratio: 0.35, vocab_size: 4, stable_tokens: 2 }],
  };

  const bootstrapStatus: BootstrapStatus = {
    status: "running",
    stage: "Negotiation",
    stage_id: 2,
    round: 3,
    target_rounds: 8,
    objective: "Invent a shared operating language",
    unlocked_capabilities: ["scratchpad", "files"],
    assessment: null,
    resumable: true,
    completed: false,
    peer_a: {
      name: "Peer A",
      generation: 4,
      fitness_score: 0.84,
      mutation_count: 2,
      message_count: 8,
      accepted_proposals: 2,
      rejected_proposals: 1,
      contribution_score: 0.78,
      dependency_score: 0.32,
      total_cost_usd: 0.031,
      cached_prompt_tokens: 120,
      pricing_known: true,
    },
    peer_b: {
      name: "Peer B",
      generation: 5,
      fitness_score: 0.87,
      mutation_count: 3,
      message_count: 9,
      accepted_proposals: 3,
      rejected_proposals: 1,
      contribution_score: 0.81,
      dependency_score: 0.29,
      total_cost_usd: 0.034,
      cached_prompt_tokens: 80,
      pricing_known: true,
    },
    protocol: bootstrapProtocol,
    artifacts: [],
    run_cost_usd: 0.12,
  };

  const solver: SolverState = {
    name: "Solver",
    stage: 2,
    stage_name: "Strategic",
    consecutive_wins: 1,
    total_wins: 5,
    total_losses: 2,
    wins_to_next_stage: 2,
    generation: 7,
  };

  const genesisFiles: GenesisFile[] = [
    { path: "BUILD_LOG.md", size_bytes: 1024 },
    { path: "src/agent.py", size_bytes: 2048 },
  ];

  const genesisStatus: GenesisStatus = {
    running: false,
    phase: "BUILD",
    iteration: 5,
    total_cost_usd: 1.234,
    pricing_known: true,
    files_created: genesisFiles.map((file) => file.path),
    last_assessment: {
      reasoning: 82,
      tool_use: 79,
      error_handling: 74,
      self_improvement: 77,
      overall: 78,
    },
  };

  return {
    connected: true,
    events: [
      makeEvent("sandbox_passed", { proposed_fitness: 0.92 }, 1),
      makeEvent("sandbox_failed", { error: "timeout" }, 2),
      makeEvent(
        "genesis_tool_result",
        { tool: "write_file", success: true, duration_ms: 132, output_preview: "Created BUILD_LOG.md" },
        3,
      ),
    ],
    modeRunning: {
      classic: false,
      arena: true,
      bootstrap: true,
      genesis: false,
    },
    agent: {
      name: "Performer",
      generation: 6,
      fitness_score: 0.91,
      mutation_count: 4,
    },
    solver,
    protocol,
    bootstrapStatus,
    bootstrapProtocol,
    bootstrapArtifacts: [{ path: "workspace/protocol.md", size_bytes: 512 }],
    genesisStatus,
    genesisFiles,
    genesisNarrative: "Recent build log",
    growthLatest: {
      latest_run_id: "2026-03-18-validated-rerun",
      counts: {
        frontier_signals: 4,
        growth_artifacts: 3,
        claim_checks: 3,
        promotion_candidates: 3,
      },
      latest_statuses: {
        growth_artifacts: { validated: 2, queued: 1 },
        claim_checks: { landed: 2, unsupported: 1 },
        promotion_candidates: { active: 1, candidate: 1, queued: 1 },
      },
      top_candidate: {
        title: "Verified Growth Registry",
        artifact_id: "artifact-growth-registry-plan",
        promotion_state: "active",
        public_safe_as_is: true,
      },
      updated_at: "2026-03-18T15:16:52Z",
    },
    growthRuns: [
      {
        run_id: "2026-03-18-validated-rerun",
        counts: {
          frontier_signals: 4,
          growth_artifacts: 3,
          claim_checks: 3,
          promotion_candidates: 3,
        },
        latest_statuses: {
          growth_artifacts: { validated: 2, queued: 1 },
          claim_checks: { landed: 2, unsupported: 1 },
          promotion_candidates: { active: 1, candidate: 1, queued: 1 },
        },
        top_candidate: {
          title: "Verified Growth Registry",
          artifact_id: "artifact-growth-registry-plan",
          promotion_state: "active",
          public_safe_as_is: true,
        },
        updated_at: "2026-03-18T15:16:52Z",
      },
    ],
    growthLatestRun: null,
    growthPromotionQueue: [
      {
        id: "promotion-growth-registry",
        run_id: "2026-03-18-validated-rerun",
        title: "Verified Growth Registry",
        artifact_id: "artifact-growth-registry-plan",
        why_it_matters: "Durable growth substrate",
        evidence: "validated rerun",
        public_safe_as_is: true,
        required_scrub: "none",
        promotion_state: "active",
        artifact_path: "ops/nightly/artifacts/2026-03-18_PRIMARY_BUILD_PLAN.md",
        artifact_status: "validated",
        artifact_type: "implementation-plan",
      },
    ],
    currentCode: "def benchmark(): pass",
    ...overrides,
  };
}

describe("runtime helpers", () => {
  it("resolves local and remote API bases", () => {
    expect(resolveApiBase("localhost")).toBe("http://localhost:8000");
    expect(resolveApiBase("127.0.0.1")).toBe("http://127.0.0.1:8000");
    expect(resolveApiBase("192.168.1.44")).toBe("http://192.168.1.44:8000");
    expect(resolveApiBase("lab.local")).toBe("http://lab.local:8000");
    expect(resolveApiBase("demo.evolvex.ai")).toBe("https://evolvex-api.pacslate.com");
    expect(resolveApiBase("demo.evolvex.ai", "https://custom.example")).toBe("https://custom.example");
  });

  it("derives websocket URLs from hostname or explicit override", () => {
    expect(resolveWsUrl({ hostname: "localhost" })).toBe("ws://localhost:8000/ws/evolution");
    expect(resolveWsUrl({ hostname: "192.168.1.44" })).toBe("ws://192.168.1.44:8000/ws/evolution");
    expect(resolveWsUrl({ hostname: "evolvex.pacslate.com" })).toBe("wss://evolvex-api.pacslate.com/ws/evolution");
    expect(resolveWsUrl({ hostname: "localhost", envWsUrl: "wss://socket.example/ws" })).toBe("wss://socket.example/ws");
  });
});

describe("event formatting", () => {
  it("maps shared and namespaced events to the right mode", () => {
    expect(inferModeFromEvent("complete")).toBe("classic");
    expect(inferModeFromEvent("arena_win")).toBe("arena");
    expect(inferModeFromEvent("bootstrap_tool_executed")).toBe("bootstrap");
    expect(inferModeFromEvent("genesis_phase_change")).toBe("genesis");
  });

  it("formats trace summaries without exposing raw JSON", () => {
    expect(
      formatEventSummary("genesis_tool_result", {
        tool: "write_file",
        success: true,
        duration_ms: 132,
        output_preview: "Created BUILD_LOG.md",
      }),
    ).toContain("write_file");

    expect(
      formatEventSummary("bootstrap_protocol_proposed", {
        peer: "Peer A",
        token: "zx",
        meaning: "request critique",
      }),
    ).toContain("Peer A proposed zx");
  });

  it("formats percentage-based and assessment events correctly", () => {
    expect(
      formatEventSummary("arena_complete", {
        win_rate: 0.71,
      }),
    ).toContain("71.0%");

    const summary = formatEventSummary("bootstrap_assessment", {
      source: "system",
      assessment: {
        overall: 84,
        autonomy: 77,
      },
    });

    expect(summary).toContain("overall 84");
    expect(summary).not.toContain("{");
  });
});

describe("overview normalization", () => {
  it("builds top-level workbench metrics from raw mode state", () => {
    const overview = buildWorkbenchOverview(makeState());

    expect(overview.activeModeCount).toBe(2);
    expect(overview.protocolTokenCount).toBe(11);
    expect(overview.artifactCount).toBe(6);
    expect(overview.safetyChecks).toBe(2);
    expect(overview.lastTrace?.mode).toBe("genesis");
    expect(overview.metrics.find((metric) => metric.label === "Durable Runs")?.value).toBe("1");
    expect(overview.metrics.find((metric) => metric.label === "Promotion Queue")?.value).toBe("1");
  });

  it("builds mode rail cards with normalized status labels", () => {
    const cards = buildModeRailCards(makeState());

    expect(cards.find((card) => card.key === "bootstrap")).toMatchObject({
      isRunning: true,
      statusLabel: "Round 3 of 8",
      evidenceLabel: "2 stable / 4 total tokens",
    });

    expect(cards.find((card) => card.key === "genesis")).toMatchObject({
      isRunning: false,
      statusLabel: "Phase: BUILD",
      evidenceLabel: "2 workspace files",
    });
  });

  it("sanitizes operator-provided run counts into valid ranges", () => {
    expect(sanitizeRunCount("", 1, 20)).toBe(1);
    expect(sanitizeRunCount(-5, 1, 20)).toBe(1);
    expect(sanitizeRunCount(999, 1, 20)).toBe(20);
    expect(sanitizeRunCount(8, 1, 20)).toBe(8);
  });
});
