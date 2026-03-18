"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { EvolvexDashboardController } from "@/hooks/use-evolvex-dashboard";

import { Panel, SectionEyebrow, StatusPill } from "./workbench-shell";

type DockScope = "current" | "all";

export function EventDock({ dashboard }: { dashboard: EvolvexDashboardController }) {
  const [scope, setScope] = useState<DockScope>("current");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const trace = useMemo(
    () => (scope === "current" ? dashboard.derived.currentTrace : dashboard.derived.allTrace),
    [dashboard.derived.allTrace, dashboard.derived.currentTrace, scope],
  );

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [trace]);

  return (
    <Panel
      kicker="Live Trace Dock"
      title="The workbench narrative"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setScope("current")}
            className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
              scope === "current" ? "border border-white/18 bg-white/10 text-white" : "border border-white/10 bg-transparent text-white/45 hover:text-white/75"
            }`}
          >
            Current mode
          </button>
          <button
            onClick={() => setScope("all")}
            className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
              scope === "all" ? "border border-white/18 bg-white/10 text-white" : "border border-white/10 bg-transparent text-white/45 hover:text-white/75"
            }`}
          >
            All activity
          </button>
          <button
            onClick={dashboard.actions.clearEvents}
            className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/55 transition hover:border-white/25 hover:text-white"
          >
            Clear trace
          </button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/8 bg-black/20 p-5">
          <SectionEyebrow>Why this is a tool</SectionEyebrow>
          <p className="mt-3 text-sm leading-7 text-white/72">
            EvolveX is not just showing an agent run. It is recording the operator evidence needed to supervise autonomy:
            mutation safety, protocol formation, artifact growth, stage progression, and cost.
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <span className="section-eyebrow">Scope</span>
              <p className="mt-2 text-sm text-white/80">{scope === "current" ? `${dashboard.mode} signals only` : "Cross-mode activity"}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <span className="section-eyebrow">Entries</span>
              <p className="mt-2 text-sm text-white/80">{trace.length} trace rows in view</p>
            </div>
          </div>
        </div>

        <div ref={scrollerRef} className="trace-shell max-h-[32rem] overflow-auto rounded-[28px] border border-white/8 bg-black/20 p-4">
          {trace.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] p-8">
              <div className="max-w-2xl text-center">
                <SectionEyebrow>Ready To Observe</SectionEyebrow>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">Start any experiment to turn the dock into a narrated evidence stream.</h3>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  The dock turns backend payloads into readable operational signals. Instead of raw JSON, judges see what changed, why it matters, and which mode produced it.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {trace.map((entry) => (
                <div key={`${entry.ts}-${entry.event}-${entry.summary}`} className="trace-row">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-medium text-white">{entry.label}</p>
                      <StatusPill tone={entry.tone}>{entry.mode}</StatusPill>
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">{new Date(entry.ts).toLocaleTimeString()}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/65">{entry.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
