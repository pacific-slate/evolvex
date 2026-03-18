"use client";

import { useMemo, useState } from "react";

import { formatBytes, formatCurrency, formatPercent } from "@/lib/evolvex-format";
import type { GrowthSessionController } from "@/hooks/use-growth-session";

import { Panel, SectionEyebrow, StatusPill } from "./workbench-shell";

const PHASES = ["handshake", "artifacts", "context", "build", "verify", "research", "integration", "self_improve"] as const;

function phaseLabel(value: string) {
  return value.replaceAll("_", " ");
}

function statusTone(status: string) {
  if (status === "running") return "active" as const;
  if (status === "completed") return "success" as const;
  if (status.includes("capped")) return "warning" as const;
  if (status === "archived" || status === "failed") return "danger" as const;
  return "muted" as const;
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 rounded-full bg-white/8">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TinyMetric({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
      <SectionEyebrow>{label}</SectionEyebrow>
      <p className="mt-2 text-lg font-semibold tracking-tight text-white">{value}</p>
      {helper ? <p className="mt-1 text-[11px] leading-5 text-white/45">{helper}</p> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-[6rem] flex-col gap-1">
      <SectionEyebrow>{label}</SectionEyebrow>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Math.round(Number(event.target.value) || min))))}
        className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition focus:border-white/25"
      />
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  tone = "primary",
  disabled,
}: {
  children: string;
  onClick: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const style =
    tone === "primary"
      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
      : tone === "danger"
        ? "border-rose-300/20 bg-rose-400/10 text-rose-100 hover:border-rose-200/40"
        : "border-white/12 bg-white/[0.03] text-white/72 hover:border-white/22 hover:text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-xs font-semibold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <SectionEyebrow>{label}</SectionEyebrow>
        <span className="text-sm font-semibold text-white">{value.toFixed(1)}</span>
      </div>
      <div className="mt-3">
        <ProgressBar value={value} color="bg-cyan-300" />
      </div>
    </div>
  );
}

