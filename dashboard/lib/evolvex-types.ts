export type ModeKey = "classic" | "arena" | "bootstrap" | "genesis";

export type StatusTone = "idle" | "active" | "success" | "warning" | "danger" | "muted";

export type EventData = Record<string, unknown>;

export type EvolutionEvent = {
  event: string;
  data: EventData;
  ts: number;
  mode: ModeKey;
};

export type AgentState = {
  name: string;
  generation: number;
  fitness_score: number;
  mutation_count: number;
};

export type SolverState = {
  name: string;
  stage: number;
  stage_name: string;
  consecutive_wins: number;
  total_wins: number;
  total_losses: number;
  wins_to_next_stage: number;
  generation: number;
};

export type ProtocolEntry = {
  token: string;
  meaning: string;
  proposed_by: "solver" | "challenger";
  round_created: number;
  usage_count: number;
};

export type ProtocolState = {
  vocabulary: ProtocolEntry[];
  vocab_size: number;
  utilization_rate: number;
  round_history: { round: number; compression_ratio: number; vocab_size: number }[];
};

export type BootstrapPeerState = {
  name: string;
  generation: number;
  fitness_score: number;
  mutation_count: number;
  message_count: number;
  accepted_proposals: number;
  rejected_proposals: number;
  contribution_score: number;
  dependency_score: number;
  total_cost_usd: number;
  cached_prompt_tokens?: number;
  pricing_known?: boolean;
};

export type BootstrapProtocolEntry = {
  token: string;
  meaning: string;
  proposed_by: string;
  accepted_by: string | null;
  state: "pending" | "adopted" | "stable";
  round_created: number;
  usage_count: number;
  first_used_round: number | null;
  stable_round: number | null;
};

export type BootstrapProtocolState = {
  vocabulary: BootstrapProtocolEntry[];
  vocab_size: number;
  stable_tokens: number;
  utilization_rate: number;
  round_history: {
    round: number;
    compression_ratio: number;
    vocab_size: number;
    stable_tokens: number;
  }[];
};

export type BootstrapAssessment = {
  stage: string;
  collaboration: number;
  language: number;
  traceability: number;
  autonomy: number;
  overall: number;
};

export type GenesisScores = {
  reasoning: number;
  tool_use: number;
  error_handling: number;
  self_improvement: number;
  overall: number;
};

export type GenesisFile = {
  path: string;
  size_bytes: number;
};

export type ClassicStatusResponse = {
  status: string;
  agent?: AgentState;
  current_code?: string;
  error?: string;
};

export type ArenaStatusResponse = {
  status: string;
  solver?: SolverState;
  protocol?: ProtocolState;
  challenger?: Record<string, unknown>;
  error?: string;
};

export type BootstrapStatus = {
  status: string;
  stage: string;
  stage_id: number;
  round: number;
  target_rounds?: number;
  objective: string;
  unlocked_capabilities: string[];
  assessment: BootstrapAssessment | null;
  resumable?: boolean;
  completed?: boolean;
  peer_a: BootstrapPeerState;
  peer_b: BootstrapPeerState;
  protocol: BootstrapProtocolState;
  artifacts: GenesisFile[];
  run_cost_usd: number;
  error?: string;
};

export type BootstrapArtifactsResponse = {
  files?: GenesisFile[];
  workspace?: string;
  error?: string;
};

export type GenesisStatus = {
  running: boolean;
  phase: string;
  iteration: number;
  total_cost_usd: number;
  pricing_known?: boolean;
  files_created: string[];
  last_assessment: GenesisScores | null;
  error?: string;
};

export type GenesisNarrativeResponse = {
  content?: string;
  error?: string;
};

export type WorkbenchRawState = {
  connected: boolean;
  events: EvolutionEvent[];
  modeRunning: Record<ModeKey, boolean>;
  agent: AgentState | null;
  solver: SolverState | null;
  protocol: ProtocolState | null;
  bootstrapStatus: BootstrapStatus | null;
  bootstrapProtocol: BootstrapProtocolState | null;
  bootstrapArtifacts: GenesisFile[];
  genesisStatus: GenesisStatus | null;
  genesisFiles: GenesisFile[];
  genesisNarrative: string | null;
  currentCode: string | null;
};

export type OverviewMetric = {
  label: string;
  value: string;
  helper: string;
};

export type FormattedTrace = {
  event: string;
  mode: ModeKey;
  label: string;
  summary: string;
  ts: number;
  tone: StatusTone;
};

export type WorkbenchOverview = {
  activeModeCount: number;
  protocolTokenCount: number;
  artifactCount: number;
  safetyChecks: number;
  allModesIdle: boolean;
  lastTrace: FormattedTrace | null;
  metrics: OverviewMetric[];
};

export type ModeRailCard = {
  key: ModeKey;
  label: string;
  strapline: string;
  statusLabel: string;
  statusTone: StatusTone;
  evidenceLabel: string;
  isRunning: boolean;
  activityCount: number;
};

export type InspectorItem = {
  label: string;
  value: string;
  helper?: string;
};

export type InspectorSection = {
  id: string;
  kicker: string;
  title: string;
  body?: string;
  bullets?: string[];
  items?: InspectorItem[];
};

export type IdleBrief = {
  eyebrow: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type ModeTheme = {
  chip: string;
  button: string;
  buttonMuted: string;
  panel: string;
  accentText: string;
  border: string;
};

export type ModeDefinition = {
  key: ModeKey;
  label: string;
  strapline: string;
  heroTitle: string;
  whatItIs: string;
  whyItMatters: string;
  captures: string[];
  audiences: string[];
  readyBrief: IdleBrief;
  theme: ModeTheme;
};
