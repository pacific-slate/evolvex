"use client";

import type { ReactNode } from "react";

import { SYSTEM_STORY_STEPS, getModeTheme } from "@/lib/evolvex-format";
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
    <section className={`lab-panel ${className}`}>
      {(kicker || title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {kicker ? <SectionEyebrow>{kicker}</SectionEyebrow> : null}
            {title ? <h2 className="text-balance text-xl font-semibold tracking-tight text-white">{title}</h2> : null}
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
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-white/55">{helper}</p> : null}
    </div>
  );
}

function InspectorBlock({ section }: { section: InspectorSection }) {
  return (
    <Panel kicker={section.kicker} title={section.title}>
      {section.body ? <p className="text-sm leading-7 text-white/72">{section.body}</p> : null}
      {section.bullets ? (
        <div className="space-y-2">
          {section.bullets.map((bullet) => (
            <div key={bullet} className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/72">
              {bullet}
            </div>
          ))}
        </div>
      ) : null}
      {section.items ? (
        <div className="space-y-3">
          {section.items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <span className="section-eyebrow">{item.label}</span>
                <span className="text-right text-sm font-medium text-white">{item.value}</span>
              </div>
              {item.helper ? <p className="mt-2 text-sm leading-6 text-white/55">{item.helper}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
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

  return (
    <main className="workbench-shell" data-mode={mode}>
      <div className="ambient-glow" aria-hidden="true" />
      <div className="ambient-grid" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <Panel className="relative overflow-hidden">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill tone={connected ? "success" : "danger"}>
                  {connected ? "Realtime stream connected" : "Realtime stream disconnected"}
                </StatusPill>
                <span className={`signal-pill ${theme.chip}`}>{definition.label} experiment selected</span>
              </div>
              <div className="space-y-4">
                <SectionEyebrow>Agent Evolution Workbench</SectionEyebrow>
                <h1 className="max-w-4xl text-balance font-display text-4xl uppercase leading-none tracking-[0.08em] text-white md:text-6xl">
                  Design, supervise, and compare autonomous improvement loops.
                </h1>
                <p className="max-w-3xl text-balance text-base leading-8 text-white/70 md:text-lg">
                  EvolveX turns four autonomy regimes into one operator surface: benchmark mutation, adversarial progression,
                  protocol emergence, and autonomous building. The point is not to watch an agent run. The point is to make
                  the safety gates, evidence trail, and behavioral change obvious in under a minute.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overview.metrics.map((metric) => (
                  <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
                ))}
              </div>
            </div>

            <div className={`rounded-[28px] border bg-black/30 p-5 backdrop-blur-sm ${theme.border}`}>
              <SectionEyebrow>Current Experiment Story</SectionEyebrow>
              <h2 className="mt-3 text-balance font-display text-2xl uppercase tracking-[0.08em] text-white">
                {definition.heroTitle}
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">{definition.whatItIs}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {definition.audiences.map((audience) => (
                  <span key={audience} className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                    {audience}
                  </span>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <SectionEyebrow>Latest Signal</SectionEyebrow>
                {overview.lastTrace ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-white">{overview.lastTrace.label}</p>
                      <StatusPill tone={overview.lastTrace.tone}>{overview.lastTrace.mode}</StatusPill>
                    </div>
                    <p className="text-sm leading-6 text-white/65">{overview.lastTrace.summary}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/55">No live trace yet. Start a mode to watch the workbench narrate system behavior.</p>
                )}
              </div>
            </div>
          </div>

          {operatorNotice ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3">
              <p className="text-sm leading-6 text-amber-50">{operatorNotice}</p>
              <button
                onClick={onDismissNotice}
                className="rounded-full border border-amber-300/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-50 transition hover:border-amber-200/40"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 lg:grid-cols-4">
            {SYSTEM_STORY_STEPS.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-4">
                <SectionEyebrow>Workflow {index + 1}</SectionEyebrow>
                <p className="mt-3 text-sm leading-6 text-white/72">{step}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
          <aside className="space-y-4">
            <Panel kicker="Experiment Types" title="Run four autonomy regimes from one rail">
              <div className="space-y-3">
                {modeCards.map((card) => {
                  const cardTheme = getModeTheme(card.key);
                  const active = card.key === mode;
                  return (
                    <button
                      key={card.key}
                      onClick={() => onModeChange(card.key)}
                      className={`mode-rail-card w-full text-left transition ${
                        active ? `${cardTheme.panel} ${cardTheme.border} ring-1 ring-inset ring-white/10` : "border-white/8 bg-white/[0.03] hover:border-white/18"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium tracking-tight text-white">{card.label}</p>
                          <p className="mt-1 text-sm leading-6 text-white/55">{card.strapline}</p>
                        </div>
                        <StatusPill tone={card.statusTone}>{card.isRunning ? "Live" : "Standby"}</StatusPill>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-4">
                        <div>
                          <p className={`text-sm font-medium ${cardTheme.accentText}`}>{card.statusLabel}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">{card.evidenceLabel}</p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.18em] text-white/35">{card.activityCount} signals</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>

          <div className="space-y-6">{canvas}</div>

          <aside className="space-y-4">
            {inspectorSections.map((section) => (
              <InspectorBlock key={section.id} section={section} />
            ))}
          </aside>
        </div>

        {dock}
      </div>
    </main>
  );
}
