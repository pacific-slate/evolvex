"use client";

import { useEffect, useRef, useState } from "react";

type EvolutionEvent = {
  event: string;
  data: Record<string, unknown>;
  ts: number;
};

type AgentState = {
  name: string;
  generation: number;
  fitness_score: number;
  mutation_count: number;
};

type SolverState = {
  name: string;
  stage: number;
  stage_name: string;
  consecutive_wins: number;
  total_wins: number;
  total_losses: number;
  wins_to_next_stage: number;
  generation: number;
};

type ProtocolEntry = {
  token: string;
  meaning: string;
  proposed_by: "solver" | "challenger";
  round_created: number;
  usage_count: number;
};

type ProtocolState = {
  vocabulary: ProtocolEntry[];
  vocab_size: number;
  utilization_rate: number;
  round_history: { round: number; compression_ratio: number; vocab_size: number }[];
};

type BootstrapPeerState = {
  name: string;
  generation: number;
  fitness_score: number;
  mutation_count: number;
  message_count: number;
  accepted_proposals: number;
  rejected_proposals: number;
  contribution_score: number;
  dependency_score: number;
  total_cost_usd: number;
};

type BootstrapProtocolEntry = {
  token: string;
  meaning: string;
  proposed_by: string;
  accepted_by: string | null;
  state: "pending" | "adopted" | "stable";
  round_created: number;
  usage_count: number;
  first_used_round: number | null;
  stable_round: number | null;
};

type BootstrapProtocolState = {
  vocabulary: BootstrapProtocolEntry[];
  vocab_size: number;
  stable_tokens: number;
  utilization_rate: number;
  round_history: {
    round: number;
    compression_ratio: number;
    vocab_size: number;
    stable_tokens: number;
  }[];
};

type BootstrapAssessment = {
  stage: string;
  collaboration: number;
  language: number;
  traceability: number;
  autonomy: number;
  overall: number;
};

type BootstrapStatus = {
  status: string;
  stage: string;
  stage_id: number;
  round: number;
  objective: string;
  unlocked_capabilities: string[];
  assessment: BootstrapAssessment | null;
  peer_a: BootstrapPeerState;
  peer_b: BootstrapPeerState;
  protocol: BootstrapProtocolState;
  artifacts: GenesisFile[];
  run_cost_usd: number;
};

type GenesisScores = {
  reasoning: number;
  tool_use: number;
  error_handling: number;
  self_improvement: number;
  overall: number;
};

type GenesisFile = { path: string; size_bytes: number };

type GenesisStatus = {
  running: boolean;
  phase: string;
  iteration: number;
  total_cost_usd: number;
  pricing_known?: boolean;
  files_created: string[];
  last_assessment: GenesisScores | null;
};

const IS_REMOTE = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API = IS_REMOTE ? "https://evolvex-api.pacslate.com" : "http://localhost:8000";
const WS_URL = IS_REMOTE ? "wss://evolvex-api.pacslate.com/ws/evolution" : "ws://localhost:8000/ws/evolution";
const STAGE_LABELS = ["Reactive", "Reflective", "Strategic", "Meta-cognitive"];

const EVENT_COLORS: Record<string, string> = {
  // Classic mode
  started: "text-blue-400",
  cycle_start: "text-slate-400",
  benchmark: "text-cyan-400",
  analysis: "text-yellow-400",
  checkpoint: "text-slate-500",
  mutation_proposed: "text-purple-400",
  sandbox_passed: "text-green-400",
  sandbox_failed: "text-red-400",
  applied: "text-emerald-400",
  discarded: "text-slate-500",
  rollback: "text-orange-400",
  complete: "text-green-300",
  error: "text-red-500",
  // Genesis mode
  genesis_started: "text-orange-400",
  genesis_thinking: "text-amber-300",
  genesis_tool_call: "text-cyan-400",
  genesis_tool_result: "text-teal-400",
  genesis_file_changed: "text-blue-400",
  genesis_assessment: "text-emerald-400",
  genesis_phase_change: "text-purple-400",
  genesis_narrative: "text-slate-500",
  genesis_token_usage: "text-slate-500",
  genesis_complete: "text-green-300",
  genesis_stopped: "text-slate-500",
  genesis_reset: "text-slate-600",
  genesis_error: "text-red-500",
  // Arena mode
  arena_started: "text-violet-400",
  arena_round_start: "text-slate-400",
  arena_challenge: "text-yellow-300",
  arena_solver_attempt: "text-purple-400",
  arena_win: "text-emerald-400",
  arena_loss: "text-red-400",
  arena_stage_up: "text-amber-300",
  arena_difficulty_up: "text-orange-400",
  arena_complete: "text-green-300",
  arena_stopped: "text-slate-500",
  arena_reset: "text-slate-600",
  // Bootstrap mode
  bootstrap_started: "text-sky-300",
  bootstrap_resumed: "text-cyan-300",
  bootstrap_round_start: "text-slate-400",
  bootstrap_objective: "text-cyan-300",
  bootstrap_peer_message: "text-blue-300",
  bootstrap_protocol_proposed: "text-violet-300",
  bootstrap_protocol_adopted: "text-emerald-300",
  bootstrap_protocol_pruned: "text-slate-500",
  bootstrap_tool_requested: "text-amber-300",
  bootstrap_tool_executed: "text-emerald-400",
  bootstrap_tool_rejected: "text-red-400",
  bootstrap_artifact_changed: "text-sky-400",
  bootstrap_stage_up: "text-yellow-300",
  bootstrap_injection: "text-orange-300",
  bootstrap_assessment: "text-teal-300",
  bootstrap_complete: "text-green-300",
  bootstrap_stopped: "text-slate-500",
  bootstrap_reset: "text-slate-600",
  bootstrap_error: "text-red-500",
  // Protocol events
  arena_protocol_entry: "text-cyan-300",
  arena_protocol_used: "text-teal-400",
  arena_protocol_consolidate: "text-amber-400",
  arena_protocol_snapshot: "text-slate-500",
};

