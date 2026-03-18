"use client";

import { formatBytes, formatCurrency, formatPercent, getModeTheme } from "@/lib/evolvex-format";
import { sanitizeRunCount } from "@/lib/evolvex-normalize";
import type { EvolvexDashboardController } from "@/hooks/use-evolvex-dashboard";

import { MetricCard, Panel, StatusPill } from "./workbench-shell";

const BOOTSTRAP_STAGE_LABELS = [
  { id: 0, name: "Handshake", detail: "Start with messaging and scratch space. No real power yet." },
  { id: 1, name: "Artifacts", detail: "Turn coordination into durable files and explicit protocol." },
  { id: 2, name: "Context", detail: "Anchor reasoning to the actual repo instead of pure vibes." },
  { id: 3, name: "Build", detail: "Unlock execution and test creation once the peers earn it." },
  { id: 4, name: "Verify", detail: "Unlock shell and stronger verification criteria." },
  { id: 5, name: "Research", detail: "Unlock web retrieval and outside references." },
  { id: 6, name: "Integration", detail: "Stabilize the protocol and tie the work together." },
] as const;

function CompressionSparkline({ history }: { history: { compression_ratio: number }[] }) {
  if (history.length < 2) {
    return <span className="text-sm text-white/40">No compression history yet</span>;
  }

  const width = 120;
  const height = 32;
  const pad = 4;
  const points = history.slice(-20);
  const min = Math.min(...points.map((point) => point.compression_ratio));
  const max = Math.max(...points.map((point) => point.compression_ratio), min + 0.01);
  const d = points
    .map((point, index) => {
      const x = pad + (index / (points.length - 1)) * (width - pad * 2);
      const y = pad + ((max - point.compression_ratio) / (max - min)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-200" />
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
    <label className="flex flex-col gap-2 text-sm text-white/70">
      <span className="section-eyebrow">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(sanitizeRunCount(event.target.value, min, max))}
        className="h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition focus:border-white/25"
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
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-center text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${className}`}
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
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.03] px-5 text-center text-sm uppercase tracking-[0.14em] text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${className}`}
    >
      {children}
    </button>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 80 ? "bg-emerald-300" : value >= 60 ? "bg-cyan-300" : value >= 40 ? "bg-amber-300" : "bg-white/35";

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="section-eyebrow">{label}</span>
        <span className="text-lg font-semibold text-white">{value}</span>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 10 }).map((_, index) => (
          <span key={`${label}-${index}`} className={`h-1.5 flex-1 rounded-full ${index < Math.round(value / 10) ? tone : "bg-white/10"}`} />
        ))}
      </div>
    </div>
  );
}

function formatPeerTelemetryValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function TraceMiniList({ trace }: { trace: EvolvexDashboardController["derived"]["currentTrace"] }) {
  if (trace.length === 0) {
    return <p className="text-sm leading-7 text-white/55">No live trace yet. This panel will fill with mode-specific evidence once the run emits events.</p>;
  }

  return (
    <div className="space-y-3">
      {trace.slice(-8).reverse().map((entry) => (
        <div key={`${entry.ts}-${entry.event}`} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">{entry.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/62">{entry.summary}</p>
            </div>
            <StatusPill tone={entry.tone}>{new Date(entry.ts).toLocaleTimeString()}</StatusPill>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModeBrief({
  dashboard,
}: {
  dashboard: EvolvexDashboardController;
}) {
  const { activeDefinition, idleBrief } = dashboard.derived;
  const isRunning = dashboard.data.modeRunning[dashboard.mode];

  return (
    <Panel kicker={isRunning ? "Live Experiment Brief" : idleBrief.eyebrow} title={isRunning ? activeDefinition.heroTitle : idleBrief.title}>
      <p className="max-w-4xl text-sm leading-7 text-white/72">{isRunning ? activeDefinition.whatItIs : idleBrief.summary}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {(isRunning ? activeDefinition.captures.slice(0, 3) : idleBrief.bullets).map((item) => (
          <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/68">
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ClassicSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("classic");
  const { agent, currentCode } = dashboard.data;
  const { cycles } = dashboard.controls;
  const running = dashboard.data.modeRunning.classic;

  return (
    <>
      <ModeBrief dashboard={dashboard} />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel kicker="Run Controls" title="Classic mutation run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Cycles" value={cycles} min={1} max={20} onChange={dashboard.controls.setCycles} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startClassic}>
                {running ? "Classic Live" : "Start Evolution"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopClassic}>Stop Run</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetClassic} className={theme.buttonMuted}>
                Reset Loop
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear Trace</SecondaryButton>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/55">
            Classic uses checkpointed mutation and sandbox validation as the core safety loop. Every accepted or rejected change is recorded in the shared trace dock.
          </p>
        </Panel>

        <Panel kicker="Current Benchmark Surface" title="What the mutator is operating on">
          {currentCode ? (
            <pre className="max-h-72 overflow-auto rounded-3xl border border-white/8 bg-black/25 p-5 text-xs leading-6 text-white/75">
              {currentCode}
            </pre>
          ) : (
            <p className="text-sm leading-7 text-white/55">No benchmark code snapshot yet. The classic status endpoint will populate this once the performer is initialized.</p>
          )}
        </Panel>
      </div>

      <Panel kicker="Live Metrics" title="Mutation evidence at a glance">
        <div className="auto-grid-compact">
          <ScoreBar label="Generation" value={agent?.generation ?? 0} />
          <ScoreBar label="Fitness" value={Math.round((agent?.fitness_score ?? 0) * 100)} />
          <ScoreBar label="Mutations" value={Math.min((agent?.mutation_count ?? 0) * 10, 100)} />
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="section-eyebrow">Run State</span>
              <StatusPill tone={running ? "active" : "idle"}>{running ? "Live" : "Standby"}</StatusPill>
            </div>
            <p className={`mt-6 text-3xl font-semibold ${theme.accentText}`}>{running ? "Evolving" : "Idle"}</p>
            <p className="mt-2 text-sm leading-6 text-white/55">Fitness remains the decision signal. The workbench will only accept a mutation after sandbox proof.</p>
          </div>
        </div>
      </Panel>

      <Panel kicker="Recent Decisions" title="Mutation trace highlights">
        <TraceMiniList trace={dashboard.derived.currentTrace} />
      </Panel>
    </>
  );
}

function ArenaSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("arena");
  const { solver, protocol } = dashboard.data;
  const { arenaRounds } = dashboard.controls;
  const running = dashboard.data.modeRunning.arena;
  const latestCompression = protocol?.round_history.at(-1)?.compression_ratio ?? null;

  return (
    <>
      <ModeBrief dashboard={dashboard} />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel kicker="Run Controls" title="Arena challenge run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Rounds" value={arenaRounds} min={1} max={50} onChange={dashboard.controls.setArenaRounds} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startArena}>
                {running ? "Arena Live" : "Start Arena"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopArena}>Stop Run</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetArena} className={theme.buttonMuted}>
                Reset Solver
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear Trace</SecondaryButton>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/55">
            Arena surfaces not only who wins, but how the solver progresses, what language it invents, and whether communication becomes more efficient.
          </p>
        </Panel>

        <Panel kicker="Stage Ladder" title="Solver progression">
          {solver ? (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-4">
                {["Reactive", "Reflective", "Strategic", "Meta-cognitive"].map((label, index) => (
                  <div
                    key={label}
                    className={`rounded-2xl border px-4 py-3 text-center text-sm uppercase tracking-[0.18em] ${
                      index < solver.stage
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                        : index === solver.stage
                          ? `${theme.border} ${theme.panel} ${theme.accentText}`
                          : "border-white/8 bg-white/[0.03] text-white/45"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((index) => (
                  <span key={index} className={`h-2 flex-1 rounded-full ${index < solver.consecutive_wins ? "bg-violet-300" : "bg-white/10"}`} />
                ))}
                <span className="ml-2 text-sm text-white/55">
                  {solver.wins_to_next_stage > 0 ? `${solver.wins_to_next_stage} wins to next stage` : "Top stage reached"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">The solver snapshot appears here once the arena status endpoint reports a stage and record.</p>
          )}
        </Panel>
      </div>

      <Panel kicker="Arena Telemetry" title="Performance, progression, and compression">
        <div className="auto-grid-compact">
          <ScoreBar label="Wins" value={(solver?.total_wins ?? 0) * 10} />
          <ScoreBar label="Losses" value={(solver?.total_losses ?? 0) * 10} />
          <ScoreBar label="Generation" value={(solver?.generation ?? 0) * 10} />
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <span className="section-eyebrow">Compression</span>
            <p className={`mt-4 text-3xl font-semibold ${theme.accentText}`}>
              {latestCompression === null ? "—" : formatPercent(latestCompression)}
            </p>
            <div className="mt-3">
              <CompressionSparkline history={protocol?.round_history ?? []} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <span className="section-eyebrow">Run State</span>
            <p className={`mt-4 text-3xl font-semibold ${theme.accentText}`}>{running ? "Battling" : "Standby"}</p>
            <p className="mt-2 text-sm text-white/55">{solver ? `${solver.total_wins + solver.total_losses} adjudicated rounds` : "No rounds yet"}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <Panel kicker="Emergent Protocol" title="Vocabulary and utilization">
          {protocol?.vocabulary.length ? (
            <div className="flex flex-wrap gap-2">
              {protocol.vocabulary.map((entry) => (
                <div
                  key={entry.token}
                  title={`${entry.meaning} · proposed by ${entry.proposed_by} · used ${entry.usage_count}x`}
                  className={`rounded-full border px-3 py-2 text-sm ${
                    entry.proposed_by === "challenger"
                      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
                      : `${theme.border} ${theme.panel} ${theme.accentText}`
                  }`}
                >
                  {entry.token}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">No protocol tokens yet. Once the solver and challenger compress communication, tokens will surface here.</p>
          )}
        </Panel>

        <Panel kicker="Recent Arena Signals" title="What changed most recently">
          <TraceMiniList trace={dashboard.derived.currentTrace} />
        </Panel>
      </div>
    </>
  );
}

function BootstrapSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("bootstrap");
  const { bootstrapStatus, bootstrapProtocol, bootstrapArtifacts, bootstrapPeers } = dashboard.data;
  const { bootstrapRounds } = dashboard.controls;
  const running = dashboard.data.modeRunning.bootstrap;
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

  return (
    <>
      <Panel kicker="Bootstrap Run" title="Live bootstrap status" className={theme.panel}>
        <div className="space-y-5">
          <p className="text-sm leading-7 text-white/68">
            Keep the operator surface focused on stage progress, capability unlocks, protocol growth, and artifacts.
          </p>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <StatusPill tone={running ? "active" : bootstrapStatus?.completed ? "success" : "idle"}>
              {running ? "Bootstrap live" : bootstrapStatus?.completed ? "Completed run" : "Ready to run"}
            </StatusPill>
            {bootstrapStatus?.resumable && !running ? <StatusPill tone="warning">Resume available</StatusPill> : null}
            <span className="signal-pill border-white/10 bg-white/5 text-white/65">
              Round {bootstrapStatus?.round ?? 0}
              {bootstrapStatus?.target_rounds ? ` / ${bootstrapStatus.target_rounds}` : ""}
            </span>
            <span className="signal-pill border-white/10 bg-white/5 text-white/65">
              Cost {formatCurrency(bootstrapStatus?.run_cost_usd ?? 0)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 transition-all duration-500"
              style={{ width: `${bootstrapProgress}%` }}
            />
          </div>
          <div className="auto-grid-compact">
            {BOOTSTRAP_STAGE_LABELS.map((stage) => {
              const state =
                stage.id < (bootstrapStatus?.stage_id ?? 0)
                  ? "complete"
                  : stage.id === (bootstrapStatus?.stage_id ?? 0)
                    ? "current"
                    : "upcoming";
              return (
                <div
                  key={stage.name}
                  className={`rounded-3xl border p-4 ${
                    state === "complete"
                      ? "border-emerald-300/20 bg-emerald-300/10"
                      : state === "current"
                        ? "border-sky-300/20 bg-sky-300/10"
                        : "border-white/8 bg-black/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{stage.name}</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{stage.id}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/58">{stage.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel kicker="Run Controls" title="Bootstrap autonomy run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Rounds" value={bootstrapRounds} min={1} max={50} onChange={dashboard.controls.setBootstrapRounds} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startBootstrap}>
                {running ? "Bootstrap Live" : bootstrapStatus?.resumable ? "Resume Bootstrap" : "Start Bootstrap"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopBootstrap}>Stop Run</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetBootstrap} className={theme.buttonMuted}>
                Reset Bootstrap
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear Trace</SecondaryButton>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/55">
            Bootstrap turns the dashboard into a monitored autonomy lab. You can watch capability unlocks, broker decisions,
            protocol adoption, and artifact growth without asking the backend for anything new.
          </p>
        </Panel>

        <Panel kicker="Live Objective" title={bootstrapStatus?.stage ?? "Bootstrap handshake"}>
          <p className="text-sm leading-7 text-white/72">{bootstrapStatus?.objective ?? "Waiting for the broker to assign a live objective."}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="section-eyebrow">Stable Tokens</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-100">{tokenBreakdown.stable}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="section-eyebrow">Adopted Tokens</p>
              <p className="mt-2 text-2xl font-semibold text-sky-100">{tokenBreakdown.adopted}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="section-eyebrow">Compression</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-100">
                {latestCompression === null ? "—" : formatPercent(latestCompression)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(bootstrapStatus?.unlocked_capabilities ?? []).map((capability) => (
              <span key={capability} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sky-100">
                {capability}
              </span>
            ))}
            {(bootstrapStatus?.unlocked_capabilities ?? []).length === 0 ? (
              <span className="text-sm text-white/45">Capabilities will appear here as the curriculum advances.</span>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel kicker="Peer Telemetry" title="Who is contributing to the protocol?">
        <div className="grid gap-4 2xl:grid-cols-2">
          {bootstrapPeers.length ? (
            bootstrapPeers.map((peer) => (
              <div key={peer.name} className="rounded-[28px] border border-white/8 bg-black/20 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{peer.name}</p>
                    <p className="text-sm text-white/45">Generation {peer.generation}</p>
                  </div>
                  <StatusPill tone="active">{peer.message_count} messages</StatusPill>
                </div>
                <div className="mt-5 auto-grid-compact">
                  <MetricCard
                    label="Contribution Pts"
                    value={formatPeerTelemetryValue(peer.contribution_score)}
                    helper="Weighted output across peer messages and review decisions."
                  />
                  <MetricCard
                    label="Dependency Turns"
                    value={formatPeerTelemetryValue(peer.dependency_score)}
                    helper="Messages that explicitly incorporated the other peer's input."
                  />
                  <MetricCard
                    label="Accepted Proposals"
                    value={String(peer.accepted_proposals)}
                    helper={
                      peer.rejected_proposals
                        ? `${peer.rejected_proposals} revise/reject decisions recorded.`
                        : "No revise/reject decisions recorded."
                    }
                  />
                </div>
                <p className="mt-4 text-sm leading-7 text-white/55">
                  Cost so far: {formatCurrency(peer.total_cost_usd)}{peer.cached_prompt_tokens ? ` · cached prompt tokens ${peer.cached_prompt_tokens}` : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-7 text-white/55">Peer snapshots will appear once bootstrap status is available.</p>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <Panel kicker="Operating Language" title="Token adoption, stability, and meaning">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="section-eyebrow">Pending</p>
              <p className="mt-2 text-xl font-semibold text-white">{tokenBreakdown.pending}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="section-eyebrow">Adopted</p>
              <p className="mt-2 text-xl font-semibold text-sky-100">{tokenBreakdown.adopted}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="section-eyebrow">Stable</p>
              <p className="mt-2 text-xl font-semibold text-emerald-100">{tokenBreakdown.stable}</p>
            </div>
          </div>
          {bootstrapProtocol?.vocabulary.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {bootstrapProtocol.vocabulary.map((entry) => (
                <div
                  key={entry.token}
                  className={`rounded-3xl border p-4 ${
                    entry.state === "stable"
                      ? "border-emerald-300/20 bg-emerald-300/10"
                      : entry.state === "adopted"
                        ? "border-sky-300/20 bg-sky-300/10"
                        : "border-white/8 bg-black/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{entry.token}</span>
                    <StatusPill tone={entry.state === "stable" ? "success" : entry.state === "adopted" ? "active" : "muted"}>
                      {entry.state}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/68">{entry.meaning}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">
                    {entry.proposed_by}
                    {entry.accepted_by ? ` → ${entry.accepted_by}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">No shared language yet. Proposed and stable tokens will appear here as soon as the peers start compressing coordination.</p>
          )}
        </Panel>

        <Panel kicker="Artifacts" title="Outputs captured by the workbench">
          {bootstrapArtifacts.length ? (
            <div className="space-y-2">
              {bootstrapArtifacts.map((file) => (
                <div key={file.path} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 break-all text-sm text-white/75">{file.path}</p>
                    <span className="text-xs uppercase tracking-[0.16em] text-white/45">{formatBytes(file.size_bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">No artifacts yet. Generated files and trace outputs will populate this panel automatically.</p>
          )}
        </Panel>
      </div>

      {bootstrapStatus?.assessment ? (
        <Panel kicker="Assessment" title="How well the peer system is coordinating">
          <div className="auto-grid-compact">
            <ScoreBar label="Overall" value={bootstrapStatus.assessment.overall} />
            <ScoreBar label="Collaboration" value={bootstrapStatus.assessment.collaboration} />
            <ScoreBar label="Language" value={bootstrapStatus.assessment.language} />
            <ScoreBar label="Traceability" value={bootstrapStatus.assessment.traceability} />
            <ScoreBar label="Autonomy" value={bootstrapStatus.assessment.autonomy} />
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function GenesisSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("genesis");
  const { genesisStatus, genesisFiles, genesisNarrative } = dashboard.data;
  const { genesisMaxIter } = dashboard.controls;
  const running = dashboard.data.modeRunning.genesis;

  return (
    <>
      <ModeBrief dashboard={dashboard} />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel kicker="Run Controls" title="Genesis autonomous build session" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Max Iterations" value={genesisMaxIter} min={10} max={2000} step={100} onChange={dashboard.controls.setGenesisMaxIter} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startGenesis}>
                {running ? "Genesis Live" : "Start Genesis"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopGenesis}>Stop Run</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetGenesis} className={theme.buttonMuted}>
                Reset Workspace
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear Trace</SecondaryButton>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/55">
            Genesis is the clearest operator story for the workbench: every tool invocation, file mutation, and assessment score becomes visible instead of hiding behind a single final output.
          </p>
        </Panel>

        <Panel kicker="Builder Telemetry" title="Current phase, cost, and output surface">
          <div className="auto-grid-compact">
            <ScoreBar label="Phase" value={genesisStatus?.phase === "COMPLETE" ? 100 : genesisStatus ? 65 : 0} />
            <ScoreBar label="Iteration" value={Math.min((genesisStatus?.iteration ?? 0) * 10, 100)} />
            <ScoreBar label="Files" value={Math.min(genesisFiles.length * 18, 100)} />
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <span className="section-eyebrow">Observed Cost</span>
              <p className={`mt-4 text-3xl font-semibold ${theme.accentText}`}>
                {genesisStatus?.pricing_known === false ? "N/A" : formatCurrency(genesisStatus?.total_cost_usd ?? 0)}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">Pricing stays visible so a demo can explain capability in cost terms, not just screenshots.</p>
            </div>
          </div>
        </Panel>
      </div>

      {genesisStatus?.last_assessment ? (
        <Panel kicker="Capability Assessment" title="How the builder rated its own performance">
          <div className="auto-grid-compact">
            <ScoreBar label="Overall" value={genesisStatus.last_assessment.overall} />
            <ScoreBar label="Reasoning" value={genesisStatus.last_assessment.reasoning} />
            <ScoreBar label="Tool Use" value={genesisStatus.last_assessment.tool_use} />
            <ScoreBar label="Error Handling" value={genesisStatus.last_assessment.error_handling} />
            <ScoreBar label="Self Improvement" value={genesisStatus.last_assessment.self_improvement} />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel kicker="Workspace Files" title="Artifacts under construction">
          {genesisFiles.length ? (
            <div className="space-y-2">
              {genesisFiles.map((file) => (
                <div key={file.path} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 break-all text-sm text-white/75">{file.path}</p>
                    <span className="text-xs uppercase tracking-[0.16em] text-white/45">{formatBytes(file.size_bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">No workspace files yet. Genesis will populate this panel as soon as it starts writing into the sandbox.</p>
          )}
        </Panel>

        <Panel kicker="Recent Genesis Signals" title="Tool results and phase changes">
          <TraceMiniList trace={dashboard.derived.currentTrace} />
        </Panel>
      </div>

      <Panel kicker="Recent Narrative" title="BUILD_LOG trace">
        {genesisNarrative ? (
          <pre className="max-h-72 overflow-auto rounded-3xl border border-white/8 bg-black/25 p-5 text-xs leading-6 text-white/72">{genesisNarrative}</pre>
        ) : (
          <p className="text-sm leading-7 text-white/55">The builder narrative will stream here when Genesis writes BUILD_LOG updates.</p>
        )}
      </Panel>
    </>
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
