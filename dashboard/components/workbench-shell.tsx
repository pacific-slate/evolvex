"use client";

import type { ReactNode } from "react";

import { getModeTheme } from "@/lib/evolvex-format";
import type {
  InspectorSection,
  ModeDefinition,
  ModeKey,
  ModeRailCard,
  StatusTone,
  WorkbenchOverview,
} from "@/lib/evolvex-types";

const TONE_STYLES: Record<StatusTone, string> = {
  idle: "border-white/10 bg-white/5 text-white/70",
  active: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  danger: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  muted: "border-white/10 bg-white/5 text-white/65",
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
    <section className={`lab-panel min-w-0 ${className}`}>
      {(kicker || title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {kicker ? <SectionEyebrow>{kicker}</SectionEyebrow> : null}
            {title ? <h2 className="text-balance text-base font-semibold tracking-tight text-white">{title}</h2> : null}
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
    <div className="metric-card min-w-0">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-white">{value}</p>
      {helper ? <p className="mt-1 text-xs leading-5 text-white/55">{helper}</p> : null}
    </div>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[8.5rem] rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <p className="section-eyebrow">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

export function WorkbenchShell({
  mode,
  modeCards,
  overview,
  definition,
  connected,
  operatorNotice,
  onDismissNotice,
  onModeChange,
  inspectorSections,
  canvas,
  dock,
}: {
  mode: ModeKey;
  modeCards: ModeRailCard[];
  overview: WorkbenchOverview;
  definition: ModeDefinition;
  connected: boolean;
  operatorNotice: string | null;
  onDismissNotice: () => void;
  onModeChange: (mode: ModeKey) => void;
  inspectorSections: InspectorSection[];
  canvas: ReactNode;
  dock: ReactNode;
}) {
  const theme = getModeTheme(mode);
  const activeCard = modeCards.find((card) => card.key === mode) ?? modeCards[0];
  const latestSignal = overview.lastTrace;
  const liveItems = inspectorSections.flatMap((section) => section.items ?? []);

  return (
    <main className="workbench-shell" data-mode={mode}>
      <div className="ambient-glow" aria-hidden="true" />
      <div className="ambient-grid" aria-hidden="true" />

      <div className="workbench-frame">
        <Panel className="operator-strip">
          <div className="flex flex-wrap items-center gap-2">
            <SectionEyebrow>EvolveX Workspace</SectionEyebrow>
            <StatusPill tone={connected ? "success" : "danger"}>{connected ? "stream online" : "stream offline"}</StatusPill>
            <span className={`signal-pill ${theme.chip}`}>{definition.label}</span>
            <span className="signal-pill border-white/10 bg-white/5 text-white/60">{activeCard.statusLabel}</span>
            <span className="signal-pill border-white/10 bg-white/5 text-white/60">{activeCard.evidenceLabel}</span>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(42rem,0.9fr)] xl:items-start">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-display tracking-tight text-white xl:text-2xl">AI generation workspace</h1>
                <span className="text-sm text-white/48">{definition.strapline}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SectionEyebrow>Signal</SectionEyebrow>
                <p className="min-w-0 text-sm text-white/65">
                  {latestSignal ? `${latestSignal.label}: ${latestSignal.summary}` : "No activity yet."}
                </p>
              </div>

              {operatorNotice ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2">
                  <span className="text-xs text-amber-50">{operatorNotice}</span>
                  <button
                    onClick={onDismissNotice}
                    className="rounded-full border border-amber-300/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-50 transition hover:border-amber-200/40"
                  >
                    dismiss
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              {overview.metrics.map((metric) => (
                <HeaderMetric key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>
          </div>
        </Panel>

        <div className="workspace-body">
          <aside className="workspace-rail flex min-h-0 flex-col">
            <Panel kicker="Modes" title="Experiments" className="h-full">
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {modeCards.map((card) => {
                  const cardTheme = getModeTheme(card.key);
                  const active = card.key === mode;
                  return (
                    <button
                      key={card.key}
                      onClick={() => onModeChange(card.key)}
                      className={`mode-rail-card w-full text-left transition ${
                        active ? `${cardTheme.panel} ${cardTheme.border} ring-1 ring-inset ring-white/12` : "border-white/8 bg-white/[0.03] hover:border-white/18"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium tracking-tight text-white">{card.label}</p>
                          <p className="mt-1 text-xs leading-5 text-white/48">{card.strapline}</p>
                        </div>
                        <StatusPill tone={card.statusTone}>{card.isRunning ? "live" : "idle"}</StatusPill>
                      </div>
                      <div className="mt-3">
                        <p className={`text-xs font-medium ${cardTheme.accentText}`}>{card.statusLabel}</p>
                        <div className="mt-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-white/35">
                          <span>{card.evidenceLabel}</span>
                          <span>{card.activityCount}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>

          <section className="workspace-canvas flex min-h-0 flex-col">{canvas}</section>

          <aside className="workspace-inspector flex min-h-0 flex-col">
            <Panel kicker="Inspector" title={definition.label} className="h-full">
              <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                <div className={`rounded-2xl border px-4 py-3 ${theme.border} ${theme.panel}`}>
                  <div className="flex items-center justify-between gap-3">
                    <SectionEyebrow>Status</SectionEyebrow>
                    <StatusPill tone={activeCard.statusTone}>{activeCard.statusTone}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{activeCard.statusLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-white/55">{activeCard.evidenceLabel}</p>
                </div>

                {latestSignal ? (
                  <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                    <SectionEyebrow>Recent</SectionEyebrow>
                    <p className="mt-2 text-sm font-medium text-white">{latestSignal.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/55">{latestSignal.summary}</p>
                  </div>
                ) : null}

                {liveItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                    <SectionEyebrow>{item.label}</SectionEyebrow>
                    <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
                    {item.helper ? <p className="mt-1 text-xs leading-5 text-white/48">{item.helper}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </div>

        <div className="workspace-dock flex h-[10rem] min-h-0 flex-col">{dock}</div>
      </div>
    </main>
  );
}