function EventList({ items }: { items: GrowthSessionController["data"]["events"] }) {
  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No live evidence yet.</div>;
  }
  return (
    <div className="space-y-2">
      {items
        .slice(-18)
        .reverse()
        .map((item) => (
          <div key={`${item.ts}-${item.event}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.event.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">{item.source}</p>
              </div>
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                {new Date(item.ts).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}

function ArtifactGroups({ groups }: { groups: GrowthSessionController["data"]["groupedArtifacts"] }) {
  const entries = [...groups.entries()];
  if (entries.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No artifacts captured yet.</div>;
  }
  return (
    <div className="space-y-4">
      {entries.map(([source, files]) => (
        <div key={source} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <SectionEyebrow>{source}</SectionEyebrow>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">{files.length}</span>
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={`${source}-${file.path}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-all text-sm text-white/72">{file.path}</p>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-white/35">{formatBytes(file.size_bytes)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryList({ history }: { history: GrowthSessionController["data"]["scorecardHistory"] }) {
  if (history.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No score history yet.</div>;
  }
  return (
    <div className="space-y-2">
      {history
        .slice(-10)
        .reverse()
        .map((item) => (
          <div key={item.ts} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <SectionEyebrow>{new Date(item.ts).toLocaleTimeString()}</SectionEyebrow>
              <span className="text-sm font-semibold text-white">{item.scorecard.overall.toFixed(1)}</span>
            </div>
            <div className="mt-3">
              <ProgressBar value={item.scorecard.overall} color="bg-cyan-300" />
            </div>
          </div>
        ))}
    </div>
  );
}

export function GrowthWorkspace({ controller }: { controller: GrowthSessionController }) {
  const { session, groupedArtifacts, checkpoints, events, scorecardHistory, archives, running } = controller.data;
  const { budgetCapUsd, setBudgetCapUsd, storageCapMb, setStorageCapMb, targetScore, setTargetScore } = controller.controls;
  const { start, pause, resume, reset, archive } = controller.actions;
  const [tab, setTab] = useState<"mindstate" | "artifacts" | "scorecard" | "events">("mindstate");

  const currentScore = session?.scorecard.overall ?? 0;
  const budgetPct = session ? session.budget.used_usd / Math.max(session.budget.cap_usd, 1) : 0;
  const storagePct = session ? session.storage.used_bytes / Math.max(session.storage.cap_bytes, 1) : 0;
  const timeline = useMemo(
    () =>
      PHASES.map((phase, index) => ({
        id: phase,
        index,
        active: session ? phase === session.phase : phase === "handshake",
        unlocked: session ? index <= session.unlock_state.stage_id || phase === "self_improve" && session.phase === "self_improve" : index === 0,
      })),
    [session],
  );

  return (
    <main className="workbench-shell">
      <div className="ambient-glow" aria-hidden="true" />
      <div className="ambient-grid" aria-hidden="true" />

      <div className="workbench-frame">
        <Panel className="operator-strip">
          <div className="flex flex-wrap items-center gap-2">
            <SectionEyebrow>Growth Session</SectionEyebrow>
            <StatusPill tone={controller.connected ? "success" : "danger"}>{controller.connected ? "stream online" : "stream offline"}</StatusPill>
            <StatusPill tone={statusTone(session?.status ?? "idle")}>{session?.status ?? "idle"}</StatusPill>
            <StatusPill tone="muted">{phaseLabel(session?.phase ?? "handshake")}</StatusPill>
            {session?.completion_state ? <StatusPill tone="muted">{phaseLabel(session.completion_state)}</StatusPill> : null}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="space-y-2">
              <h1 className="text-xl font-display tracking-tight text-white xl:text-2xl">Agent growth environment</h1>
              <p className="max-w-4xl text-sm leading-6 text-white/62">
                {session?.current_objective ?? "Configure the initial envelope, then start the long-running growth session."}
              </p>
              {controller.operatorNotice ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2">
                  <span className="text-xs text-amber-50">{controller.operatorNotice}</span>
                  <button
                    onClick={controller.dismissNotice}
                    className="rounded-full border border-amber-300/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-50 transition hover:border-amber-200/40"
                  >
                    dismiss
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <TinyMetric label="overall" value={currentScore.toFixed(1)} helper="scorecard" />
              <TinyMetric label="budget" value={session ? formatCurrency(session.budget.used_usd) : "$0.00"} helper={session ? `${formatCurrency(session.budget.cap_usd)} cap` : "cap"} />
              <TinyMetric label="storage" value={session ? formatBytes(session.storage.used_bytes) : "0 B"} helper={session ? `${formatBytes(session.storage.cap_bytes)} cap` : "cap"} />
              <TinyMetric label="outputs" value={String(session?.outputs.artifact_count ?? 0)} helper="tracked artifacts" />
            </div>
          </div>
        </Panel>

        <div className="workspace-body">
          <aside className="workspace-rail flex min-h-0 flex-col gap-4">
            <Panel kicker="Lifecycle" title="Development Path" className="min-h-0">
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {timeline.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3 py-3 ${
                      item.active
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : item.unlocked
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-white/6 bg-black/20 text-white/35"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{phaseLabel(item.id)}</p>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        {item.active ? "active" : item.unlocked ? "earned" : "locked"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel kicker="Controls" title="Run Envelope">
              <div className="grid gap-2">
                <NumberField label="budget usd" value={budgetCapUsd} min={1} max={100000} onChange={setBudgetCapUsd} />
                <NumberField label="storage mb" value={storageCapMb} min={1} max={102400} onChange={setStorageCapMb} />
                <NumberField label="target score" value={targetScore} min={50} max={100} onChange={setTargetScore} />
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={start} disabled={running}>
                  {session ? "start / continue" : "start"}
                </ActionButton>
                <ActionButton tone="secondary" onClick={resume} disabled={running || !session || session.status === "completed"}>
                  resume
                </ActionButton>
                <ActionButton tone="secondary" onClick={pause} disabled={!running}>
                  pause
                </ActionButton>
                <ActionButton tone="secondary" onClick={archive} disabled={running || !session}>
                  archive
                </ActionButton>
                <ActionButton tone="danger" onClick={reset} disabled={running}>
                  reset
                </ActionButton>
              </div>
            </Panel>
          </aside>

          <section className="workspace-canvas flex min-h-0 flex-col gap-4">
            <Panel kicker="Canvas" title="Current Session" className="flex-1 min-h-0">
              <div className="flex flex-wrap gap-2 border-b border-white/8 pb-3">
                {[
                  ["mindstate", "mindstate"],
                  ["artifacts", "artifacts"],
                  ["scorecard", "scorecard"],
                  ["events", "event log"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id as typeof tab)}
                    className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
                      tab === id ? "border-white/18 bg-white/12 text-white" : "border-white/8 bg-white/[0.03] text-white/50 hover:text-white/75"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-auto pr-1">
                {tab === "mindstate" ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="space-y-3">
                      <TinyMetric label="objective" value={session?.current_objective ?? "No active objective"} />
                      <TinyMetric label="next gate" value={session?.unlock_state.next_gate ?? "artifacts"} />
                      <TinyMetric label="entrypoint" value={session?.outputs.entrypoint ?? "Not yet produced"} />
                      <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                        <SectionEyebrow>Unlocked Capabilities</SectionEyebrow>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(session?.unlock_state.granted_capabilities ?? []).map((capability) => (
                            <span key={capability} className="signal-pill border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                              {capability}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <SectionEyebrow>Budget Runway</SectionEyebrow>
                          <span className="text-sm font-semibold text-white">
                            {session ? formatPercent(budgetPct, 0) : "0%"}
                          </span>
                        </div>
                        <div className="mt-3">
                          <ProgressBar value={budgetPct * 100} color="bg-amber-300" />
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <SectionEyebrow>Storage Use</SectionEyebrow>
                          <span className="text-sm font-semibold text-white">
                            {session ? formatPercent(storagePct, 0) : "0%"}
                          </span>
                        </div>
                        <div className="mt-3">
                          <ProgressBar value={storagePct * 100} color="bg-emerald-300" />
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                        <SectionEyebrow>Session Identity</SectionEyebrow>
                        <p className="mt-2 break-all text-sm text-white/72">{session?.session_id ?? "No active session"}</p>
                        <p className="mt-2 text-xs leading-5 text-white/45">
                          Created {session ? new Date(session.created_at).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "artifacts" ? <ArtifactGroups groups={groupedArtifacts} /> : null}

                {tab === "scorecard" ? (
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="grid gap-3 md:grid-cols-2">
                      <ScoreBar label="logic" value={session?.scorecard.logic ?? 0} />
                      <ScoreBar label="autonomy" value={session?.scorecard.autonomy ?? 0} />
                      <ScoreBar label="artifact quality" value={session?.scorecard.artifact_quality ?? 0} />
                      <ScoreBar label="verification" value={session?.scorecard.verification ?? 0} />
                      <ScoreBar label="stability" value={session?.scorecard.stability ?? 0} />
                      <ScoreBar label="efficiency" value={session?.scorecard.efficiency ?? 0} />
                    </div>
                    <HistoryList history={scorecardHistory} />
                  </div>
                ) : null}

                {tab === "events" ? <EventList items={events} /> : null}
              </div>
            </Panel>
          </section>

          <aside className="workspace-inspector flex min-h-0 flex-col gap-4">
            <Panel kicker="Outputs" title="Tangible State">
              <div className="space-y-3 overflow-auto pr-1">
                <TinyMetric label="entrypoint" value={session?.outputs.entrypoint ?? "Not yet produced"} />
                <TinyMetric label="artifacts" value={String(session?.outputs.artifact_count ?? 0)} />
                <TinyMetric label="checkpoints" value={String(session?.outputs.checkpoint_count ?? 0)} />
                <TinyMetric label="tests" value={session?.outputs.has_tests ? "present" : "missing"} />
                <TinyMetric label="build log" value={session?.outputs.has_build_log ? "present" : "missing"} />
              </div>
            </Panel>

            <Panel kicker="Recovery" title="Checkpoints">
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {checkpoints.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No checkpoints recorded yet.</div>
                ) : (
                  checkpoints.map((checkpoint) => (
                    <div key={`${checkpoint.scope}-${checkpoint.path}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{checkpoint.scope}</p>
                        <StatusPill tone={checkpoint.exists ? "success" : "danger"}>{checkpoint.exists ? "present" : "missing"}</StatusPill>
                      </div>
                      <p className="mt-2 break-all text-xs leading-5 text-white/45">{checkpoint.path}</p>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel kicker="Lineage" title="Recent Archives">
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {archives.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/45">No archived sessions yet.</div>
                ) : (
                  archives.map((item) => (
                    <div key={item.session_id} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.session_id}</p>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{item.status}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/45">
                        {item.archived_at ? new Date(item.archived_at).toLocaleString() : "Unarchived"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
