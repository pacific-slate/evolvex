"use client";

import { formatBytes, formatCurrency, formatPercent, getModeTheme } from "@/lib/evolvex-format";
import { sanitizeRunCount } from "@/lib/evolvex-normalize";
import type { EvolvexDashboardController } from "@/hooks/use-evolvex-dashboard";

import { Panel, StatusPill } from "./workbench-shell";

const BOOTSTRAP_STAGE_LABELS = ["Handshake", "Artifacts", "Context", "Build", "Verify", "Research", "Integration"];

function CompressionSparkline({ history }: { history: { compression_ratio: number }[] }) {
  if (history.length < 2) {
    return <span className="text-sm text-white/40">No history.</span>;
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
      className={`inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
      className={`inline-flex h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] px-5 text-sm uppercase tracking-[0.14em] text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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

function TraceMiniList({ trace }: { trace: EvolvexDashboardController["derived"]["currentTrace"] }) {
  if (trace.length === 0) {
    return <p className="text-sm leading-7 text-white/55">No trace.</p>;
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

function ClassicSection({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const theme = getModeTheme("classic");
  const { agent, currentCode } = dashboard.data;
  const { cycles } = dashboard.controls;
  const running = dashboard.data.modeRunning.classic;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel kicker="Classic" title="Run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Cycles" value={cycles} min={1} max={20} onChange={dashboard.controls.setCycles} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startClassic}>
                {running ? "Running" : "Start"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopClassic}>Stop</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetClassic} className={theme.buttonMuted}>
                Reset
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear</SecondaryButton>
            </div>
          </div>
        </Panel>

        <Panel kicker="Code" title="Current surface">
          {currentCode ? (
            <pre className="max-h-72 overflow-auto rounded-3xl border border-white/8 bg-black/25 p-5 text-xs leading-6 text-white/75">{currentCode}</pre>
          ) : (
            <p className="text-sm leading-7 text-white/55">No code.</p>
          )}
        </Panel>
      </div>

      <Panel kicker="Metrics" title="Current state">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ScoreBar label="Generation" value={agent?.generation ?? 0} />
          <ScoreBar label="Fitness" value={Math.round((agent?.fitness_score ?? 0) * 100)} />
          <ScoreBar label="Mutations" value={Math.min((agent?.mutation_count ?? 0) * 10, 100)} />
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="section-eyebrow">State</span>
              <StatusPill tone={running ? "active" : "idle"}>{running ? "Live" : "Idle"}</StatusPill>
            </div>
            <p className={`mt-6 text-3xl font-semibold ${theme.accentText}`}>{running ? "Running" : "Ready"}</p>
          </div>
        </div>
      </Panel>

      <Panel kicker="Events" title="Recent">
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel kicker="Arena" title="Run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Rounds" value={arenaRounds} min={1} max={50} onChange={dashboard.controls.setArenaRounds} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startArena}>
                {running ? "Running" : "Start"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopArena}>Stop</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetArena} className={theme.buttonMuted}>
                Reset
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear</SecondaryButton>
            </div>
          </div>
        </Panel>

        <Panel kicker="Stages" title="Ladder">
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
                <span className="ml-2 text-sm text-white/55">{solver.wins_to_next_stage > 0 ? `${solver.wins_to_next_stage} to next` : "max"}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">No solver.</p>
          )}
        </Panel>
      </div>

      <Panel kicker="Metrics" title="Current state">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ScoreBar label="Wins" value={(solver?.total_wins ?? 0) * 10} />
          <ScoreBar label="Losses" value={(solver?.total_losses ?? 0) * 10} />
          <ScoreBar label="Generation" value={(solver?.generation ?? 0) * 10} />
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <span className="section-eyebrow">Compression</span>
            <p className={`mt-4 text-3xl font-semibold ${theme.accentText}`}>{latestCompression === null ? "—" : formatPercent(latestCompression)}</p>
            <div className="mt-3">
              <CompressionSparkline history={protocol?.round_history ?? []} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <span className="section-eyebrow">State</span>
            <p className={`mt-4 text-3xl font-semibold ${theme.accentText}`}>{running ? "Live" : "Idle"}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <Panel kicker="Protocol" title="Tokens">
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
            <p className="text-sm leading-7 text-white/55">No protocol.</p>
          )}
        </Panel>

        <Panel kicker="Events" title="Recent">
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel kicker="Bootstrap" title="Run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Rounds" value={bootstrapRounds} min={1} max={50} onChange={dashboard.controls.setBootstrapRounds} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startBootstrap}>
                {running ? "Running" : bootstrapStatus?.resumable ? "Resume" : "Start"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopBootstrap}>Stop</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetBootstrap} className={theme.buttonMuted}>
                Reset
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear</SecondaryButton>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <StatusPill tone={running ? "active" : bootstrapStatus?.completed ? "success" : "idle"}>{running ? "Live" : bootstrapStatus?.completed ? "Done" : "Ready"}</StatusPill>
            {bootstrapStatus?.resumable && !running ? <StatusPill tone="warning">Resumable</StatusPill> : null}
            <span className="signal-pill border-white/10 bg-white/5 text-white/65">
              {bootstrapStatus?.round ?? 0}
              {bootstrapStatus?.target_rounds ? ` / ${bootstrapStatus.target_rounds}` : ""}
            </span>
            <span className="signal-pill border-white/10 bg-white/5 text-white/65">{formatCurrency(bootstrapStatus?.run_cost_usd ?? 0)}</span>
          </div>
        </Panel>

        <Panel kicker="Stages" title={bootstrapStatus?.stage ?? "Current stage"}>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 transition-all duration-500"
              style={{ width: `${bootstrapProgress}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {BOOTSTRAP_STAGE_LABELS.map((stage, index) => {
              const state =
                index < (bootstrapStatus?.stage_id ?? 0) ? "complete" : index === (bootstrapStatus?.stage_id ?? 0) ? "current" : "upcoming";
              return (
                <div
                  key={stage}
                  className={`rounded-3xl border p-4 ${
                    state === "complete"
                      ? "border-emerald-300/20 bg-emerald-300/10"
                      : state === "current"
                        ? "border-sky-300/20 bg-sky-300/10"
                        : "border-white/8 bg-black/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{stage}</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{index}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel kicker="Objective" title={bootstrapStatus?.stage ?? "Bootstrap"}>
          <div className="space-y-4">
            <p className="text-sm leading-7 text-white/72">{bootstrapStatus?.objective ?? "No objective."}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="section-eyebrow">Stable</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-100">{tokenBreakdown.stable}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="section-eyebrow">Adopted</p>
                <p className="mt-2 text-2xl font-semibold text-sky-100">{tokenBreakdown.adopted}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="section-eyebrow">Compression</p>
                <p className="mt-2 text-2xl font-semibold text-cyan-100">{latestCompression === null ? "—" : formatPercent(latestCompression)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(bootstrapStatus?.unlocked_capabilities ?? []).map((capability) => (
                <span key={capability} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sky-100">
                  {capability}
                </span>
              ))}
              {(bootstrapStatus?.unlocked_capabilities ?? []).length === 0 ? <span className="text-sm text-white/45">No unlocked capabilities.</span> : null}
            </div>
          </div>
        </Panel>

        <Panel kicker="Peers" title="Telemetry">
          <div className="grid gap-4 xl:grid-cols-2">
            {bootstrapPeers.length ? (
              bootstrapPeers.map((peer) => (
                <div key={peer.name} className="rounded-[28px] border border-white/8 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">{peer.name}</p>
                      <p className="text-sm text-white/45">Gen {peer.generation}</p>
                    </div>
                    <StatusPill tone="active">{peer.message_count}</StatusPill>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ScoreBar label="Contribution" value={Math.round(peer.contribution_score * 100)} />
                    <ScoreBar label="Dependency" value={Math.round(peer.dependency_score * 100)} />
                    <ScoreBar label="Accepted" value={Math.min(peer.accepted_proposals * 20, 100)} />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/55">{formatCurrency(peer.total_cost_usd)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-white/55">No peer state.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <Panel kicker="Protocol" title="Vocabulary">
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
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-white/55">No protocol.</p>
          )}
        </Panel>

        <Panel kicker="Artifacts" title="Files">
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
            <p className="text-sm leading-7 text-white/55">No files.</p>
          )}
        </Panel>
      </div>

      {bootstrapStatus?.assessment ? (
        <Panel kicker="Assessment" title="Scores">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel kicker="Genesis" title="Run" className={theme.panel}>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
            <NumberField label="Iterations" value={genesisMaxIter} min={10} max={2000} step={100} onChange={dashboard.controls.setGenesisMaxIter} />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton className={theme.button} disabled={running} onClick={dashboard.actions.startGenesis}>
                {running ? "Running" : "Start"}
              </PrimaryButton>
              {running ? <SecondaryButton onClick={dashboard.actions.stopGenesis}>Stop</SecondaryButton> : null}
              <SecondaryButton disabled={running} onClick={dashboard.actions.resetGenesis} className={theme.buttonMuted}>
                Reset
              </SecondaryButton>
              <SecondaryButton onClick={dashboard.actions.clearEvents}>Clear</SecondaryButton>
            </div>
          </div>
        </Panel>

        <Panel kicker="Telemetry" title="Current state">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScoreBar label="Phase" value={genesisStatus?.phase === "COMPLETE" ? 100 : genesisStatus ? 65 : 0} />
            <ScoreBar label="Iteration" value={Math.min((genesisStatus?.iteration ?? 0) * 10, 100)} />
            <ScoreBar label="Files" value={Math.min(genesisFiles.length * 18, 100)} />
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <span className="section-eyebrow">Cost</span>
              <p className={`mt-4 text-3xl font-semibold ${theme.accentText}`}>
                {genesisStatus?.pricing_known === false ? "N/A" : formatCurrency(genesisStatus?.total_cost_usd ?? 0)}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {genesisStatus?.last_assessment ? (
        <Panel kicker="Assessment" title="Scores">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ScoreBar label="Overall" value={genesisStatus.last_assessment.overall} />
            <ScoreBar label="Reasoning" value={genesisStatus.last_assessment.reasoning} />
            <ScoreBar label="Tool Use" value={genesisStatus.last_assessment.tool_use} />
            <ScoreBar label="Error Handling" value={genesisStatus.last_assessment.error_handling} />
            <ScoreBar label="Self Improvement" value={genesisStatus.last_assessment.self_improvement} />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel kicker="Workspace" title="Files">
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
            <p className="text-sm leading-7 text-white/55">No files.</p>
          )}
        </Panel>

        <Panel kicker="Events" title="Recent">
          <TraceMiniList trace={dashboard.derived.currentTrace} />
        </Panel>
      </div>

      <Panel kicker="Narrative" title="Build log">
        {genesisNarrative ? (
          <pre className="max-h-72 overflow-auto rounded-3xl border border-white/8 bg-black/25 p-5 text-xs leading-6 text-white/72">{genesisNarrative}</pre>
        ) : (
          <p className="text-sm leading-7 text-white/55">No log.</p>
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
