"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MODE_DEFINITIONS, inferModeFromEvent } from "@/lib/evolvex-format";
import {
  buildDevelopmentView,
  buildIdleBrief,
  buildInspectorSections,
  buildModeRailCards,
  buildTraceEntries,
  buildWorkbenchOverview,
  sanitizeRunCount,
} from "@/lib/evolvex-normalize";
import { getRuntimeConfig } from "@/lib/runtime";
import type {
  ArenaStatusResponse,
  BootstrapArtifactsResponse,
  BootstrapProtocolState,
  BootstrapStatus,
  ClassicStatusResponse,
  EvolutionEvent,
  GenesisFile,
  GenesisNarrativeResponse,
  GenesisScores,
  GenesisStatus,
  GrowthLatestSummary,
  GrowthPromotionCandidate,
  GrowthPromotionQueueResponse,
  GrowthRealityContractVerifyResponse,
  GrowthRunBundle,
  GrowthRunsResponse,
  ModeKey,
  ProtocolState,
  SolverState,
  WorkbenchRawState,
} from "@/lib/evolvex-types";

const EMPTY_RUNNING = {
  classic: false,
  arena: false,
  bootstrap: false,
  genesis: false,
} satisfies Record<ModeKey, boolean>;

type JsonWithError = { error?: string };

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(input, init);
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function useEvolvexDashboard() {
  const runtime = useMemo(() => getRuntimeConfig(), []);
  const [mode, setMode] = useState<ModeKey>("bootstrap");
  const [events, setEvents] = useState<EvolutionEvent[]>([]);
  const [modeRunning, setModeRunning] = useState<Record<ModeKey, boolean>>(EMPTY_RUNNING);
  const [connected, setConnected] = useState(false);
  const [operatorNotice, setOperatorNotice] = useState<string | null>(null);
  const [agent, setAgent] = useState<ClassicStatusResponse["agent"] | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [solver, setSolver] = useState<SolverState | null>(null);
  const [protocol, setProtocol] = useState<ProtocolState | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [bootstrapProtocol, setBootstrapProtocol] = useState<BootstrapProtocolState | null>(null);
  const [bootstrapArtifacts, setBootstrapArtifacts] = useState<GenesisFile[]>([]);
  const [genesisStatus, setGenesisStatus] = useState<GenesisStatus | null>(null);
  const [genesisFiles, setGenesisFiles] = useState<GenesisFile[]>([]);
  const [genesisNarrative, setGenesisNarrative] = useState<string | null>(null);
  const [growthLatest, setGrowthLatest] = useState<GrowthLatestSummary | null>(null);
  const [growthRuns, setGrowthRuns] = useState<GrowthRunsResponse["runs"]>([]);
  const [growthLatestRun, setGrowthLatestRun] = useState<GrowthRunBundle | null>(null);
  const [growthPromotionQueue, setGrowthPromotionQueue] = useState<GrowthPromotionCandidate[]>([]);
  const [growthContractRunning, setGrowthContractRunning] = useState(false);
  const [cycles, setCycles] = useState(5);
  const [arenaRounds, setArenaRounds] = useState(10);
  const [bootstrapRounds, setBootstrapRounds] = useState(12);
  const [genesisMaxIter, setGenesisMaxIter] = useState(1000);

  const setNoticeFromResponse = useCallback((payload: JsonWithError | null, fallback: string) => {
    if (!payload) {
      setOperatorNotice(fallback);
      return false;
    }
    if (payload.error) {
      setOperatorNotice(payload.error);
      return false;
    }
    setOperatorNotice(null);
    return true;
  }, []);

  const refreshClassic = useCallback(async () => {
    const data = await readJson<ClassicStatusResponse>(`${runtime.apiBase}/api/evolve/status`);
    if (!setNoticeFromResponse(data, "Could not reach classic status.")) return;
    setAgent(data?.agent ?? null);
    setCurrentCode(data?.current_code ?? null);
    setModeRunning((prev) => ({ ...prev, classic: data?.status === "running" }));
  }, [runtime.apiBase, setNoticeFromResponse]);

  const refreshArena = useCallback(async () => {
    const data = await readJson<ArenaStatusResponse>(`${runtime.apiBase}/api/arena/status`);
    if (!setNoticeFromResponse(data, "Could not reach arena status.")) return;
    setSolver(data?.solver ?? null);
    setProtocol(data?.protocol ?? null);
    setModeRunning((prev) => ({ ...prev, arena: data?.status === "running" }));
  }, [runtime.apiBase, setNoticeFromResponse]);

  const refreshBootstrap = useCallback(async () => {
    const [status, artifacts] = await Promise.all([
      readJson<BootstrapStatus>(`${runtime.apiBase}/api/bootstrap/status`),
      readJson<BootstrapArtifactsResponse>(`${runtime.apiBase}/api/bootstrap/artifacts`),
    ]);

    if (status && !status.error && status.peer_a) {
      setBootstrapStatus(status);
      setBootstrapProtocol(status.protocol ?? null);
      setModeRunning((prev) => ({ ...prev, bootstrap: status.status === "running" }));
      setOperatorNotice(null);
    } else if (status?.error) {
      setOperatorNotice(status.error);
    }

    if (artifacts?.files) setBootstrapArtifacts(artifacts.files);
  }, [runtime.apiBase]);

  const refreshGenesisStatus = useCallback(async () => {
    const data = await readJson<GenesisStatus>(`${runtime.apiBase}/api/genesis/status`);
    if (!setNoticeFromResponse(data, "Could not reach genesis status.")) return;
    setGenesisStatus(data);
    setModeRunning((prev) => ({ ...prev, genesis: Boolean(data?.running) }));
  }, [runtime.apiBase, setNoticeFromResponse]);

  const refreshGenesisWorkspace = useCallback(async () => {
    const data = await readJson<BootstrapArtifactsResponse>(`${runtime.apiBase}/api/genesis/workspace`);
    if (data?.files) setGenesisFiles(data.files);
  }, [runtime.apiBase]);

  const refreshGenesisNarrative = useCallback(async () => {
    const data = await readJson<GenesisNarrativeResponse>(`${runtime.apiBase}/api/genesis/narrative`);
    if (data?.content) setGenesisNarrative(data.content);
  }, [runtime.apiBase]);

  const refreshGrowth = useCallback(async () => {
    const [latest, runs, queue] = await Promise.all([
      readJson<GrowthLatestSummary>(`${runtime.apiBase}/api/growth/latest`),
      readJson<GrowthRunsResponse>(`${runtime.apiBase}/api/growth/runs`),
      readJson<GrowthPromotionQueueResponse>(`${runtime.apiBase}/api/growth/promotion-queue`),
    ]);

    if (latest?.counts) setGrowthLatest(latest);
    if (runs?.runs) setGrowthRuns(runs.runs);
    if (queue?.candidates) setGrowthPromotionQueue(queue.candidates);

    const latestRunId = latest?.latest_run_id ?? runs?.latest_run_id ?? null;
    if (!latestRunId) {
      setGrowthLatestRun(null);
      return;
    }

    const run = await readJson<GrowthRunBundle>(`${runtime.apiBase}/api/growth/runs/${latestRunId}`);
    if (run?.run_id) setGrowthLatestRun(run);
  }, [runtime.apiBase]);

  const appendEvent = useCallback((event: { event: string; data: Record<string, unknown> }) => {
    const parsed: EvolutionEvent = {
      ...event,
      ts: Date.now(),
      mode: inferModeFromEvent(event.event),
    };
    setEvents((prev) => [...prev.slice(-399), parsed]);
    return parsed;
  }, []);

  const post = useCallback(
    async <T extends JsonWithError>(path: string, body?: Record<string, unknown>) => {
      const payload = await readJson<T>(`${runtime.apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      setNoticeFromResponse(payload, `Request failed for ${path}.`);
      return payload;
    },
    [runtime.apiBase, setNoticeFromResponse],
  );

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(runtime.wsUrl);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        if (disposed) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      socket.onmessage = (message) => {
        const event = appendEvent(JSON.parse(message.data) as { event: string; data: Record<string, unknown> });

        if (event.event === "error" || event.event.endsWith("_error")) {
          setOperatorNotice(typeof event.data.message === "string" ? event.data.message : "A live run reported an error.");
        }

        if (event.event === "started") setModeRunning((prev) => ({ ...prev, classic: true }));
        if (event.event === "stopped") setModeRunning((prev) => ({ ...prev, classic: false }));
        if (event.event === "complete" || event.event === "applied" || event.event === "reset") {
          void refreshClassic();
        }

        if (event.event === "arena_started") setModeRunning((prev) => ({ ...prev, arena: true }));
        if (event.event === "arena_stopped") setModeRunning((prev) => ({ ...prev, arena: false }));
        if (
          [
            "arena_win",
            "arena_loss",
            "arena_stage_up",
            "arena_protocol_entry",
            "arena_protocol_used",
            "arena_protocol_consolidate",
            "arena_protocol_snapshot",
            "arena_complete",
            "arena_reset",
          ].includes(event.event)
        ) {
          void refreshArena();
        }

        if (event.event === "bootstrap_started") setModeRunning((prev) => ({ ...prev, bootstrap: true }));
        if (event.event === "bootstrap_stopped" || event.event === "bootstrap_complete") {
          setModeRunning((prev) => ({ ...prev, bootstrap: false }));
        }
        if (event.event.startsWith("bootstrap_")) {
          void refreshBootstrap();
        }

        if (event.event === "genesis_started") setModeRunning((prev) => ({ ...prev, genesis: true }));
        if (event.event === "genesis_started") {
          void refreshGenesisStatus();
          void refreshGenesisWorkspace();
          void refreshGenesisNarrative();
        }
        if (["genesis_stopped", "genesis_complete", "genesis_error"].includes(event.event)) {
          setModeRunning((prev) => ({ ...prev, genesis: false }));
          void refreshGenesisStatus();
        }
        if (event.event.startsWith("genesis_")) {
          setGenesisStatus((prev) => {
            const next: GenesisStatus = {
              running: prev?.running ?? false,
              phase: prev?.phase ?? "RESEARCH",
              iteration: prev?.iteration ?? 0,
              total_cost_usd: prev?.total_cost_usd ?? 0,
              pricing_known: prev?.pricing_known ?? true,
              files_created: prev?.files_created ?? [],
              last_assessment: prev?.last_assessment ?? null,
            };

            if (event.event === "genesis_started") next.running = true;
            if (event.event === "genesis_phase_change") next.phase = (event.data.new_phase as string) ?? next.phase;
            if (event.event === "genesis_tool_call") next.iteration = (event.data.iteration as number) ?? next.iteration;
            if (event.event === "genesis_token_usage") {
              next.total_cost_usd = (event.data.total_cost_usd as number) ?? next.total_cost_usd;
              next.pricing_known = (event.data.pricing_known as boolean) ?? next.pricing_known;
            }
            if (event.event === "genesis_assessment") next.last_assessment = (event.data.scores as GenesisScores) ?? next.last_assessment;
            if (event.event === "genesis_file_changed") {
              const path = event.data.path as string;
              if (path && !next.files_created.includes(path)) next.files_created = [...next.files_created, path];
            }
            if (event.event === "genesis_complete") {
              next.running = false;
              next.phase = "COMPLETE";
              next.files_created = (event.data.files_created as string[]) ?? next.files_created;
              next.last_assessment = (event.data.final_assessment as GenesisScores) ?? next.last_assessment;
            }
            if (event.event === "genesis_stopped" || event.event === "genesis_error") next.running = false;

            return next;
          });

          if (event.event === "genesis_file_changed" || event.event === "genesis_complete" || event.event === "genesis_reset") {
            void refreshGenesisWorkspace();
          }
          if (event.event === "genesis_narrative") {
            setGenesisNarrative((event.data.text as string) ?? null);
          }
          if (["genesis_complete", "genesis_growth_recorded", "genesis_reset", "growth_contract_verified"].includes(event.event)) {
            void refreshGrowth();
          }
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [appendEvent, refreshArena, refreshBootstrap, refreshClassic, refreshGenesisNarrative, refreshGenesisStatus, refreshGenesisWorkspace, refreshGrowth, runtime.wsUrl]);

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        refreshClassic(),
        refreshArena(),
        refreshBootstrap(),
        refreshGenesisStatus(),
        refreshGenesisWorkspace(),
        refreshGenesisNarrative(),
        refreshGrowth(),
      ]);
    };

    void load();
  }, [refreshArena, refreshBootstrap, refreshClassic, refreshGenesisNarrative, refreshGenesisStatus, refreshGenesisWorkspace, refreshGrowth]);

  const clearEvents = useCallback(() => setEvents([]), []);

  const startClassic = useCallback(async () => {
    const nextCycles = sanitizeRunCount(cycles, 1, 20);
    if (nextCycles !== cycles) setCycles(nextCycles);

    const payload = await post<ClassicStatusResponse>("/api/evolve/start", { cycles: nextCycles });
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, classic: true }));
      setTimeout(() => {
        void refreshClassic();
      }, 350);
    }
  }, [cycles, post, refreshClassic]);

  const stopClassic = useCallback(async () => {
    const payload = await post("/api/evolve/stop");
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, classic: false }));
      setTimeout(() => {
        void refreshClassic();
      }, 350);
    }
  }, [post, refreshClassic]);

  const resetClassic = useCallback(async () => {
    const payload = await post("/api/evolve/reset");
    if (payload && !payload.error) {
      setAgent(null);
      setCurrentCode(null);
      setEvents((prev) => prev.filter((event) => event.mode !== "classic"));
      void refreshClassic();
    }
  }, [post, refreshClassic]);

  const startArena = useCallback(async () => {
    const nextRounds = sanitizeRunCount(arenaRounds, 1, 50);
    if (nextRounds !== arenaRounds) setArenaRounds(nextRounds);

    const payload = await post("/api/arena/start", { rounds: nextRounds });
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, arena: true }));
      setTimeout(() => {
        void refreshArena();
      }, 350);
    }
  }, [arenaRounds, post, refreshArena]);

  const stopArena = useCallback(async () => {
    const payload = await post("/api/arena/stop");
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, arena: false }));
      setTimeout(() => {
        void refreshArena();
      }, 350);
    }
  }, [post, refreshArena]);

  const resetArena = useCallback(async () => {
    const payload = await post("/api/arena/reset");
    if (payload && !payload.error) {
      setSolver(null);
      setProtocol(null);
      setEvents((prev) => prev.filter((event) => event.mode !== "arena"));
      void refreshArena();
    }
  }, [post, refreshArena]);

  const startBootstrap = useCallback(async () => {
    const nextRounds = sanitizeRunCount(bootstrapRounds, 1, 50);
    if (nextRounds !== bootstrapRounds) setBootstrapRounds(nextRounds);

    const payload = await post("/api/bootstrap/start", { rounds: nextRounds });
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, bootstrap: true }));
      setTimeout(() => {
        void refreshBootstrap();
      }, 350);
    }
  }, [bootstrapRounds, post, refreshBootstrap]);

  const stopBootstrap = useCallback(async () => {
    const payload = await post("/api/bootstrap/stop");
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, bootstrap: false }));
      setTimeout(() => {
        void refreshBootstrap();
      }, 350);
    }
  }, [post, refreshBootstrap]);

  const resetBootstrap = useCallback(async () => {
    const payload = await post("/api/bootstrap/reset");
    if (payload && !payload.error) {
      setBootstrapStatus(null);
      setBootstrapProtocol(null);
      setBootstrapArtifacts([]);
      setEvents((prev) => prev.filter((event) => event.mode !== "bootstrap"));
      void refreshBootstrap();
    }
  }, [post, refreshBootstrap]);

  const startGenesis = useCallback(async () => {
    const nextMaxIterations = sanitizeRunCount(genesisMaxIter, 10, 2000);
    if (nextMaxIterations !== genesisMaxIter) setGenesisMaxIter(nextMaxIterations);

    const payload = await post("/api/genesis/start", { max_iterations: nextMaxIterations });
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, genesis: true }));
      setGenesisStatus((prev) =>
        prev
          ? { ...prev, running: true }
          : {
              running: true,
              phase: "RESEARCH",
              iteration: 0,
              total_cost_usd: 0,
              pricing_known: true,
              files_created: [],
              last_assessment: null,
            },
      );
      setTimeout(() => {
        void refreshGenesisStatus();
        void refreshGenesisWorkspace();
        void refreshGenesisNarrative();
      }, 350);
    }
  }, [genesisMaxIter, post, refreshGenesisNarrative, refreshGenesisStatus, refreshGenesisWorkspace]);

  const stopGenesis = useCallback(async () => {
    const payload = await post("/api/genesis/stop");
    if (payload && !payload.error) {
      setModeRunning((prev) => ({ ...prev, genesis: false }));
      setTimeout(() => {
        void refreshGenesisStatus();
        void refreshGenesisWorkspace();
        void refreshGenesisNarrative();
      }, 350);
    }
  }, [post, refreshGenesisNarrative, refreshGenesisStatus, refreshGenesisWorkspace]);

  const resetGenesis = useCallback(async () => {
    const payload = await post("/api/genesis/reset");
    if (payload && !payload.error) {
      setGenesisStatus(null);
      setGenesisFiles([]);
      setGenesisNarrative(null);
      setEvents((prev) => prev.filter((event) => event.mode !== "genesis"));
      void refreshGenesisStatus();
      void refreshGenesisWorkspace();
    }
  }, [post, refreshGenesisStatus, refreshGenesisWorkspace]);

  const verifyRealityContract = useCallback(async () => {
    setGrowthContractRunning(true);
    const payload = await post<GrowthRealityContractVerifyResponse>("/api/growth/reality-contract/verify", {
      run_id: growthLatest?.latest_run_id ?? growthRuns[0]?.run_id ?? null,
      replace_existing_claims: true,
    });
    setGrowthContractRunning(false);

    if (payload && !payload.error) {
      setOperatorNotice(`Truth gate refreshed: ${payload.landed}/${payload.total} landed, ${payload.unsupported} unsupported.`);
      void refreshGrowth();
    }
  }, [growthLatest?.latest_run_id, growthRuns, post, refreshGrowth]);

  const rawState: WorkbenchRawState = useMemo(
    () => ({
      connected,
      events,
      modeRunning,
      agent: agent ?? null,
      solver,
      protocol,
      bootstrapStatus,
      bootstrapProtocol,
      bootstrapArtifacts,
      genesisStatus,
      genesisFiles,
      genesisNarrative,
      growthLatest,
      growthRuns,
      growthLatestRun,
      growthPromotionQueue,
      currentCode,
    }),
    [
      agent,
      bootstrapArtifacts,
      bootstrapProtocol,
      bootstrapStatus,
      connected,
      currentCode,
      events,
      genesisFiles,
      genesisNarrative,
      genesisStatus,
      growthLatest,
      growthLatestRun,
      growthPromotionQueue,
      growthRuns,
      modeRunning,
      protocol,
      solver,
    ],
  );

  const overview = useMemo(() => buildWorkbenchOverview(rawState), [rawState]);
  const modeCards = useMemo(() => buildModeRailCards(rawState), [rawState]);
  const developmentView = useMemo(() => buildDevelopmentView(mode, rawState), [mode, rawState]);
  const inspectorSections = useMemo(() => buildInspectorSections(mode, rawState), [mode, rawState]);
  const currentTrace = useMemo(() => buildTraceEntries(events, mode, 36), [events, mode]);
  const allTrace = useMemo(() => buildTraceEntries(events, "all", 120), [events]);
  const activeDefinition = MODE_DEFINITIONS[mode];
  const idleBrief = useMemo(() => buildIdleBrief(mode), [mode]);
  const bootstrapPeers = useMemo(
    () => [bootstrapStatus?.peer_a, bootstrapStatus?.peer_b].filter(Boolean) as NonNullable<BootstrapStatus["peer_a"]>[],
    [bootstrapStatus],
  );

  return {
    mode,
    setMode,
    runtime,
    operatorNotice,
    dismissNotice: () => setOperatorNotice(null),
    controls: {
      cycles,
      setCycles,
      arenaRounds,
      setArenaRounds,
      bootstrapRounds,
      setBootstrapRounds,
      genesisMaxIter,
      setGenesisMaxIter,
    },
    actions: {
      clearEvents,
      startClassic,
      stopClassic,
      resetClassic,
      startArena,
      stopArena,
      resetArena,
      startBootstrap,
      stopBootstrap,
      resetBootstrap,
      startGenesis,
      stopGenesis,
      resetGenesis,
      verifyRealityContract,
    },
    derived: {
      activeDefinition,
      idleBrief,
      overview,
      modeCards,
      developmentView,
      inspectorSections,
      currentTrace,
      allTrace,
    },
    data: {
      connected,
      events,
      modeRunning,
      agent: agent ?? null,
      solver,
      protocol,
      bootstrapStatus,
      bootstrapProtocol,
      bootstrapArtifacts,
      bootstrapPeers,
      genesisStatus,
      genesisFiles,
      genesisNarrative,
      growthLatest,
      growthRuns,
      growthLatestRun,
      growthPromotionQueue,
      growthContractRunning,
      currentCode,
    },
  };
}

export type EvolvexDashboardController = ReturnType<typeof useEvolvexDashboard>;
