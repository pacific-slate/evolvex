"use client";

import { useState, type ReactNode } from "react";

import { formatBytes, formatCurrency, formatPercent, getModeTheme } from "@/lib/evolvex-format";
import { sanitizeRunCount } from "@/lib/evolvex-normalize";
import type { EvolvexDashboardController } from "@/hooks/use-evolvex-dashboard";

import { Panel, SectionEyebrow, StatusPill } from "./workbench-shell";

const BOOTSTRAP_STAGE_LABELS = [
  { id: 0, name: "Handshake", detail: "Message exchange only." },
  { id: 1, name: "Artifacts", detail: "Shared files and protocol." },
  { id: 2, name: "Context", detail: "Reasoning anchored to repo state." },
  { id: 3, name: "Build", detail: "Execution and write access." },
  { id: 4, name: "Verify", detail: "Stronger validation criteria." },
  { id: 5, name: "Research", detail: "External retrieval opens." },
  { id: 6, name: "Integration", detail: "Protocol stabilizes." },
] as const;

type TabSpec = {
  id: string;
  label: string;
  count?: string;
  content: ReactNode;
};

function CompressionSparkline({ history }: { history: { compression_ratio: number }[] }) {
  if (history.length < 2) {
    return <span className="text-xs text-white/38">No history</span>;
  }

  const width = 144;
  const height = 40;
  const pad = 4;
  const points = history.slice(-18);
  const min = Math.min(...points.map((point) => point.compression_ratio));
  const max = Math.max(...points.map((point) => point.compression_ratio), min + 0.01);
  const d = points
    .map((point, index) => {
      const x = pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
      const y = pad + ((max - point.compression_ratio) / (max - min)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-300" />
    </svg>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-[6.5rem] flex-col gap-1">
      <span className="section-eyebrow">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(sanitizeRunCount(event.target.value, min, max))}
        className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition focus:border-white/25"
      />
    </label>
  );
}

function PrimaryButton({
  className,
  disabled,
  onClick,
  children,
}: {
  className: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  className = "",
  disabled,
  onClick,
  children,
}: {
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] px-4 text-xs uppercase tracking-[0.16em] text-white/70 transition hover:border-white/22 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function MiniStat({
  label,
  value,
  helper,
  accentClass = "text-white",
}: {
  label: string;
  value: string;
  helper?: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
      <p className="section-eyebrow">{label}</p>
      <p className={`mt-2 text-lg font-semibold tracking-tight ${accentClass}`}>{value}</p>
      {helper ? <p className="mt-1 text-[11px] leading-5 text-white/45">{helper}</p> : null}
    </div>
  );
}

function ScoreBar({ label, value, accentClass = "bg-cyan-300" }: { label: string; value: number; accentClass?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="section-eyebrow">{label}</span>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 10 }).map((_, index) => (
          <span key={`${label}-${index}`} className={`h-1.5 flex-1 rounded-full ${index < Math.round(value / 10) ? accentClass : "bg-white/10"}`} />
        ))}
      </div>
    </div>
  );
}

