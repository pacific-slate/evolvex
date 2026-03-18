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
  const bootstrapCard = modeCards.find((card) => card.key === "bootstrap");
  const supportingCards = modeCards.filter((card) => card.key !== "bootstrap");
  const selectedModeIsBootstrap = mode === "bootstrap";
  const latestSignal = overview.lastTrace;

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
                <span className={`signal-pill ${selectedModeIsBootstrap ? theme.chip : "border-white/10 bg-white/5 text-white/70"}`}>
                  {selectedModeIsBootstrap ? "Hero mode selected" : `${definition.label} support view`}
                </span>
              </div>
              <div className="space-y-4">
                <SectionEyebrow>Bootstrap Workbench</SectionEyebrow>
                <h1 className="max-w-4xl text-balance font-display text-4xl uppercase leading-none tracking-[0.08em] text-white md:text-6xl">
                  Watch two agents figure out how to coordinate before they are trusted with real power.
                </h1>
                <p className="max-w-3xl text-balance text-base leading-8 text-white/70 md:text-lg">
                  Most agent demos start with full tool access and a lot of optimism. Bootstrap does the opposite. Two peer
                  agents begin with messaging and scratch space only, then earn stronger capabilities as they form a shared
                  protocol, produce artifacts, and survive review.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overview.metrics.map((metric) => (
                  <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
                ))}
              </div>
            </div>

            <div className={`rounded-[28px] border bg-black/30 p-5 backdrop-blur-sm ${selectedModeIsBootstrap ? theme.border : "border-white/10"}`}>
              <SectionEyebrow>{selectedModeIsBootstrap ? "Why this is the demo" : "Supporting regime"}</SectionEyebrow>
              <h2 className="mt-3 text-balance font-display text-2xl uppercase tracking-[0.08em] text-white">
                {selectedModeIsBootstrap ? "The point is to see whether coordination actually forms." : `${definition.label} is here as a comparison mode.`}
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                {selectedModeIsBootstrap
                  ? "Bootstrap is the product story for the turn-in: staged capability unlocks, brokered actions, protocol emergence, and artifacts that stay inspectable after the run."
                  : `${definition.whatItIs} It matters because it gives Bootstrap a baseline or comparison point instead of making the whole site feel like one random pile of tabs.`}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {(selectedModeIsBootstrap ? ["turn-in hero", "live operator evidence", "earned autonomy"] : definition.audiences).map((audience) => (
                  <span key={audience} className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                    {audience}
                  </span>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <SectionEyebrow>{selectedModeIsBootstrap ? "Latest Signal" : "Current View"}</SectionEyebrow>
                {latestSignal ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-white">{latestSignal.label}</p>
                      <StatusPill tone={latestSignal.tone}>{latestSignal.mode}</StatusPill>
                    </div>
                    <p className="text-sm leading-6 text-white/65">{latestSignal.summary}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/55">
                    No live trace yet. Start Bootstrap and the page will shift from thesis to evidence.
                  </p>
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
                <SectionEyebrow>Watch {index + 1}</SectionEyebrow>
                <p className="mt-3 text-sm leading-6 text-white/72">{step}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
          <aside className="space-y-4">
            <Panel kicker="Experiment Rail" title="Hero mode first, supporting regimes second">
              <div className="space-y-3">
                {bootstrapCard ? (() => {
                  const cardTheme = getModeTheme(bootstrapCard.key);
                  const active = bootstrapCard.key === mode;
                  return (
                    <button
                      key={bootstrapCard.key}
                      onClick={() => onModeChange(bootstrapCard.key)}
                      className={`mode-rail-card w-full text-left transition ${
                        active ? `${cardTheme.panel} ${cardTheme.border} ring-1 ring-inset ring-white/10` : "border-white/8 bg-white/[0.03] hover:border-white/18"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium tracking-tight text-white">{bootstrapCard.label}</p>
                            <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-sky-100">
                              Hero
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-white/55">{bootstrapCard.strapline}</p>
                        </div>
                        <StatusPill tone={bootstrapCard.statusTone}>{bootstrapCard.isRunning ? "Live" : "Standby"}</StatusPill>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-4">
                        <div>
                          <p className={`text-sm font-medium ${cardTheme.accentText}`}>{bootstrapCard.statusLabel}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">{bootstrapCard.evidenceLabel}</p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.18em] text-white/35">{bootstrapCard.activityCount} signals</span>
                      </div>
                    </button>
                  );
                })() : null}
                <div className="pt-2">
                  <SectionEyebrow>Supporting Experiments</SectionEyebrow>
                </div>
                {supportingCards.map((card) => {
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
                        <StatusPill tone={card.statusTone}>{card.isRunning ? "Live" : "Support"}</StatusPill>
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