/** Inline SVG sparkline for compression ratio history */
function CompressionSparkline({ history }: { history: { compression_ratio: number }[] }) {
  if (history.length < 2) {
    return <span className="text-slate-600 text-xs">—</span>;
  }
  const W = 80;
  const H = 24;
  const pad = 2;
  const pts = history.slice(-20);
  const minV = Math.min(...pts.map((p) => p.compression_ratio));
  const maxV = Math.max(...pts.map((p) => p.compression_ratio), minV + 0.01);
  const points = pts
    .map((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (W - pad * 2);
      const y = pad + ((maxV - p.compression_ratio) / (maxV - minV)) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} className="inline-block">
      <polyline points={points} fill="none" stroke="#2dd4bf" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Color for a compression ratio value: 1.0=slate, <0.3=emerald */
function compressionColor(ratio: number): string {
  if (ratio <= 0.3) return "text-emerald-400";
  if (ratio <= 0.5) return "text-teal-400";
  if (ratio <= 0.7) return "text-yellow-400";
  return "text-slate-400";
}

export default function Home() {
  const [mode, setMode] = useState<"classic" | "arena" | "bootstrap" | "genesis">("classic");
  const [events, setEvents] = useState<EvolutionEvent[]>([]);
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [solver, setSolver] = useState<SolverState | null>(null);
  const [protocol, setProtocol] = useState<ProtocolState | null>(null);
  const [running, setRunning] = useState(false);
  const [arenaRunning, setArenaRunning] = useState(false);
  const [bootstrapRunning, setBootstrapRunning] = useState(false);
  const [bootstrapRounds, setBootstrapRounds] = useState(12);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [bootstrapProtocol, setBootstrapProtocol] = useState<BootstrapProtocolState | null>(null);
  const [bootstrapArtifacts, setBootstrapArtifacts] = useState<GenesisFile[]>([]);
  const [cycles, setCycles] = useState(5);
  const [arenaRounds, setArenaRounds] = useState(10);
  const [connected, setConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Genesis state
  const [genesisRunning, setGenesisRunning] = useState(false);
  const [genesisStatus, setGenesisStatus] = useState<GenesisStatus | null>(null);
  const [genesisFiles, setGenesisFiles] = useState<GenesisFile[]>([]);
  const [genesisNarrative, setGenesisNarrative] = useState<string | null>(null);
  const [genesisMaxIter, setGenesisMaxIter] = useState(1000);

  useEffect(() => {
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
      };
      ws.onmessage = (msg) => {
        const ev: EvolutionEvent = { ...JSON.parse(msg.data), ts: Date.now() };
        setEvents((prev) => [...prev.slice(-200), ev]);

        // Classic mode state
        if (ev.event === "complete") {
          setAgent(ev.data as AgentState);
          setRunning(false);
        }
        if (ev.event === "started") setRunning(true);
        if (ev.event === "stopped") setRunning(false);

        // Arena mode state
        if (ev.event === "arena_complete") {
          setSolver(ev.data as SolverState);
          setArenaRunning(false);
        }
        if (ev.event === "arena_started") setArenaRunning(true);
        if (ev.event === "arena_stopped") setArenaRunning(false);
        if (ev.event === "arena_win" || ev.event === "arena_stage_up" || ev.event === "arena_loss") {
          fetch(`${API}/api/arena/status`)
            .then((r) => r.json())
            .then((d) => {
              if (d.solver) setSolver(d.solver);
              if (d.protocol) setProtocol(d.protocol as ProtocolState);
            })
            .catch(() => null);
        }

        // Protocol events — update protocol state inline
        if (
          ev.event === "arena_protocol_entry" ||
          ev.event === "arena_protocol_consolidate" ||
          ev.event === "arena_protocol_used" ||
          ev.event === "arena_protocol_snapshot"
        ) {
          fetch(`${API}/api/arena/protocol`)
            .then((r) => r.json())
            .then((d) => setProtocol(d as ProtocolState))
            .catch(() => null);
        }

        // Bootstrap mode state
        if (ev.event === "bootstrap_started") setBootstrapRunning(true);
        if (ev.event === "bootstrap_stopped" || ev.event === "bootstrap_complete") setBootstrapRunning(false);
        if (ev.event.startsWith("bootstrap_")) {
          fetch(`${API}/api/bootstrap/status`)
            .then((r) => r.json())
            .then((d) => {
              if (!d.error) setBootstrapStatus(d as BootstrapStatus);
            })
            .catch(() => null);
          fetch(`${API}/api/bootstrap/protocol`)
            .then((r) => r.json())
            .then((d) => setBootstrapProtocol(d as BootstrapProtocolState))
            .catch(() => null);
          fetch(`${API}/api/bootstrap/artifacts`)
            .then((r) => r.json())
            .then((d) => setBootstrapArtifacts((d.files ?? []) as GenesisFile[]))
            .catch(() => null);
        }

        // Genesis mode state
        if (ev.event === "genesis_started") setGenesisRunning(true);
        if (ev.event === "genesis_stopped" || ev.event === "genesis_complete" || ev.event === "genesis_error") {
          setGenesisRunning(false);
        }
        if (ev.event.startsWith("genesis_")) {
          // Update status from the event data
          setGenesisStatus((prev) => {
            const next = { ...(prev ?? { running: false, phase: "RESEARCH", iteration: 0, total_cost_usd: 0, pricing_known: true, files_created: [], last_assessment: null }) };
            if (ev.event === "genesis_phase_change") next.phase = (ev.data.new_phase as string) ?? next.phase;
            if (ev.event === "genesis_tool_call") next.iteration = (ev.data.iteration as number) ?? next.iteration;
            if (ev.event === "genesis_token_usage") next.total_cost_usd = (ev.data.total_cost_usd as number) ?? next.total_cost_usd;
            if (ev.event === "genesis_token_usage") next.pricing_known = (ev.data.pricing_known as boolean) ?? next.pricing_known;
            if (ev.event === "genesis_assessment") next.last_assessment = ev.data.scores as GenesisScores;
            if (ev.event === "genesis_file_changed") {
              const path = ev.data.path as string;
              if (path && !next.files_created.includes(path)) next.files_created = [...next.files_created, path];
            }
            if (ev.event === "genesis_complete") {
              next.files_created = (ev.data.files_created as string[]) ?? next.files_created;
              next.phase = "COMPLETE";
            }
            return next;
          });
          // Refresh workspace file list on file changes
          if (ev.event === "genesis_file_changed" || ev.event === "genesis_complete") {
            fetch(`${API}/api/genesis/workspace`).then((r) => r.json()).then((d) => setGenesisFiles(d.files ?? [])).catch(() => null);
          }
          // Update narrative when BUILD_LOG changes
          if (ev.event === "genesis_narrative") {
            setGenesisNarrative(ev.data.text as string);
          }
        }
      };
    };
    connect();
    return () => ws?.close();
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/evolve/status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/arena/status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/bootstrap/status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/bootstrap/artifacts`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/genesis/status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/genesis/workspace`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/genesis/narrative`).then((r) => r.json()).catch(() => null),
    ]).then(([classic, arena, bootstrap, bootstrapFiles, genesis, workspace, narrative]) => {
      if (classic?.agent) setAgent(classic.agent);
      if (classic?.status === "running") setRunning(true);
      if (arena?.solver) setSolver(arena.solver);
      if (arena?.protocol) setProtocol(arena.protocol as ProtocolState);
      if (arena?.status === "running") setArenaRunning(true);
      if (bootstrap && !bootstrap.error && bootstrap.peer_a) {
        setBootstrapStatus(bootstrap as BootstrapStatus);
        setBootstrapProtocol((bootstrap.protocol ?? null) as BootstrapProtocolState | null);
        if (bootstrap.status === "running") setBootstrapRunning(true);
      }
      if (bootstrapFiles?.files) setBootstrapArtifacts(bootstrapFiles.files as GenesisFile[]);
      if (genesis && !genesis.error) {
        setGenesisStatus(genesis as GenesisStatus);
        if (genesis.running) setGenesisRunning(true);
      }
      if (workspace?.files) setGenesisFiles(workspace.files as GenesisFile[]);
      if (narrative?.content) setGenesisNarrative(narrative.content as string);
    });
  }, []);

  const startClassic = async () => {
    setEvents([]);
    setRunning(true);
    await fetch(`${API}/api/evolve/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycles }),
    });
  };

  const stopClassic = async () => {
    await fetch(`${API}/api/evolve/stop`, { method: "POST" });
  };

  const startArena = async () => {
    setEvents([]);
    setArenaRunning(true);
    await fetch(`${API}/api/arena/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds: arenaRounds }),
    });
  };

  const stopArena = async () => {
    await fetch(`${API}/api/arena/stop`, { method: "POST" });
  };

  const startBootstrap = async () => {
    setEvents([]);
    setBootstrapRunning(true);
    await fetch(`${API}/api/bootstrap/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds: bootstrapRounds }),
    });
  };

  const stopBootstrap = async () => {
    await fetch(`${API}/api/bootstrap/stop`, { method: "POST" });
  };

  const resetBootstrap = async () => {
    setBootstrapStatus(null);
    setBootstrapProtocol(null);
    setBootstrapArtifacts([]);
    setEvents([]);
    await fetch(`${API}/api/bootstrap/reset`, { method: "POST" });
  };

  const resetArena = async () => {
    setSolver(null);
    setProtocol(null);
    setEvents([]);
    await fetch(`${API}/api/arena/reset`, { method: "POST" });
  };

  const startGenesis = async () => {
    setEvents([]);
    setGenesisFiles([]);
    setGenesisNarrative(null);
    setGenesisStatus({ running: true, phase: "RESEARCH", iteration: 0, total_cost_usd: 0, pricing_known: true, files_created: [], last_assessment: null });
    setGenesisRunning(true);
    await fetch(`${API}/api/genesis/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_iterations: genesisMaxIter }),
    });
  };

  const stopGenesis = async () => {
    await fetch(`${API}/api/genesis/stop`, { method: "POST" });
  };

  const resetGenesis = async () => {
    setGenesisStatus(null);
    setGenesisFiles([]);
    setGenesisNarrative(null);
    setEvents([]);
    await fetch(`${API}/api/genesis/reset`, { method: "POST" });
  };

  const latestCompression =
    protocol?.round_history?.length
      ? protocol.round_history[protocol.round_history.length - 1].compression_ratio
      : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-mono p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">EvolveX</h1>
          <p className="text-slate-500 text-sm">Self-Modifying Agent Evolution System</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setMode("classic")}
              className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                mode === "classic" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => setMode("arena")}
              className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                mode === "arena" ? "bg-violet-700 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Arena
            </button>
            <button
              onClick={() => setMode("bootstrap")}
              className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                mode === "bootstrap" ? "bg-sky-700 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Bootstrap {bootstrapRunning && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />}
            </button>
            <button
              onClick={() => setMode("genesis")}
              className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                mode === "genesis" ? "bg-orange-700 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Genesis {genesisRunning && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
            </button>
          </div>
          {/* WS indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
            <span className="text-slate-400">{connected ? "connected" : "disconnected"}</span>
          </div>
        </div>
      </div>

      {/* ── Classic mode ──────────────────────────────────────────── */}
      {mode === "classic" && (
        <>
          {agent && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Generation", value: agent.generation },
                { label: "Fitness", value: agent.fitness_score.toFixed(4) },
                { label: "Mutations Applied", value: agent.mutation_count },
                { label: "Status", value: running ? "EVOLVING" : "IDLE" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-white text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="text-slate-400 text-sm">
              Cycles:
              <input
                type="number"
                min={1}
                max={20}
                value={cycles}
                onChange={(e) => setCycles(Number(e.target.value))}
                className="ml-2 w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm"
              />
            </label>
            <button
              onClick={startClassic}
              disabled={running || !connected}
              className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold transition-colors"
            >
              {running ? "EVOLVING..." : "START EVOLUTION"}
            </button>
            {running && (
              <button
                onClick={stopClassic}
                className="px-4 py-2 rounded border border-red-700 hover:border-red-500 text-red-400 text-sm transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={() => setEvents([])}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 text-slate-400 text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </>
      )}

      {/* ── Arena mode ────────────────────────────────────────────── */}
      {mode === "arena" && (
        <>
          {/* Stage progress bar */}
          {solver && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <p className="text-slate-500 text-xs uppercase tracking-widest">Cognitive Stage — Solver</p>
              <div className="flex items-stretch gap-2">
                {STAGE_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className={`flex-1 text-center py-2 rounded text-xs font-bold transition-all ${
                      i < solver.stage
                        ? "bg-emerald-900 text-emerald-300 border border-emerald-700"
                        : i === solver.stage
                        ? "bg-violet-700 text-white border border-violet-500"
                        : "bg-slate-800 text-slate-600 border border-slate-700"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
              {/* Consecutive-wins pip track */}
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      i < solver.consecutive_wins ? "bg-violet-500" : "bg-slate-800"
                    }`}
                  />
                ))}
                <span className="text-slate-500 text-xs ml-2">
                  {solver.wins_to_next_stage > 0
                    ? `${solver.wins_to_next_stage} win${solver.wins_to_next_stage !== 1 ? "s" : ""} to next stage`
                    : "Max stage reached"}
                </span>
              </div>
              {/* Stats row — 5 cards including compression */}
              <div className="grid grid-cols-5 gap-3 pt-1">
                {[
                  { label: "W / L", value: `${solver.total_wins} / ${solver.total_losses}` },
                  {
                    label: "Win Rate",
                    value:
                      solver.total_wins + solver.total_losses > 0
                        ? `${Math.round((solver.total_wins / (solver.total_wins + solver.total_losses)) * 100)}%`
                        : "—",
                  },
                  { label: "Generation", value: solver.generation },
                  { label: "Status", value: arenaRunning ? "BATTLING" : "IDLE" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-white text-lg font-bold">{value}</p>
                  </div>
                ))}
                {/* Compression stat card */}
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-0.5">Compression</p>
                  {latestCompression !== null ? (
                    <div className="flex items-center gap-2">
                      <p className={`text-lg font-bold ${compressionColor(latestCompression)}`}>
                        {Math.round(latestCompression * 100)}%
                      </p>
                      <CompressionSparkline history={protocol?.round_history ?? []} />
                    </div>
                  ) : (
                    <p className="text-slate-600 text-lg font-bold">—</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Protocol vocabulary panel */}
          {protocol && protocol.vocabulary.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-xs uppercase tracking-widest">
                  Emergent Protocol — {protocol.vocab_size} tokens
                  {protocol.utilization_rate > 0 && (
                    <span className="text-slate-600 ml-2">
                      ({Math.round(protocol.utilization_rate * 100)}% utilized)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {protocol.vocabulary.map((entry) => (
                  <div
                    key={entry.token}
                    title={`${entry.meaning} — proposed by ${entry.proposed_by} (round ${entry.round_created}, used ${entry.usage_count}×)`}
                    className={`px-2 py-0.5 rounded text-xs font-bold cursor-default border transition-opacity ${
                      entry.proposed_by === "challenger"
                        ? "bg-yellow-950 text-yellow-300 border-yellow-800"
                        : "bg-purple-950 text-purple-300 border-purple-800"
                    } ${entry.usage_count === 0 ? "opacity-50" : "opacity-100"}`}
                  >
                    {entry.token}
                  </div>
                ))}
              </div>
              <p className="text-slate-700 text-xs">
                <span className="text-yellow-800">■</span> challenger &nbsp;
                <span className="text-purple-800">■</span> solver &nbsp;·&nbsp; hover for meaning
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="text-slate-400 text-sm">
              Rounds:
              <input
                type="number"
                min={1}
                max={50}
                value={arenaRounds}
                onChange={(e) => setArenaRounds(Number(e.target.value))}
                className="ml-2 w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm"
              />
            </label>
            <button
              onClick={startArena}
              disabled={arenaRunning || !connected}
              className="px-6 py-2 rounded bg-violet-700 hover:bg-violet-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold transition-colors"
            >
              {arenaRunning ? "BATTLING..." : "START ARENA"}
            </button>
            {arenaRunning && (
              <button
                onClick={stopArena}
                className="px-4 py-2 rounded border border-red-700 hover:border-red-500 text-red-400 text-sm transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={resetArena}
              disabled={arenaRunning}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-slate-400 text-sm transition-colors"
            >
              Reset Solver
            </button>
            <button
              onClick={() => setEvents([])}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 text-slate-400 text-sm transition-colors"
            >
              Clear Feed
            </button>
          </div>
        </>
      )}

      {/* ── Bootstrap mode ────────────────────────────────────────── */}
      {mode === "bootstrap" && (
        <>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: "Stage", value: bootstrapStatus?.stage ?? "Handshake", color: "text-sky-300" },
              { label: "Round", value: bootstrapStatus?.round ?? 0, color: "text-white" },
              { label: "Stable Tokens", value: bootstrapProtocol?.stable_tokens ?? 0, color: "text-emerald-300" },
              { label: "Run Cost", value: `$${(bootstrapStatus?.run_cost_usd ?? 0).toFixed(4)}`, color: "text-white" },
              { label: "Status", value: bootstrapRunning ? "BOOTSTRAPPING" : "IDLE", color: bootstrapRunning ? "text-sky-300" : "text-slate-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Current Objective</p>
              <p className="text-slate-200 text-sm">{bootstrapStatus?.objective ?? "Waiting for bootstrap objective..."}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Unlocked Capabilities</p>
              <div className="flex flex-wrap gap-1.5">
                {(bootstrapStatus?.unlocked_capabilities ?? []).map((cap) => (
                  <span
                    key={cap}
                    className="px-2 py-0.5 rounded border border-sky-800 bg-sky-950 text-sky-300 text-xs font-bold"
                  >
                    {cap}
                  </span>
                ))}
                {(bootstrapStatus?.unlocked_capabilities ?? []).length === 0 && (
                  <span className="text-slate-600 text-xs">No capabilities unlocked yet.</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[bootstrapStatus?.peer_a, bootstrapStatus?.peer_b].map((peer) => (
              <div key={peer?.name ?? "peer"} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold">{peer?.name ?? "Peer"}</p>
                  <span className="text-slate-500 text-xs">gen {peer?.generation ?? 0}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Messages</p>
                    <p className="text-white font-bold">{peer?.message_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Contribution</p>
                    <p className="text-sky-300 font-bold">{peer?.contribution_score?.toFixed(2) ?? "0.00"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Dependency</p>
                    <p className="text-emerald-300 font-bold">{peer?.dependency_score?.toFixed(2) ?? "0.00"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Accepted</p>
                    <p className="text-white font-bold">{peer?.accepted_proposals ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Rejected</p>
                    <p className="text-white font-bold">{peer?.rejected_proposals ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Cost</p>
                    <p className="text-white font-bold">${(peer?.total_cost_usd ?? 0).toFixed(4)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-xs uppercase tracking-widest">Operating Language</p>
                <span className="text-slate-600 text-xs">
                  {bootstrapProtocol?.vocab_size ?? 0} tokens · {Math.round((bootstrapProtocol?.utilization_rate ?? 0) * 100)}% used
                </span>
              </div>
              {bootstrapProtocol?.vocabulary?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {bootstrapProtocol.vocabulary.map((entry) => (
                    <div
                      key={entry.token}
                      title={`${entry.meaning} · ${entry.state} · proposed by ${entry.proposed_by}${entry.accepted_by ? ` · accepted by ${entry.accepted_by}` : ""}`}
                      className={`px-2 py-1 rounded text-xs font-bold border ${
                        entry.state === "stable"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                          : entry.state === "adopted"
                          ? "bg-sky-950 text-sky-300 border-sky-800"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {entry.token}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 text-xs">No protocol tokens yet.</p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-xs uppercase tracking-widest">Artifacts</p>
                <span className="text-slate-600 text-xs">{bootstrapArtifacts.length} files</span>
              </div>
              {bootstrapArtifacts.length ? (
                bootstrapArtifacts.map((file) => (
                  <div key={file.path} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-mono truncate">{file.path}</span>
                    <span className="text-slate-600 shrink-0 ml-2">{file.size_bytes}B</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-xs">No artifacts yet.</p>
              )}
            </div>
          </div>

          {bootstrapStatus?.assessment && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <p className="text-slate-500 text-xs uppercase tracking-widest">Assessment</p>
              <div className="grid grid-cols-5 gap-3">
                {(["overall", "collaboration", "language", "traceability", "autonomy"] as const).map((key) => {
                  const score = bootstrapStatus.assessment?.[key] ?? 0;
                  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-teal-500" : score >= 40 ? "bg-yellow-500" : "bg-slate-600";
                  return (
                    <div key={key}>
                      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">{key}</p>
                      <p className={`text-2xl font-bold ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-teal-400" : score >= 40 ? "text-yellow-400" : "text-slate-500"}`}>
                        {score}
                      </p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i < Math.round(score / 10) ? color : "bg-slate-800"}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="text-slate-400 text-sm">
              Rounds:
              <input
                type="number"
                min={1}
                max={50}
                value={bootstrapRounds}
                onChange={(e) => setBootstrapRounds(Number(e.target.value))}
                className="ml-2 w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm"
              />
            </label>
            <button
              onClick={startBootstrap}
              disabled={bootstrapRunning || !connected}
              className="px-6 py-2 rounded bg-sky-700 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold transition-colors"
            >
              {bootstrapRunning ? "BOOTSTRAPPING..." : "START BOOTSTRAP"}
            </button>
            {bootstrapRunning && (
              <button
                onClick={stopBootstrap}
                className="px-4 py-2 rounded border border-red-700 hover:border-red-500 text-red-400 text-sm transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={resetBootstrap}
              disabled={bootstrapRunning}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-slate-400 text-sm transition-colors"
            >
              Reset Bootstrap
            </button>
            <button
              onClick={() => setEvents([])}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 text-slate-400 text-sm transition-colors"
            >
              Clear Feed
            </button>
          </div>
        </>
      )}

      {/* ── Genesis mode ──────────────────────────────────────────── */}
      {mode === "genesis" && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: "Phase",
                value: genesisStatus?.phase ?? "IDLE",
                color: genesisStatus?.phase === "COMPLETE" ? "text-green-400" : genesisRunning ? "text-orange-400" : "text-slate-400",
              },
              {
                label: "Iteration",
                value: genesisStatus?.iteration ?? 0,
                color: "text-white",
              },
              {
                label: "Cost",
                value: genesisStatus?.pricing_known === false ? "N/A" : `$${(genesisStatus?.total_cost_usd ?? 0).toFixed(3)}`,
                color: genesisStatus?.pricing_known === false ? "text-slate-500" : (genesisStatus?.total_cost_usd ?? 0) > 80 ? "text-red-400" : (genesisStatus?.total_cost_usd ?? 0) > 50 ? "text-yellow-400" : "text-white",
              },
              {
                label: "Files",
                value: genesisFiles.length,
                color: "text-white",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Capability scores */}
          {genesisStatus?.last_assessment && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <p className="text-slate-500 text-xs uppercase tracking-widest">Capability Assessment</p>
              <div className="grid grid-cols-5 gap-3">
                {(["overall", "reasoning", "tool_use", "error_handling", "self_improvement"] as const).map((key) => {
                  const score = genesisStatus.last_assessment![key];
                  const bar = Math.round(score / 10);
                  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-teal-500" : score >= 40 ? "bg-yellow-500" : "bg-slate-600";
                  return (
                    <div key={key}>
                      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
                        {key.replace("_", " ")}
                      </p>
                      <p className={`text-2xl font-bold ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-teal-400" : score >= 40 ? "text-yellow-400" : "text-slate-500"}`}>
                        {score}
                      </p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i < bar ? color : "bg-slate-800"}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action feed + workspace files */}
          <div className="grid grid-cols-2 gap-4" style={{ minHeight: "200px" }}>
            {/* Action feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-y-auto max-h-64 space-y-1">
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Action Feed</p>
              {events.filter((e) => e.event.startsWith("genesis_")).slice(-50).map((ev, i) => (
                <div key={i} className="flex gap-2 text-xs leading-relaxed">
                  <span className={`shrink-0 ${EVENT_COLORS[ev.event] ?? "text-slate-400"}`}>
                    {ev.event.replace("genesis_", "")}
                  </span>
                  <span className="text-slate-400 truncate">
                    {ev.event === "genesis_tool_call"
                      ? `${ev.data.tool} — ${String(ev.data.args_preview).slice(0, 60)}`
                      : ev.event === "genesis_tool_result"
                      ? `${ev.data.tool} ${ev.data.success ? "✓" : "✗"} ${ev.data.duration_ms}ms`
                      : ev.event === "genesis_thinking"
                      ? String(ev.data.thought).slice(0, 80)
                      : ev.event === "genesis_phase_change"
                      ? `${ev.data.old_phase} → ${ev.data.new_phase}`
                      : ev.event === "genesis_file_changed"
                      ? `${ev.data.action} ${ev.data.path}`
                      : JSON.stringify(ev.data).slice(0, 60)}
                  </span>
                </div>
              ))}
              {events.filter((e) => e.event.startsWith("genesis_")).length === 0 && (
                <p className="text-slate-600 text-xs">No genesis events yet...</p>
              )}
            </div>

            {/* Workspace files */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-y-auto max-h-64 space-y-1">
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Workspace Files</p>
              {genesisFiles.length === 0 ? (
                <p className="text-slate-600 text-xs">No files yet...</p>
              ) : (
                genesisFiles.map((f) => (
                  <div key={f.path} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-mono truncate">{f.path}</span>
                    <span className="text-slate-600 shrink-0 ml-2">{f.size_bytes}B</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Narrative panel (BUILD_LOG.md) */}
          {genesisNarrative && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Narrative — BUILD_LOG.md</p>
              <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                {genesisNarrative}
              </pre>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            <label className="text-slate-400 text-sm">
              Max Iterations:
              <input
                type="number"
                min={10}
                max={2000}
                step={100}
                value={genesisMaxIter}
                onChange={(e) => setGenesisMaxIter(Number(e.target.value))}
                className="ml-2 w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm"
              />
            </label>
            <button
              onClick={startGenesis}
              disabled={genesisRunning || !connected}
              className="px-6 py-2 rounded bg-orange-700 hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold transition-colors"
            >
              {genesisRunning ? "BUILDING..." : "START GENESIS"}
            </button>
            {genesisRunning && (
              <button
                onClick={stopGenesis}
                className="px-4 py-2 rounded border border-red-700 hover:border-red-500 text-red-400 text-sm transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={resetGenesis}
              disabled={genesisRunning}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-slate-400 text-sm transition-colors"
            >
              Reset Workspace
            </button>
            <button
              onClick={() => setEvents([])}
              className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 text-slate-400 text-sm transition-colors"
            >
              Clear Feed
            </button>
          </div>
        </>
      )}

      {/* ── Event feed (shared) ───────────────────────────────────── */}
      <div
        ref={feedRef}
        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-y-auto max-h-[calc(100vh-360px)] space-y-1"
      >
        {events.length === 0 && (
          <p className="text-slate-600 text-sm">Waiting for evolution events...</p>
        )}
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="text-slate-600 shrink-0 text-xs pt-0.5">
              {new Date(ev.ts).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 w-40 ${EVENT_COLORS[ev.event] ?? "text-slate-300"}`}>
              {ev.event}
            </span>
            <span className="text-slate-300 break-all text-xs">
              {ev.event === "arena_challenge"
                ? String(ev.data.description).slice(0, 120) +
                  (String(ev.data.description).length > 120 ? "…" : "")
                : ev.event === "arena_protocol_entry"
                ? `+${(ev.data.entries as {token:string}[])?.map((e) => e.token).join(" ")} by ${ev.data.proposed_by}`
                : ev.event === "arena_protocol_used"
                ? `ratio=${ev.data.compression_ratio} vocab=${ev.data.vocab_size}`
                : ev.event === "arena_protocol_consolidate"
                ? `stage=${ev.data.new_stage} vocab=${ev.data.vocab_size}`
                : ev.event === "genesis_thinking"
                ? String(ev.data.thought).slice(0, 150) + (String(ev.data.thought).length > 150 ? "…" : "")
                : ev.event === "genesis_tool_call"
                ? `${ev.data.tool}(${String(ev.data.args_preview).slice(0, 80)})`
                : ev.event === "genesis_tool_result"
                ? `${ev.data.tool} ${ev.data.success ? "✓" : "✗"} ${ev.data.duration_ms}ms — ${String(ev.data.output_preview).slice(0, 60)}`
                : ev.event === "genesis_file_changed"
                ? `${ev.data.action} ${ev.data.path} (${ev.data.size_bytes}B)`
                : ev.event === "genesis_phase_change"
                ? `${ev.data.old_phase} → ${ev.data.new_phase}`
                : ev.event === "genesis_token_usage"
                ? `$${(ev.data.total_cost_usd as number).toFixed(4)} | in=${ev.data.prompt_tokens} cached=${ev.data.cached_prompt_tokens ?? 0} out=${ev.data.completion_tokens}${ev.data.pricing_known === false ? " | pricing unavailable" : ""}`
                : ev.event === "bootstrap_peer_message"
                ? `${ev.data.peer} (${ev.data.role}): ${String(ev.data.message).slice(0, 120)}`
                : ev.event === "bootstrap_resumed"
                ? `resumed at round ${ev.data.resume_round} from checkpoint`
                : ev.event === "bootstrap_protocol_proposed"
                ? `${ev.data.peer} proposed ${ev.data.token} = ${String(ev.data.meaning).slice(0, 80)}`
                : ev.event === "bootstrap_protocol_adopted"
                ? `${ev.data.peer} adopted ${ev.data.token}`
                : ev.event === "bootstrap_tool_requested"
                ? `${ev.data.peer} requested ${ev.data.capability} (${ev.data.review_decision})`
                : ev.event === "bootstrap_tool_executed"
                ? `${ev.data.peer} executed ${ev.data.capability} ${ev.data.success ? "✓" : "✗"} — ${String(ev.data.output_preview).slice(0, 60)}`
                : ev.event === "bootstrap_tool_rejected"
                ? `${ev.data.peer} ${ev.data.capability} rejected — ${String(ev.data.reason).slice(0, 80)}`
                : ev.event === "bootstrap_artifact_changed"
                ? `${ev.data.peer} changed ${ev.data.path}`
                : ev.event === "bootstrap_stage_up"
                ? `stage -> ${ev.data.stage}`
                : ev.event === "bootstrap_injection"
                ? String(ev.data.injection).slice(0, 120)
                : ev.event === "bootstrap_assessment"
                ? `${ev.data.source}: ${JSON.stringify(ev.data.assessment).slice(0, 100)}`
                : JSON.stringify(ev.data)}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
