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

const API = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws/evolution";

const EVENT_COLORS: Record<string, string> = {
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
};

export default function Home() {
  const [events, setEvents] = useState<EvolutionEvent[]>([]);
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(5);
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
        if (ev.event === "complete") {
          setAgent(ev.data as AgentState);
          setRunning(false);
        }
        if (ev.event === "started") setRunning(true);
      };
    };
    connect();
    return () => ws?.close();
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  useEffect(() => {
    fetch(`${API}/api/evolve/status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.agent) setAgent(d.agent);
        if (d.status === "running") setRunning(true);
      })
      .catch(() => null);
  }, []);

  const startEvolution = async () => {
    setEvents([]);
    setRunning(true);
    await fetch(`${API}/api/evolve/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycles }),
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-mono p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">EvolveX</h1>
          <p className="text-slate-500 text-sm">Self-Modifying Agent Evolution System</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
          <span className="text-slate-400">{connected ? "connected" : "disconnected"}</span>
        </div>
      </div>

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
          onClick={startEvolution}
          disabled={running || !connected}
          className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold transition-colors"
        >
          {running ? "EVOLVING..." : "START EVOLUTION"}
        </button>
        <button
          onClick={() => setEvents([])}
          className="px-4 py-2 rounded border border-slate-700 hover:border-slate-500 text-slate-400 text-sm transition-colors"
        >
          Clear
        </button>
      </div>

      <div
        ref={feedRef}
        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-y-auto max-h-[calc(100vh-320px)] space-y-1"
      >
        {events.length === 0 && (
          <p className="text-slate-600 text-sm">Waiting for evolution events...</p>
        )}
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="text-slate-600 shrink-0 text-xs pt-0.5">
              {new Date(ev.ts).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 w-28 ${EVENT_COLORS[ev.event] ?? "text-slate-300"}`}>
              {ev.event}
            </span>
            <span className="text-slate-300 break-all text-xs">
              {JSON.stringify(ev.data)}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
