export type GrowthScorecard = {
  logic: number;
  autonomy: number;
  artifact_quality: number;
  verification: number;
  stability: number;
  efficiency: number;
  overall: number;
};

export type GrowthBudget = {
  cap_usd: number;
  used_usd: number;
  remaining_usd: number;
};

export type GrowthStorage = {
  cap_bytes: number;
  used_bytes: number;
  remaining_bytes: number;
};

export type GrowthUnlockState = {
  stage_id: number;
  stage: string;
  granted_capabilities: string[];
  next_gate: string;
};

export type GrowthOutputs = {
  entrypoint?: string | null;
  artifact_count?: number;
  checkpoint_count?: number;
  has_build_log?: boolean;
  has_protocol?: boolean;
  has_readme?: boolean;
  has_tests?: boolean;
};

export type GrowthSessionRecord = {
  session_id: string;
  is_active: boolean;
  status: string;
  phase: string;
  current_objective: string;
  model: string | null;
  budget: GrowthBudget;
  storage: GrowthStorage;
  target_score: number;
  sustained_window: number;
  sustained_hits: number;
  bootstrap_round: number;
  genesis_iterations: number;
  stall_count: number;
  completion_state: string;
  last_error: string | null;
  scorecard: GrowthScorecard;
  unlock_state: GrowthUnlockState;
  outputs: GrowthOutputs;
  summary: Record<string, unknown>;
  archive_reason: string | null;
  archive_path: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
};

export type GrowthArtifactRecord = {
  source: string;
  workspace: string;
  path: string;
  size_bytes: number;
  recorded_at: string;
};

export type GrowthCheckpointRecord = {
  scope: string;
  path: string;
  exists: boolean;
  recorded_at: string;
};

export type GrowthEventRecord = {
  ts: string;
  event: string;
  source: string;
  data: Record<string, unknown>;
};

export type GrowthScorecardHistory = {
  ts: string;
  scorecard: GrowthScorecard;
};

export type GrowthSessionPayload = {
  running: boolean;
  session: GrowthSessionRecord | null;
  artifacts: GrowthArtifactRecord[];
  checkpoints: GrowthCheckpointRecord[];
  events: GrowthEventRecord[];
  scorecard_history: GrowthScorecardHistory[];
};
