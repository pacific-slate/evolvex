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

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="metric-card">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p> : null}
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

function SystemStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="system-stat">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function DevelopmentChip({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  return (
    <div className="development-chip">
      <p className="section-eyebrow">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <StatusPill tone={tone}>{value}</StatusPill>
      </div>
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
        <p className={`text-sm font-medium ${active ? "text-slate-950" : "text-slate-700"}`}>{card.statusLabel}</p>
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.activityCount} signals</span>
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
  helper: string;
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
      <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p>
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
      <p className="mt-3 text-sm leading-6 text-slate-600">{gauge.helper}</p>
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

function OutputCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="output-card">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
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
        <p className="mt-1 text-sm leading-6 text-slate-600">{helper}</p>
      </div>
      <StatusPill tone={tone}>{state}</StatusPill>
    </div>
  );
}

function UtilityDisclosure({
  title,
  summary,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
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
          <p className="mt-1 text-sm text-slate-600">{summary}</p>
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

function RegistryStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="console-card">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-3 font-mono text-2xl text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
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
  const candidateTitle = growthLatest?.top_candidate?.title ?? growthPromotionQueue[0]?.title ?? "No candidate yet";
  const queueTone: StatusTone = growthPromotionQueue.length ? "active" : "idle";

  return (
    <Panel
      className="console-panel"
      kicker="Reality Registry"
      title="Truth gate, durable growth runs, and promotion readiness"
      actions={
        <button
          onClick={onVerifyRealityContract}
          disabled={verifyingRealityContract}
          className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyingRealityContract ? "Running truth gate" : "Run truth gate"}
        </button>
      }
    >
      <div className="console-toolbar">
        <span className="console-pill">Workspace `post-submission-dev`</span>
        <span className="console-pill">API {apiBase}</span>
        <span className="console-pill">Latest run {growthLatest?.latest_run_id ?? "none"}</span>
        <span className="console-pill">Queue {growthPromotionQueue.length}</span>
        <span className="console-pill">Top candidate {candidateTitle}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <div className="console-block">
            <div className="console-block-header">
              <SectionEyebrow>Registry HUD</SectionEyebrow>
              <StatusPill tone={growthLatest?.latest_run_id ? "success" : "warning"}>
                {growthLatest?.latest_run_id ? "Seeded" : "Empty"}
              </StatusPill>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RegistryStat label="Frontier Signals" value={String(counts?.frontier_signals ?? 0)} helper="Validated external and local signals." />
              <RegistryStat label="Growth Artifacts" value={String(counts?.growth_artifacts ?? 0)} helper="Durable outputs available for review." />
              <RegistryStat label="Claim Checks" value={String(counts?.claim_checks ?? 0)} helper="Narrative and route checks verified against the repo." />
              <RegistryStat label="Promotion Queue" value={String(counts?.promotion_candidates ?? 0)} helper="Candidates ready for operator review." />
            </div>
          </div>

          <div className="console-block">
            <div className="console-block-header">
              <SectionEyebrow>Run Explorer</SectionEyebrow>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{growthRuns.length} tracked</span>
            </div>
            <div className="space-y-2">
              {growthRuns.length ? (
                growthRuns.map((run) => (
                  <div key={run.run_id} className="console-list-row">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-slate-950">{run.run_id}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{formatTimestamp(run.updated_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-700">{run.top_candidate?.title ?? "No candidate"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {run.counts.growth_artifacts} artifacts / {run.counts.promotion_candidates} queued
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-600">No durable runs yet. Seed the registry or complete a Genesis build to populate this explorer.</p>
              )}
            </div>
          </div>
        </div>

        <div className="console-block">
          <div className="console-block-header">
            <SectionEyebrow>Latest Run Detail</SectionEyebrow>
            <StatusPill tone={growthLatestRun ? "active" : "idle"}>{growthLatestRun ? growthLatestRun.run_id : "No run loaded"}</StatusPill>
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
                    <p className="mt-3 text-sm leading-6 text-slate-600">{artifact.repo_gap}</p>
                  </div>
                ))}
              </div>

              <div className="console-card">
                <div className="console-block-header">
                  <SectionEyebrow>Claim Status</SectionEyebrow>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{growthLatestRun.records.claim_checks.length} checks</span>
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
            <p className="text-sm leading-7 text-slate-600">The latest run bundle will appear here once the registry is seeded or Genesis records a completed workspace snapshot.</p>
          )}
        </div>

        <div className="console-block">
          <div className="console-block-header">
            <SectionEyebrow>Promotion Queue</SectionEyebrow>
            <StatusPill tone={queueTone}>{growthPromotionQueue.length ? "Actionable" : "Idle"}</StatusPill>
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
                  <p className="mt-3 text-sm leading-6 text-slate-700">{candidate.why_it_matters}</p>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{candidate.evidence}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="console-pill">{candidate.public_safe_as_is ? "public-safe" : "needs review"}</span>
                    {candidate.artifact_status ? <span className="console-pill">artifact {candidate.artifact_status}</span> : null}
                    {candidate.artifact_type ? <span className="console-pill">{candidate.artifact_type}</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-slate-600">No queued promotions yet. The registry will surface candidates here when new durable outputs land.</p>
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
              <StatusPill tone={connected ? "success" : "danger"}>{connected ? "Realtime stream online" : "Realtime stream offline"}</StatusPill>
              <StatusPill tone={overview.activeModeCount > 0 ? "active" : "idle"}>
                {overview.activeModeCount > 0 ? `${overview.activeModeCount} loops live` : "Idle lab"}
              </StatusPill>
            </div>
            <div className="space-y-3">
              <SectionEyebrow>EvolveX Development Chamber</SectionEyebrow>
              <h1 className="max-w-5xl text-balance text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Observe one evolving system through its current mindstate, constraints, and tangible output.
              </h1>
              <p className="max-w-3xl text-balance text-base leading-8 text-slate-600 md:text-lg">
                The default surface answers what the agent is doing now, what it is trying to become next, what just changed,
                and what pressure is shaping it. The full workspace, truth gate, and raw trace stay available, but they no
                longer compete with the main story.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SystemStat label="Active loops" value={String(overview.activeModeCount)} helper="Modes currently executing." />
            <SystemStat label="Artifacts tracked" value={String(overview.artifactCount)} helper="Visible outputs across live and durable runs." />
            <SystemStat label="Protocol tokens" value={String(overview.protocolTokenCount)} helper="Emergent language across Arena and Bootstrap." />
            <SystemStat label="Safety checks" value={String(overview.safetyChecks)} helper="Classic sandbox decisions captured in the trace." />
          </div>
        </header>

        <section className="mode-selector-grid">
          {modeCards.map((card) => (
            <ModeSelector key={card.key} card={card} active={card.key === mode} onSelect={onModeChange} />
          ))}
        </section>

        <section className="development-chip-grid">
          {developmentView.headerChips.map((chip) => (
            <DevelopmentChip key={`${chip.label}-${chip.value}`} label={chip.label} value={chip.value} tone={chip.tone} />
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
            <Panel kicker="Growth Timeline" title="What changed most recently" className="h-full">
              <div className="space-y-3">
                {developmentView.timeline.map((entry) => (
                  <TimelineRow key={entry.id} entry={entry} currentMode={mode} />
                ))}
              </div>
            </Panel>
          </aside>

          <div className="space-y-6">
            <Panel kicker={developmentView.eyebrow} title={developmentView.title} className="cognitive-canvas">
              <p className="max-w-4xl text-base leading-8 text-slate-700">{developmentView.summary}</p>

              <div className="canvas-focus-grid">
                <div className="focus-card">
                  <SectionEyebrow>Current objective</SectionEyebrow>
                  <p className="mt-3 text-base font-medium text-slate-950">{developmentView.objective}</p>
                </div>
                <div className="focus-card">
                  <SectionEyebrow>Current tension</SectionEyebrow>
                  <p className="mt-3 text-base font-medium text-slate-950">{developmentView.tension}</p>
                </div>
                <div className="focus-card">
                  <SectionEyebrow>Next useful observation</SectionEyebrow>
                  <p className="mt-3 text-base font-medium text-slate-950">{developmentView.nextStep}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
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

              <div className="grid gap-3 xl:grid-cols-3">
                {developmentView.gauges.map((gauge) => (
                  <GaugeCard key={gauge.label} gauge={gauge} />
                ))}
              </div>

              {developmentView.changed ? (
                <div className="latest-shift-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <SectionEyebrow>Latest shift</SectionEyebrow>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{developmentView.changed.label}</p>
                    </div>
                    <StatusPill tone={developmentView.changed.tone}>{new Date(developmentView.changed.ts).toLocaleTimeString()}</StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{developmentView.changed.summary}</p>
                </div>
              ) : null}
            </Panel>

            <Panel kicker="Tangible Output" title="What this run is leaving behind">
              <div className="grid gap-3 xl:grid-cols-3">
                {developmentView.outputs.map((output) => (
                  <OutputCard key={output.label} label={output.label} value={output.value} helper={output.helper} />
                ))}
              </div>
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel kicker="State Inspector" title="Current state and live pressures">
              <div className="space-y-3">
                {developmentView.stateItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="inspector-row">
                    <div className="flex items-start justify-between gap-4">
                      <span className="section-eyebrow">{item.label}</span>
                      <span className="text-right text-sm font-medium text-slate-950">{item.value}</span>
                    </div>
                    {item.helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.helper}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel kicker="Capability Surface" title="What is active versus withheld">
              <div className="space-y-3">
                {developmentView.capabilities.map((capability) => (
                  <CapabilityRow key={`${capability.label}-${capability.state}`} {...capability} />
                ))}
              </div>
            </Panel>

            <Panel kicker="Constraints" title="What is shaping the agent right now">
              <div className="space-y-3">
                {developmentView.constraints.map((constraint) => (
                  <div key={constraint} className="constraint-row">
                    <p className="text-sm leading-6 text-slate-700">{constraint}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </div>

        <section className="utility-stack">
          <UtilityDisclosure
            title="Detailed workspace"
            summary="Run controls, full mode telemetry, and artifact views."
            count={`${mode} lens`}
          >
            <div className="space-y-6">{canvas}</div>
          </UtilityDisclosure>

          <UtilityDisclosure
            title="Reality registry"
            summary="Truth gate execution, durable growth runs, and promotion readiness."
            count={`${growthPromotionQueue.length} queued`}
          >
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

          <UtilityDisclosure
            title="Trace dock"
            summary="Raw narrated activity for the current mode or the entire system."
            count={overview.lastTrace ? "Live" : "Idle"}
          >
            {dock}
          </UtilityDisclosure>
        </section>
      </div>
    </main>
  );
}