function TraceMiniList({
  trace,
  empty = "No events yet.",
}: {
  trace: EvolvexDashboardController["derived"]["currentTrace"];
  empty?: string;
}) {
  if (trace.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">{empty}</div>;
  }

  return (
    <div className="space-y-2">
      {trace
        .slice(-10)
        .reverse()
        .map((entry) => (
          <div key={`${entry.ts}-${entry.event}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{entry.label}</p>
                <p className="mt-1 text-xs leading-5 text-white/55">{entry.summary}</p>
              </div>
              <StatusPill tone={entry.tone}>{new Date(entry.ts).toLocaleTimeString()}</StatusPill>
            </div>
          </div>
        ))}
    </div>
  );
}

function FileList({ files, empty }: { files: { path: string; size_bytes: number }[]; empty: string }) {
  if (files.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">{empty}</div>;
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div key={file.path} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 break-all text-sm text-white/72">{file.path}</p>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-white/38">{formatBytes(file.size_bytes)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
        active ? "border-white/18 bg-white/12 text-white" : "border-white/8 bg-white/[0.03] text-white/50 hover:text-white/75"
      }`}
    >
      <span>{label}</span>
      {count ? <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px]">{count}</span> : null}
    </button>
  );
}

function EditorSurface({
  kicker,
  title,
  status,
  stats,
  controls,
  tabs,
  activeTab,
  onTabChange,
}: {
  kicker: string;
  title: string;
  status: ReactNode;
  stats: ReactNode;
  controls: ReactNode;
  tabs: TabSpec[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <Panel className="h-full gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionEyebrow>{kicker}</SectionEyebrow>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">{status}</div>
      </div>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{stats}</div>
        <div className="flex flex-wrap items-end gap-2 xl:justify-end">{controls}</div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/8 pb-3">
        {tabs.map((tab) => (
          <TabButton key={tab.id} active={tab.id === current.id} label={tab.label} count={tab.count} onClick={() => onTabChange(tab.id)} />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[1.25rem] border border-white/8 bg-black/20 p-3">{current.content}</div>
    </Panel>
  );
}

function ClassicSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("classic");
  const { agent, currentCode } = dashboard.data;
  const { cycles } = dashboard.controls;
  const running = dashboard.data.modeRunning.classic;
  const [tab, setTab] = useState("code");
  const lastSignal = dashboard.derived.currentTrace.at(-1);

  const tabs: TabSpec[] = [
    {
      id: "code",
      label: "Code",
      content: currentCode ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-white/8 bg-black/25 p-4 text-xs leading-6 text-white/76">{currentCode}</pre>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No benchmark snapshot yet.</div>
      ),
    },
    {
      id: "metrics",
      label: "Metrics",
      content: (
        <div className="grid gap-3 lg:grid-cols-2">
          <ScoreBar label="Generation" value={Math.min((agent?.generation ?? 0) * 10, 100)} accentClass="bg-emerald-300" />
          <ScoreBar label="Fitness" value={Math.round((agent?.fitness_score ?? 0) * 100)} accentClass="bg-emerald-300" />
          <ScoreBar label="Mutations" value={Math.min((agent?.mutation_count ?? 0) * 12, 100)} accentClass="bg-emerald-300" />
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <SectionEyebrow>Last Safety Signal</SectionEyebrow>
            <p className="mt-2 text-sm font-medium text-white">{lastSignal?.label ?? "Awaiting validation"}</p>
            <p className="mt-1 text-xs leading-5 text-white/52">{lastSignal?.summary ?? "No classic trace emitted yet."}</p>
          </div>
        </div>
      ),
    },
    {
      id: "events",
      label: "Trace",
      count: String(dashboard.derived.currentTrace.length),
      content: <TraceMiniList trace={dashboard.derived.currentTrace} empty="No classic trace yet." />,
    },
  ];

  return (
    <div className="mode-workspace flex h-full min-h-0 flex-col">
      <EditorSurface
        kicker="Classic"
        title="Checkpointed mutation loop"
        status={
          <>
            <StatusPill tone={running ? "active" : "idle"}>{running ? "live" : "ready"}</StatusPill>
            {lastSignal ? <StatusPill tone={lastSignal.tone}>{lastSignal.label}</StatusPill> : null}
          </>
        }
        stats={
          <>
            <MiniStat label="generation" value={String(agent?.generation ?? 0)} accentClass={theme.accentText} />
            <MiniStat label="fitness" value={agent ? agent.fitness_score.toFixed(4) : "0.0000"} accentClass={theme.accentText} />
            <MiniStat label="mutations" value={String(agent?.mutation_count ?? 0)} accentClass={theme.accentText} />
            <MiniStat label="cycles" value={String(cycles)} helper="run length" />
          </>
        }
        controls={
          <>
            <NumberField label="cycles" value={cycles} min={1} max={20} onChange={dashboard.controls.setCycles} />
            <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startClassic}>
              {running ? "running" : "start"}
            </PrimaryButton>
            {running ? <SecondaryButton onClick={dashboard.actions.stopClassic}>stop</SecondaryButton> : null}
            <SecondaryButton disabled={running} onClick={dashboard.actions.resetClassic} className={theme.buttonMuted}>
              reset
            </SecondaryButton>
            <SecondaryButton onClick={dashboard.actions.clearEvents}>clear trace</SecondaryButton>
          </>
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      />
    </div>
  );
}

function ArenaSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("arena");
  const { solver, protocol } = dashboard.data;
  const { arenaRounds } = dashboard.controls;
  const running = dashboard.data.modeRunning.arena;
  const [tab, setTab] = useState("ladder");
  const latestCompression = protocol?.round_history.at(-1)?.compression_ratio ?? null;

  const tabs: TabSpec[] = [
    {
      id: "ladder",
      label: "Ladder",
      content: (
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            {["Reactive", "Reflective", "Strategic", "Meta"].map((label, index) => (
              <div
                key={label}
                className={`rounded-xl border px-3 py-3 text-center text-xs uppercase tracking-[0.18em] ${
                  index < (solver?.stage ?? 0)
                    ? "border-violet-300/20 bg-violet-300/10 text-violet-100"
                    : index === (solver?.stage ?? -1)
                      ? `${theme.border} ${theme.panel} ${theme.accentText}`
                      : "border-white/8 bg-white/[0.03] text-white/35"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <SectionEyebrow>Streak</SectionEyebrow>
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">
                {solver?.wins_to_next_stage ? `${solver.wins_to_next_stage} to next` : "top stage"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {[0, 1, 2].map((index) => (
                <span key={index} className={`h-2 flex-1 rounded-full ${index < (solver?.consecutive_wins ?? 0) ? "bg-violet-300" : "bg-white/10"}`} />
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "protocol",
      label: "Protocol",
      count: String(protocol?.vocab_size ?? 0),
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="rounded-xl border border-white/8 bg-black/20 p-3">
              <SectionEyebrow>Compression</SectionEyebrow>
              <p className={`mt-2 text-lg font-semibold ${theme.accentText}`}>
                {latestCompression === null ? "—" : formatPercent(latestCompression)}
              </p>
              <div className="mt-3">
                <CompressionSparkline history={protocol?.round_history ?? []} />
              </div>
            </div>
            <div className="space-y-3">
              <MiniStat label="utilization" value={protocol ? formatPercent(protocol.utilization_rate) : "0%"} accentClass={theme.accentText} />
              <MiniStat label="vocab" value={String(protocol?.vocab_size ?? 0)} accentClass={theme.accentText} />
            </div>
          </div>
          {protocol?.vocabulary.length ? (
            <div className="flex flex-wrap gap-2">
              {protocol.vocabulary.map((entry) => (
                <div
                  key={entry.token}
                  title={`${entry.meaning} · ${entry.proposed_by} · ${entry.usage_count} uses`}
                  className={`rounded-full border px-3 py-2 text-sm ${
                    entry.proposed_by === "challenger" ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : `${theme.border} ${theme.panel} ${theme.accentText}`
                  }`}
                >
                  {entry.token}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No protocol tokens yet.</div>
          )}
        </div>
      ),
    },
    {
      id: "events",
      label: "Trace",
      count: String(dashboard.derived.currentTrace.length),
      content: <TraceMiniList trace={dashboard.derived.currentTrace} empty="No arena trace yet." />,
    },
  ];

  return (
    <div className="mode-workspace flex h-full min-h-0 flex-col">
      <EditorSurface
        kicker="Arena"
        title="Adversarial challenge ladder"
        status={
          <>
            <StatusPill tone={running ? "active" : "idle"}>{running ? "live" : "ready"}</StatusPill>
            {solver?.stage_name ? <StatusPill tone="muted">{solver.stage_name}</StatusPill> : null}
          </>
        }
        stats={
          <>
            <MiniStat label="stage" value={solver?.stage_name ?? "—"} accentClass={theme.accentText} />
            <MiniStat label="wins / losses" value={solver ? `${solver.total_wins} / ${solver.total_losses}` : "0 / 0"} accentClass={theme.accentText} />
            <MiniStat label="compression" value={latestCompression === null ? "—" : formatPercent(latestCompression)} accentClass={theme.accentText} />
            <MiniStat label="rounds" value={String(arenaRounds)} helper="run length" />
          </>
        }
        controls={
          <>
            <NumberField label="rounds" value={arenaRounds} min={1} max={50} onChange={dashboard.controls.setArenaRounds} />
            <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startArena}>
              {running ? "running" : "start"}
            </PrimaryButton>
            {running ? <SecondaryButton onClick={dashboard.actions.stopArena}>stop</SecondaryButton> : null}
            <SecondaryButton disabled={running} onClick={dashboard.actions.resetArena} className={theme.buttonMuted}>
              reset
            </SecondaryButton>
            <SecondaryButton onClick={dashboard.actions.clearEvents}>clear trace</SecondaryButton>
          </>
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      />
    </div>
  );
}

function BootstrapSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("bootstrap");
  const { bootstrapStatus, bootstrapProtocol, bootstrapArtifacts, bootstrapPeers } = dashboard.data;
  const { bootstrapRounds } = dashboard.controls;
  const running = dashboard.data.modeRunning.bootstrap;
  const [tab, setTab] = useState("overview");
  const bootstrapProgress = bootstrapStatus?.target_rounds
    ? Math.min(100, Math.round(((bootstrapStatus.round ?? 0) / bootstrapStatus.target_rounds) * 100))
    : 0;
  const tokenBreakdown = (bootstrapProtocol?.vocabulary ?? []).reduce(
    (acc, entry) => {
      acc[entry.state] += 1;
      return acc;
    },
    { pending: 0, adopted: 0, stable: 0 },
  );
  const latestCompression = bootstrapProtocol?.round_history.at(-1)?.compression_ratio ?? null;

  const tabs: TabSpec[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <SectionEyebrow>Objective</SectionEyebrow>
              <span className="text-xs uppercase tracking-[0.16em] text-white/42">{bootstrapStatus?.stage ?? "Idle"}</span>
            </div>
            <p className="mt-2 text-sm text-white">{bootstrapStatus?.objective ?? "Waiting for objective."}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 transition-all duration-500"
                style={{ width: `${bootstrapProgress}%` }}
              />
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            {BOOTSTRAP_STAGE_LABELS.map((stage) => {
              const state =
                stage.id < (bootstrapStatus?.stage_id ?? 0) ? "complete" : stage.id === (bootstrapStatus?.stage_id ?? 0) ? "current" : "upcoming";
              return (
                <div
                  key={stage.id}
                  className={`rounded-xl border px-3 py-3 ${
                    state === "complete"
                      ? "border-emerald-300/20 bg-emerald-300/10"
                      : state === "current"
                        ? "border-sky-300/20 bg-sky-300/10"
                        : "border-white/8 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{stage.name}</p>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">{stage.id}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/52">{stage.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {(bootstrapStatus?.unlocked_capabilities ?? []).map((capability) => (
              <span key={capability} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-sky-100">
                {capability}
              </span>
            ))}
            {(bootstrapStatus?.unlocked_capabilities ?? []).length === 0 ? (
              <span className="text-sm text-white/45">No unlocked capabilities yet.</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "protocol",
      label: "Protocol",
      count: String(bootstrapProtocol?.vocab_size ?? 0),
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="grid gap-3 md:grid-cols-3">
              <MiniStat label="pending" value={String(tokenBreakdown.pending)} />
              <MiniStat label="adopted" value={String(tokenBreakdown.adopted)} accentClass="text-sky-200" />
              <MiniStat label="stable" value={String(tokenBreakdown.stable)} accentClass="text-emerald-200" />
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-3">
              <SectionEyebrow>Compression</SectionEyebrow>
              <p className={`mt-2 text-lg font-semibold ${theme.accentText}`}>
                {latestCompression === null ? "—" : formatPercent(latestCompression)}
              </p>
              <div className="mt-3">
                <CompressionSparkline history={bootstrapProtocol?.round_history ?? []} />
              </div>
            </div>
          </div>
          {bootstrapProtocol?.vocabulary.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {bootstrapProtocol.vocabulary.map((entry) => (
                <div
                  key={entry.token}
                  className={`rounded-xl border p-3 ${
                    entry.state === "stable"
                      ? "border-emerald-300/20 bg-emerald-300/10"
                      : entry.state === "adopted"
                        ? "border-sky-300/20 bg-sky-300/10"
                        : "border-white/8 bg-black/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{entry.token}</span>
                    <StatusPill tone={entry.state === "stable" ? "success" : entry.state === "adopted" ? "active" : "muted"}>
                      {entry.state}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/58">{entry.meaning}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/38">
                    {entry.proposed_by}
                    {entry.accepted_by ? ` -> ${entry.accepted_by}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No shared language yet.</div>
          )}
        </div>
      ),
    },
    {
      id: "peers",
      label: "Peers",
      count: String(bootstrapPeers.length),
      content: bootstrapPeers.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {bootstrapPeers.map((peer) => (
            <div key={peer.name} className="rounded-xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{peer.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">gen {peer.generation}</p>
                </div>
                <StatusPill tone="active">{peer.message_count} msgs</StatusPill>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MiniStat label="contrib" value={String(peer.contribution_score)} />
                <MiniStat label="dependency" value={String(peer.dependency_score)} />
                <MiniStat label="accepted" value={String(peer.accepted_proposals)} />
              </div>
              <p className="mt-3 text-xs leading-5 text-white/48">cost {formatCurrency(peer.total_cost_usd)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No peer snapshots yet.</div>
      ),
    },
    {
      id: "files",
      label: "Artifacts",
      count: String(bootstrapArtifacts.length),
      content: (
        <div className="space-y-4">
          <FileList files={bootstrapArtifacts} empty="No artifacts yet." />
          {bootstrapStatus?.assessment ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <ScoreBar label="Overall" value={bootstrapStatus.assessment.overall} accentClass="bg-sky-300" />
              <ScoreBar label="Collaboration" value={bootstrapStatus.assessment.collaboration} accentClass="bg-sky-300" />
              <ScoreBar label="Language" value={bootstrapStatus.assessment.language} accentClass="bg-sky-300" />
              <ScoreBar label="Autonomy" value={bootstrapStatus.assessment.autonomy} accentClass="bg-sky-300" />
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "events",
      label: "Trace",
      count: String(dashboard.derived.currentTrace.length),
      content: <TraceMiniList trace={dashboard.derived.currentTrace} empty="No bootstrap trace yet." />,
    },
  ];

  return (
    <div className="mode-workspace flex h-full min-h-0 flex-col">
      <EditorSurface
        kicker="Bootstrap"
        title="Staged autonomy workspace"
        status={
          <>
            <StatusPill tone={running ? "active" : bootstrapStatus?.completed ? "success" : "idle"}>
              {running ? "live" : bootstrapStatus?.completed ? "complete" : "ready"}
            </StatusPill>
            {bootstrapStatus?.resumable && !running ? <StatusPill tone="warning">resume</StatusPill> : null}
          </>
        }
        stats={
          <>
            <MiniStat
              label="round"
              value={
                bootstrapStatus?.target_rounds ? `${bootstrapStatus.round ?? 0}/${bootstrapStatus.target_rounds}` : String(bootstrapStatus?.round ?? 0)
              }
              accentClass={theme.accentText}
            />
            <MiniStat label="stage" value={bootstrapStatus?.stage ?? "—"} accentClass={theme.accentText} />
            <MiniStat label="stable tokens" value={String(tokenBreakdown.stable)} accentClass="text-emerald-200" />
            <MiniStat label="cost" value={formatCurrency(bootstrapStatus?.run_cost_usd ?? 0)} accentClass={theme.accentText} />
          </>
        }
        controls={
          <>
            <NumberField label="rounds" value={bootstrapRounds} min={1} max={50} onChange={dashboard.controls.setBootstrapRounds} />
            <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startBootstrap}>
              {running ? "running" : bootstrapStatus?.resumable ? "resume" : "start"}
            </PrimaryButton>
            {running ? <SecondaryButton onClick={dashboard.actions.stopBootstrap}>stop</SecondaryButton> : null}
            <SecondaryButton disabled={running} onClick={dashboard.actions.resetBootstrap} className={theme.buttonMuted}>
              reset
            </SecondaryButton>
            <SecondaryButton onClick={dashboard.actions.clearEvents}>clear trace</SecondaryButton>
          </>
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      />
    </div>
  );
}

function GenesisSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("genesis");
  const { genesisStatus, genesisFiles, genesisNarrative } = dashboard.data;
  const { genesisMaxIter } = dashboard.controls;
  const running = dashboard.data.modeRunning.genesis;
  const [tab, setTab] = useState("workspace");

  const tabs: TabSpec[] = [
    {
      id: "workspace",
      label: "Workspace",
      count: String(genesisFiles.length),
      content: <FileList files={genesisFiles} empty="No workspace files yet." />,
    },
    {
      id: "assessment",
      label: "Assessment",
      content: genesisStatus?.last_assessment ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <ScoreBar label="Overall" value={genesisStatus.last_assessment.overall} accentClass="bg-amber-300" />
          <ScoreBar label="Reasoning" value={genesisStatus.last_assessment.reasoning} accentClass="bg-amber-300" />
          <ScoreBar label="Tool Use" value={genesisStatus.last_assessment.tool_use} accentClass="bg-amber-300" />
          <ScoreBar label="Error Handling" value={genesisStatus.last_assessment.error_handling} accentClass="bg-amber-300" />
          <ScoreBar label="Self Improvement" value={genesisStatus.last_assessment.self_improvement} accentClass="bg-amber-300" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No assessment yet.</div>
      ),
    },
    {
      id: "narrative",
      label: "Narrative",
      content: genesisNarrative ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-white/8 bg-black/25 p-4 text-xs leading-6 text-white/76">{genesisNarrative}</pre>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No build log yet.</div>
      ),
    },
    {
      id: "events",
      label: "Trace",
      count: String(dashboard.derived.currentTrace.length),
      content: <TraceMiniList trace={dashboard.derived.currentTrace} empty="No genesis trace yet." />,
    },
  ];

  return (
    <div className="mode-workspace flex h-full min-h-0 flex-col">
      <EditorSurface
        kicker="Genesis"
        title="Autonomous builder workspace"
        status={
          <>
            <StatusPill tone={running ? "active" : "idle"}>{running ? "live" : "ready"}</StatusPill>
            {genesisStatus?.phase ? <StatusPill tone="muted">{genesisStatus.phase}</StatusPill> : null}
          </>
        }
        stats={
          <>
            <MiniStat label="phase" value={genesisStatus?.phase ?? "—"} accentClass={theme.accentText} />
            <MiniStat label="iteration" value={String(genesisStatus?.iteration ?? 0)} accentClass={theme.accentText} />
            <MiniStat label="files" value={String(genesisFiles.length)} accentClass={theme.accentText} />
            <MiniStat
              label="cost"
              value={genesisStatus?.pricing_known === false ? "N/A" : formatCurrency(genesisStatus?.total_cost_usd ?? 0)}
              accentClass={theme.accentText}
            />
          </>
        }
        controls={
          <>
            <NumberField label="max iter" value={genesisMaxIter} min={10} max={2000} step={100} onChange={dashboard.controls.setGenesisMaxIter} />
            <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startGenesis}>
              {running ? "running" : "start"}
            </PrimaryButton>
            {running ? <SecondaryButton onClick={dashboard.actions.stopGenesis}>stop</SecondaryButton> : null}
            <SecondaryButton disabled={running} onClick={dashboard.actions.resetGenesis} className={theme.buttonMuted}>
              reset
            </SecondaryButton>
            <SecondaryButton onClick={dashboard.actions.clearEvents}>clear trace</SecondaryButton>
          </>
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      />
    </div>
  );
}

export function ModeSections({ dashboard }: { dashboard: EvolvexDashboardController }) {
  switch (dashboard.mode) {
    case "classic":
      return <ClassicSection dashboard={dashboard} />;
    case "arena":
      return <ArenaSection dashboard={dashboard} />;
    case "bootstrap":
      return <BootstrapSection dashboard={dashboard} />;
    case "genesis":
      return <GenesisSection dashboard={dashboard} />;
  }
}
