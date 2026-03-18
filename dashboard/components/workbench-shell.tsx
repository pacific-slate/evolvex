"use client";

import { useState, type ReactNode } from "react";

import { getModeTheme } from "@/lib/evolvex-format";
import type {
  DevelopmentGauge,
  DevelopmentTimelineEntry,
  DevelopmentView,
  GrowthLatestSummary,
  GrowthPromotionCandidate,
  GrowthRunBundle,
  GrowthRunSummary,
  ModeKey,
  ModeRailCard,
  StatusTone,
  WorkbenchOverview,
} from "@/lib/evolvex-types";

const TONE_STYLES: Record<StatusTone, string> = {
  idle: "border-slate-300/30 bg-white text-slate-500",
  active: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  muted: "border-slate-200 bg-slate-50 text-slate-600",
};

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="section-eyebrow">{children}</p>;
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`signal-pill ${TONE_STYLES[tone]}`}>{children}</span>;
}

export function Panel({
  className = "",
  kicker,
  title,
  actions,
  children,
}: {
  className?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`lab-panel ${className}`}>
      {(kicker || title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {kicker ? <SectionEyebrow>{kicker}</SectionEyebrow> : null}
            {title ? <h2 className="text-balance text-xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function SystemStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="system-stat">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function ModeSelector({
  card,
  active,
  onSelect,
}: {
  card: ModeRailCard;
  active: boolean;
  onSelect: (mode: ModeKey) => void;
}) {
  const theme = getModeTheme(card.key);

  return (
    <button
      onClick={() => onSelect(card.key)}
      className={`mode-selector ${active ? `${theme.panel} ${theme.border}` : ""}`}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-left">
          <p className="text-sm font-semibold text-slate-950">{card.label}</p>
          <p className="text-sm leading-6 text-slate-600">{card.strapline}</p>
        </div>
        <StatusPill tone={card.statusTone}>{card.isRunning ? "Live" : "Ready"}</StatusPill>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-950">{card.statusLabel}</p>
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.activityCount}</span>
      </div>
      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{card.evidenceLabel}</p>
    </button>
  );
}

function ProgressRail({
  label,
  value,
  valueLabel,
  helper,
  dimmed = false,
}: {
  label: string;
  value: number;
  valueLabel: string;
  helper?: string;
  dimmed?: boolean;
}) {
  return (
    <div className="progress-rail">
      <div className="flex items-center justify-between gap-4">
        <span className="section-eyebrow">{label}</span>
        <span className="text-sm font-medium text-slate-950">{valueLabel}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${dimmed ? "bg-slate-300" : "bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500"}`}
          style={{ width: `${Math.max(6, value)}%` }}
        />
      </div>
      {helper ? <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p> : null}
    </div>
  );
}

function GaugeCard({ gauge }: { gauge: DevelopmentGauge }) {
  return (
    <div className="gauge-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">{gauge.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{gauge.display}</p>
        </div>
        <StatusPill tone={gauge.tone}>{gauge.value}%</StatusPill>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.max(6, gauge.value)}%` }} />
      </div>
    </div>
  );
}

function TimelineRow({ entry, currentMode }: { entry: DevelopmentTimelineEntry; currentMode: ModeKey }) {
  return (
    <div className={`timeline-row ${entry.mode === currentMode ? "timeline-row-active" : ""}`}>
      <div className="timeline-dot" data-tone={entry.tone} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-950">{entry.label}</p>
          <StatusPill tone={entry.tone}>{entry.mode}</StatusPill>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{entry.summary}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{entry.meta}</p>
      </div>
    </div>
  );
}

