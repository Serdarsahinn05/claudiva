export type AgentRole = 'boss' | 'manager' | 'team-leader' | 'worker';
export type AgentStatus = 'offline' | 'idle' | 'working' | 'waiting';
export type MemoryMode = 'shared' | 'private' | 'both' | 'none';

export interface McpServerDef {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  model: string;
  memoryMode: MemoryMode;
  autoApprove: boolean;
  /** Göreve göre otomatik model seçimi (set_model aracı). Varsayılan: açık. */
  autoModel?: boolean;
  description?: string;
  mcpServers?: Record<string, McpServerDef>;
  createdAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUSD: number;
  requests: number;
}

export type TranscriptKind =
  | 'user'
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error'
  | 'system'
  /** Yalnızca panelde üretilir (ör. /usage çıktısı); sunucudan hiç gelmez. */
  | 'local';

export interface TranscriptEvent {
  id: string;
  ts: number;
  kind: TranscriptKind;
  text?: string;
  toolName?: string;
  input?: string;
  meta?: Record<string, unknown>;
}

export interface PermissionRequestInfo {
  id: string;
  agentId: string;
  toolName: string;
  input: Record<string, unknown>;
  title?: string;
  description?: string;
  ts: number;
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Task {
  id: string;
  title: string;
  prompt: string;
  assignedTo: string;
  assignedBy: string;
  status: TaskStatus;
  result?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  template: string;
  tags?: string[];
}

/** Terminalde "/" ile çağrılabilen komut (skill, plugin komutu veya CLI yerleşiği). */
export interface SlashCommand {
  name: string;
  description: string;
  argumentHint?: string;
  aliases?: string[];
}

export interface AgentSnapshot {
  config: AgentConfig;
  status: AgentStatus;
  usage: TokenUsage;
  currentActivity?: string;
  pendingPermissions: PermissionRequestInfo[];
  sessionId?: string;
  /** Son turdaki bağlam doluluğu (token) — ofis yakıt göstergesi */
  contextTokens?: number;
  /** Oturumun şu an kullandığı model (otomatik geçişle temelden sapabilir) */
  currentModel?: string;
  /** Terminalde "/" yazınca listelenecek komutlar */
  commands?: SlashCommand[];
}

/** Köprü ekranının gösterdiği sistem telemetrisi (GET /api/system). */
export interface SystemInfo {
  host: {
    platform: string;
    release: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    loadAvg: number;
    memTotal: number;
    memFree: number;
    uptimeSec: number;
    nodeVersion: string;
  };
  project: {
    dir: string;
    name: string;
    fileCount: number;
    sizeBytes: number;
    truncated: boolean;
    gitBranch: string | null;
  };
  claude: {
    sdkVersion: string;
    teamDir: string;
    installRoot: string;
  };
}

export interface UsageSummary {
  total: TokenUsage;
  perAgent: Record<string, TokenUsage>;
}

// ------------------------------------------------------------------ bütçe
export interface BudgetSettings {
  /** Günlük toplam harcama tavanı (USD). 0/tanımsız = sınırsız. */
  dailyLimitUSD?: number;
  /** Bu yüzdede uyarı verilir. */
  warnAtPercent?: number;
}

export interface BudgetState {
  /** Pencerenin günü (YYYY-MM-DD); yerel gece yarısında döner. */
  date: string;
  spentUSD: number;
  limitUSD?: number;
  perAgentUSD: Record<string, number>;
  /** Sınır yoksa null. */
  pct: number | null;
  warn: boolean;
  exceeded: boolean;
  settings?: BudgetSettings;
}

// ----------------------------------------------------------- değişiklikler
export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

/** Bir dosyaya yapılan tek bir ajan dokunuşu. */
export interface Touch {
  agentId: string;
  taskId?: string;
  ts: number;
  tool: string;
}

export interface ChangedFile {
  /** Proje köküne göreli yol. */
  path: string;
  status: ChangeStatus;
  /** Yeniden eskiye; boşsa değişikliği ajan değil kullanıcı yapmış demektir. */
  touches: Touch[];
}

export interface ChangesResponse {
  /** false ise geri alma yapılamaz; panel düğmeleri kapanır. */
  isRepo: boolean;
  head: string | null;
  files: ChangedFile[];
}

export type WsPayload =
  | { type: 'agent_status'; agentId: string; status: AgentStatus; activity?: string }
  | { type: 'agent_event'; agentId: string; event: TranscriptEvent }
  | { type: 'permission_request'; request: PermissionRequestInfo }
  | { type: 'permission_resolved'; agentId: string; requestId: string }
  | { type: 'usage'; usage: UsageSummary; context?: Record<string, number>; budget?: BudgetState }
  | { type: 'agents_changed' }
  | { type: 'commands_changed'; agentId: string; commands: SlashCommand[] }
  | { type: 'task_update'; task: Task };
