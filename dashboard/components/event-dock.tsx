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
      className="h-full"
      kicker="Live Trace Dock"
      title="Event log"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setScope("current")}
            className={`w-full rounded-full px-3 py-2 text-xs uppercase tracking-[0.18em] transition sm:w-auto ${
              scope === "current" ? "border border-white/18 bg-white/10 text-white" : "border border-white/10 bg-transparent text-white/45 hover:text-white/75"
            }`}
          >
            Current mode
          </button>
          <button
            onClick={() => setScope("all")}
            className={`w-full rounded-full px-3 py-2 text-xs uppercase tracking-[0.18em] transition sm:w-auto ${
              scope === "all" ? "border border-white/18 bg-white/10 text-white" : "border border-white/10 bg-transparent text-white/45 hover:text-white/75"
            }`}
          >
            All activity
          </button>
          <button
            onClick={dashboard.actions.clearEvents}
            className="w-full rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/55 transition hover:border-white/25 hover:text-white sm:w-auto"
          >
            Clear trace
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/55">
        <span className="signal-pill border-white/10 bg-white/5 text-white/65">
          {scope === "current" ? `${dashboard.mode} signals` : "Cross-mode activity"}
        </span>
        <span className="signal-pill border-white/10 bg-white/5 text-white/65">{trace.length} entries</span>
      </div>

      <div ref={scrollerRef} className="trace-shell min-h-0 flex-1 overflow-auto rounded-[1.25rem] border border-white/8 bg-black/20 p-3">
        {trace.length === 0 ? (
          <div className="grid h-full min-h-[5rem] place-items-center rounded-[1rem] border border-dashed border-white/10 bg-white/[0.025] p-4">
            <div className="max-w-2xl text-center">
              <SectionEyebrow>Ready To Observe</SectionEyebrow>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">Start a mode to populate the event log.</h3>
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
    </Panel>
  );
}
