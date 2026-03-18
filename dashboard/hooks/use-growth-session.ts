"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRuntimeConfig } from "@/lib/runtime";
import type {
  GrowthArtifactRecord,
  GrowthCheckpointRecord,
  GrowthEventRecord,
  GrowthScorecardHistory,
  GrowthSessionPayload,
  GrowthSessionRecord,
} from "@/lib/growth-types";

type JsonWithError = { error?: string };

type GrowthArchivePayload = {
  sessions?: GrowthSessionRecord[];
};

const EMPTY_PAYLOAD: GrowthSessionPayload = {
  running: false,
  session: null,
  artifacts: [],
  checkpoints: [],
  events: [],
  scorecard_history: [],
};

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(input, init);
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function useGrowthSession() {
  const runtime = useMemo(() => getRuntimeConfig(), []);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connected, setConnected] = useState(false);
  const [operatorNotice, setOperatorNotice] = useState<string | null>(null);
  const [payload, setPayload] = useState<GrowthSessionPayload>(EMPTY_PAYLOAD);
  const [archives, setArchives] = useState<GrowthSessionRecord[]>([]);
  const [budgetCapUsd, setBudgetCapUsd] = useState(100);
  const [storageCapMb, setStorageCapMb] = useState(250);
  const [targetScore, setTargetScore] = useState(84);

  const refresh = useCallback(async () => {
    const [sessionData, archiveData] = await Promise.all([
      readJson<GrowthSessionPayload>(`${runtime.apiBase}/api/growth/session`),
      readJson<GrowthArchivePayload>(`${runtime.apiBase}/api/growth/archive`),
    ]);

    if (sessionData) {
      setPayload({
        running: Boolean(sessionData.running),
        session: sessionData.session ?? null,
        artifacts: sessionData.artifacts ?? [],
        checkpoints: sessionData.checkpoints ?? [],
        events: sessionData.events ?? [],
        scorecard_history: sessionData.scorecard_history ?? [],
      });
      if (sessionData.session) {
        setBudgetCapUsd(Math.round(sessionData.session.budget.cap_usd));
        setStorageCapMb(Math.max(1, Math.round(sessionData.session.storage.cap_bytes / (1024 * 1024))));
        setTargetScore(Math.round(sessionData.session.target_score));
      }
      setOperatorNotice(null);
    }

    if (archiveData?.sessions) {
      setArchives(archiveData.sessions);
    }
  }, [runtime.apiBase]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      startTransition(() => {
        void refresh();
      });
    }, 180);
  }, [refresh]);

  const post = useCallback(
    async <T extends JsonWithError>(path: string, body?: Record<string, unknown>) => {
      const response = await readJson<T>(`${runtime.apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response) {
        setOperatorNotice(`Request failed for ${path}.`);
        return null;
      }
      if (response.error) {
        setOperatorNotice(response.error);
        return response;
      }
      setOperatorNotice(null);
      scheduleRefresh();
      return response;
    },
    [runtime.apiBase, scheduleRefresh],
  );

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(runtime.wsUrl);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        if (disposed) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      socket.onmessage = (message) => {
        const parsed = JSON.parse(message.data) as { event?: string; data?: Record<string, unknown> };
        if (parsed.event?.includes("error")) {
          const maybeMessage = parsed.data?.message;
          if (typeof maybeMessage === "string") setOperatorNotice(maybeMessage);
        }
        scheduleRefresh();
      };
    };

    connect();
    void refresh();

    return () => {
      disposed = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [refresh, runtime.wsUrl, scheduleRefresh]);

  const session = payload.session;
  const artifacts = payload.artifacts;
  const checkpoints = payload.checkpoints;
  const events = payload.events;
  const history = payload.scorecard_history;

  const groupedArtifacts = useMemo(() => {
    const groups = new Map<string, GrowthArtifactRecord[]>();
    for (const item of artifacts) {
      const next = groups.get(item.source) ?? [];
      next.push(item);
      groups.set(item.source, next);
    }
    return groups;
  }, [artifacts]);

  const recentArchives = useMemo(() => archives.slice(0, 8), [archives]);

  const pause = useCallback(() => post("/api/growth/session/pause"), [post]);
  const resume = useCallback(() => post("/api/growth/session/resume"), [post]);
  const archive = useCallback(() => post("/api/growth/session/archive"), [post]);
  const reset = useCallback(() => post("/api/growth/session/reset"), [post]);
  const start = useCallback(
    () =>
      post("/api/growth/session/start", {
        budget_cap_usd: budgetCapUsd,
        storage_cap_bytes: storageCapMb * 1024 * 1024,
        target_score: targetScore,
      }),
    [budgetCapUsd, post, storageCapMb, targetScore],
  );

  return {
    connected,
    operatorNotice,
    dismissNotice: () => setOperatorNotice(null),
    refresh,
    data: {
      session,
      running: payload.running,
      artifacts,
      groupedArtifacts,
      checkpoints,
      events,
      scorecardHistory: history,
      archives: recentArchives,
    },
    controls: {
      budgetCapUsd,
      setBudgetCapUsd,
      storageCapMb,
      setStorageCapMb,
      targetScore,
      setTargetScore,
    },
    actions: {
      start,
      pause,
      resume,
      reset,
      archive,
    },
  };
}

export type GrowthSessionController = ReturnType<typeof useGrowthSession>;

export type GrowthWorkspaceData = {
  session: GrowthSessionRecord | null;
  running: boolean;
  artifacts: GrowthArtifactRecord[];
  groupedArtifacts: Map<string, GrowthArtifactRecord[]>;
  checkpoints: GrowthCheckpointRecord[];
  events: GrowthEventRecord[];
  scorecardHistory: GrowthScorecardHistory[];
  archives: GrowthSessionRecord[];
};