function CapabilityRow({
  label,
  helper,
  state,
}: {
  label: string;
  helper: string;
  state: "active" | "emerging" | "locked";
}) {
  const tone: StatusTone = state === "active" ? "success" : state === "emerging" ? "active" : "muted";

  return (
    <div className="capability-row">
      <div>
        <p className="text-sm font-medium text-slate-950">{label}</p>
        {helper ? <p className="mt-1 text-sm leading-6 text-slate-600">{helper}</p> : null}
      </div>
      <StatusPill tone={tone}>{state}</StatusPill>
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="output-card">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function UtilityDisclosure({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="utility-disclosure">
      <button type="button" className="utility-disclosure-summary" onClick={() => setOpen((value) => !value)}>
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          {count ? <span className="utility-disclosure-count">{count}</span> : null}
          <span className="utility-disclosure-toggle">{open ? "Hide" : "Open"}</span>
        </div>
      </button>
      {open ? <div className="utility-disclosure-body">{children}</div> : null}
    </div>
  );
}

function formatTimestamp(value?: string | null) {
  if (!value) return "No timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RegistryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="console-card">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-3 font-mono text-2xl text-slate-950">{value}</p>
    </div>
  );
}

function GrowthConsole({
  apiBase,
  growthLatest,
  growthRuns,
  growthLatestRun,
  growthPromotionQueue,
  onVerifyRealityContract,
  verifyingRealityContract,
}: {
  apiBase: string;
  growthLatest: GrowthLatestSummary | null;
  growthRuns: GrowthRunSummary[];
  growthLatestRun: GrowthRunBundle | null;
  growthPromotionQueue: GrowthPromotionCandidate[];
  onVerifyRealityContract: () => void;
  verifyingRealityContract: boolean;
}) {
  const counts = growthLatest?.counts;
  const queueTone: StatusTone = growthPromotionQueue.length ? "active" : "idle";

  return (
    <Panel
      className="console-panel"
      kicker="Registry"
      title="Truth gate"
      actions={
        <button
          onClick={onVerifyRealityContract}
          disabled={verifyingRealityContract}
          className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyingRealityContract ? "Running" : "Run"}
        </button>
      }
    >
      <div className="console-toolbar">
        <span className="console-pill">API {apiBase}</span>
        <span className="console-pill">Run {growthLatest?.latest_run_id ?? "none"}</span>
        <span className="console-pill">Queue {growthPromotionQueue.length}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <div className="console-block">
            <div className="console-block-header">
              <SectionEyebrow>Counts</SectionEyebrow>
              <StatusPill tone={growthLatest?.latest_run_id ? "success" : "warning"}>
                {growthLatest?.latest_run_id ? "Loaded" : "Empty"}
              </StatusPill>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RegistryStat label="Signals" value={String(counts?.frontier_signals ?? 0)} />
              <RegistryStat label="Artifacts" value={String(counts?.growth_artifacts ?? 0)} />
              <RegistryStat label="Claims" value={String(counts?.claim_checks ?? 0)} />
              <RegistryStat label="Queue" value={String(counts?.promotion_candidates ?? 0)} />
            </div>
          </div>

          <div className="console-block">
            <div className="console-block-header">
              <SectionEyebrow>Runs</SectionEyebrow>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{growthRuns.length}</span>
            </div>
            <div className="space-y-2">
              {growthRuns.length ? (
                growthRuns.map((run) => (
                  <div key={run.run_id} className="console-list-row">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-slate-950">{run.run_id}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{formatTimestamp(run.updated_at)}</p>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.16em] text-slate-500">
                      {run.counts.growth_artifacts} / {run.counts.promotion_candidates}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No runs.</p>
              )}
            </div>
          </div>
        </div>

        <div className="console-block">
          <div className="console-block-header">
            <SectionEyebrow>Latest run</SectionEyebrow>
            <StatusPill tone={growthLatestRun ? "active" : "idle"}>{growthLatestRun ? "Loaded" : "Empty"}</StatusPill>
          </div>

          {growthLatestRun ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {growthLatestRun.records.growth_artifacts.slice(0, 4).map((artifact) => (
                  <div key={artifact.id} className="console-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-950">{artifact.name}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{artifact.artifact_type}</p>
                      </div>
                      <StatusPill tone={artifact.status === "validated" ? "success" : artifact.status === "queued" ? "warning" : "muted"}>
                        {artifact.status}
                      </StatusPill>
                    </div>
                    <p className="mt-3 break-all font-mono text-xs leading-6 text-slate-500">{artifact.artifact_path}</p>
                  </div>
                ))}
              </div>

              <div className="console-card">
                <div className="console-block-header">
                  <SectionEyebrow>Claims</SectionEyebrow>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{growthLatestRun.records.claim_checks.length}</span>
                </div>
                <div className="space-y-2">
                  {growthLatestRun.records.claim_checks.slice(0, 4).map((check) => (
                    <div key={check.id} className="console-list-row">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">{check.claim}</p>
                        <p className="mt-1 text-xs text-slate-500">{check.local_repo_mapping}</p>
                      </div>
                      <StatusPill tone={check.status === "landed" ? "success" : check.status === "unsupported" ? "danger" : "warning"}>
                        {check.status}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No run loaded.</p>
          )}
        </div>

        <div className="console-block">
          <div className="console-block-header">
            <SectionEyebrow>Queue</SectionEyebrow>
            <StatusPill tone={queueTone}>{growthPromotionQueue.length ? "Active" : "Idle"}</StatusPill>
          </div>
          <div className="space-y-3">
            {growthPromotionQueue.length ? (
              growthPromotionQueue.slice(0, 5).map((candidate) => (
                <div key={candidate.id} className="console-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{candidate.title}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{candidate.run_id}</p>
                    </div>
                    <StatusPill
                      tone={
                        candidate.promotion_state === "active"
                          ? "success"
                          : candidate.promotion_state === "queued"
                            ? "warning"
                            : "active"
                      }
                    >
                      {candidate.promotion_state}
                    </StatusPill>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="console-pill">{candidate.public_safe_as_is ? "public-safe" : "needs review"}</span>
                    {candidate.artifact_status ? <span className="console-pill">{candidate.artifact_status}</span> : null}
                    {candidate.artifact_type ? <span className="console-pill">{candidate.artifact_type}</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No candidates.</p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function WorkbenchShell({
  apiBase,
  mode,
  modeCards,
  overview,
  developmentView,
  connected,
  operatorNotice,
  onDismissNotice,
  onModeChange,
  growthLatest,
  growthRuns,
  growthLatestRun,
  growthPromotionQueue,
  onVerifyRealityContract,
  verifyingRealityContract,
  canvas,
  dock,
}: {
  apiBase: string;
  mode: ModeKey;
  modeCards: ModeRailCard[];
  overview: WorkbenchOverview;
  developmentView: DevelopmentView;
  connected: boolean;
  operatorNotice: string | null;
  onDismissNotice: () => void;
  onModeChange: (mode: ModeKey) => void;
  growthLatest: GrowthLatestSummary | null;
  growthRuns: GrowthRunSummary[];
  growthLatestRun: GrowthRunBundle | null;
  growthPromotionQueue: GrowthPromotionCandidate[];
  onVerifyRealityContract: () => void;
  verifyingRealityContract: boolean;
  canvas: ReactNode;
  dock: ReactNode;
}) {
  return (
    <main className="workbench-shell" data-mode={mode}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="shell-hero">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={connected ? "success" : "danger"}>{connected ? "stream online" : "stream offline"}</StatusPill>
              <StatusPill tone={overview.activeModeCount > 0 ? "active" : "idle"}>{overview.activeModeCount > 0 ? `${overview.activeModeCount} live` : "idle"}</StatusPill>
              <StatusPill tone={modeCards.find((card) => card.key === mode)?.statusTone ?? "idle"}>{mode}</StatusPill>
            </div>
            <div className="space-y-2">
              <SectionEyebrow>EvolveX</SectionEyebrow>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">AI generation workspace</h1>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SystemStat label="Active loops" value={String(overview.activeModeCount)} />
            <SystemStat label="Artifacts" value={String(overview.artifactCount)} />
            <SystemStat label="Tokens" value={String(overview.protocolTokenCount)} />
            <SystemStat label="Checks" value={String(overview.safetyChecks)} />
          </div>
        </header>

        <section className="mode-selector-grid">
          {modeCards.map((card) => (
            <ModeSelector key={card.key} card={card} active={card.key === mode} onSelect={onModeChange} />
          ))}
        </section>

        {operatorNotice ? (
          <div className="operator-notice">
            <p className="text-sm leading-6 text-amber-950">{operatorNotice}</p>
            <button onClick={onDismissNotice} className="operator-notice-dismiss">
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="development-layout">
          <aside className="space-y-4">
            <Panel kicker="Timeline" title="Recent changes">
              <div className="space-y-3">
                {developmentView.timeline.map((entry) => (
                  <TimelineRow key={entry.id} entry={entry} currentMode={mode} />
                ))}
              </div>
            </Panel>
          </aside>

          <div className="workspace-stack">
            <div className="workspace-summary-grid">
              <Panel kicker={developmentView.eyebrow} title={developmentView.title}>
                <div className="canvas-focus-grid">
                  <div className="focus-card">
                    <SectionEyebrow>Objective</SectionEyebrow>
                    <p className="mt-3 text-base font-medium text-slate-950">{developmentView.objective}</p>
                  </div>
                  <div className="focus-card">
                    <SectionEyebrow>Pressure</SectionEyebrow>
                    <p className="mt-3 text-base font-medium text-slate-950">{developmentView.tension}</p>
                  </div>
                  <div className="focus-card">
                    <SectionEyebrow>Next</SectionEyebrow>
                    <p className="mt-3 text-base font-medium text-slate-950">{developmentView.nextStep}</p>
                  </div>
                </div>
              </Panel>

              <Panel kicker="Run" title="Progress">
                <div className="space-y-4">
                  <ProgressRail
                    label={developmentView.progressLabel}
                    value={developmentView.progressValue}
                    valueLabel={developmentView.progressValueLabel}
                    helper={developmentView.progressHelper}
                  />
                  <ProgressRail
                    label={developmentView.budgetLabel}
                    value={developmentView.budgetPercent ?? 8}
                    valueLabel={developmentView.budgetValue}
                    helper={developmentView.budgetHelper}
                    dimmed={developmentView.budgetPercent === null}
                  />
                </div>
              </Panel>
            </div>

            <Panel kicker="State" title="Metrics">
              <div className="workspace-metrics-grid">
                {developmentView.gauges.map((gauge) => (
                  <GaugeCard key={gauge.label} gauge={gauge} />
                ))}
              </div>
            </Panel>

            <div className="space-y-6">{canvas}</div>

            <div className="workspace-meta-grid">
              <Panel kicker="Capabilities" title="Active and locked">
                <div className="space-y-3">
                  {developmentView.capabilities.map((capability) => (
                    <CapabilityRow key={`${capability.label}-${capability.state}`} {...capability} />
                  ))}
                </div>
              </Panel>

              <Panel kicker="Outputs" title="Current outputs">
                <div className="space-y-3">
                  {developmentView.outputs.map((output) => (
                    <OutputRow key={output.label} label={output.label} value={output.value} />
                  ))}
                </div>
              </Panel>

              <Panel kicker="Constraints" title="Current limits">
                <div className="space-y-3">
                  {developmentView.constraints.map((constraint) => (
                    <div key={constraint} className="constraint-row">
                      <p className="text-sm leading-6 text-slate-700">{constraint}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>

        <section className="utility-stack">
          <UtilityDisclosure title="Registry" count={`${growthPromotionQueue.length} queued`}>
            <GrowthConsole
              apiBase={apiBase}
              growthLatest={growthLatest}
              growthRuns={growthRuns}
              growthLatestRun={growthLatestRun}
              growthPromotionQueue={growthPromotionQueue}
              onVerifyRealityContract={onVerifyRealityContract}
              verifyingRealityContract={verifyingRealityContract}
            />
          </UtilityDisclosure>

          <UtilityDisclosure title="Event log" count={overview.lastTrace ? "Live" : "Idle"}>
            {dock}
          </UtilityDisclosure>
        </section>
      </div>
    </main>
  );
}
