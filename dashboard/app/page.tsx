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

const API = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws/evolution";
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
};

export default function Home() {
  const [mode, setMode] = useState<"classic" | "arena">("classic");
  const [events, setEvents] = useState<EvolutionEvent[]>([]);
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [solver, setSolver] = useState<SolverState | null>(null);
  const [running, setRunning] = useState(false);
  const [arenaRunning, setArenaRunning] = useState(false);
  const [cycles, setCycles] = useState(5);
  const [arenaRounds, setArenaRounds] = useState(10);
  const [connected, setConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

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
          // Refresh solver state from arena status endpoint
          fetch(`${API}/api/arena/status`)
            .then((r) => r.json())
            .then((d) => { if (d.solver) setSolver(d.solver); })
            .catch(() => null);
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
    ]).then(([classic, arena]) => {
      if (classic?.agent) setAgent(classic.agent);
      if (classic?.status === "running") setRunning(true);
      if (arena?.solver) setSolver(arena.solver);
      if (arena?.status === "running") setArenaRunning(true);
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

  const resetArena = async () => {
    setSolver(null);
    setEvents([]);
    await fetch(`${API}/api/arena/reset`, { method: "POST" });
  };

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
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3 pt-1">
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
            <span className={`shrink-0 w-36 ${EVENT_COLORS[ev.event] ?? "text-slate-300"}`}>
              {ev.event}
            </span>
            <span className="text-slate-300 break-all text-xs">
              {ev.event === "arena_challenge"
                ? String(ev.data.description).slice(0, 120) + (String(ev.data.description).length > 120 ? "…" : "")
                : JSON.stringify(ev.data)}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
