export type AgentRole = 'boss' | 'manager' | 'team-leader' | 'worker';

export type AgentStatus = 'offline' | 'idle' | 'working' | 'waiting';

export type MemoryMode = 'shared' | 'private' | 'both' | 'none';

/** Short aliases mapped to real model IDs in session.ts; full IDs pass through. */
export type ModelChoice = 'haiku' | 'sonnet' | 'opus' | string;

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
  model: ModelChoice;
  memoryMode: MemoryMode;
  /** When true, tool permission requests are auto-approved. */
  autoApprove: boolean;
  /** Extra description shown on the dashboard card. */
  description?: string;
  /** Göreve göre otomatik model seçimi (set_model aracı). Varsayılan: açık. */
  autoModel?: boolean;
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

export function zeroUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUSD: 0, requests: 0 };
}

export function addUsage(a: TokenUsage, b: Partial<TokenUsage>): void {
  a.inputTokens += b.inputTokens ?? 0;
  a.outputTokens += b.outputTokens ?? 0;
  a.cacheReadTokens += b.cacheReadTokens ?? 0;
  a.cacheCreationTokens += b.cacheCreationTokens ?? 0;
  a.costUSD += b.costUSD ?? 0;
  a.requests += b.requests ?? 0;
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
  /** Panelin kendi ürettiği çıktı (ör. /usage). Modele hiç gitmez, yalnızca
   *  dökümde görünür; ajan değişince veya sayfa yenilenince kaybolmasın diye
   *  diğer olaylarla aynı yerde saklanır. */
  | 'local';

export interface TranscriptEvent {
  id: string;
  ts: number;
  kind: TranscriptKind;
  text?: string;
  toolName?: string;
  /** JSON-stringified tool input (truncated). */
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
  assignedTo: string; // agent id
  assignedBy: string; // 'user' | agent id
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

/** Bir oturumda kullanılabilen slash komutu (skill, plugin komutu veya CLI yerleşiği). */
export interface SlashCommand {
  name: string;
  description: string;
  argumentHint?: string;
  aliases?: string[];
}

/** Snapshot of an agent for the panel. */
export interface AgentSnapshot {
  config: AgentConfig;
  status: AgentStatus;
  usage: TokenUsage;
  currentActivity?: string;
  pendingPermissions: PermissionRequestInfo[];
  sessionId?: string;
  /** Son turdaki bağlam doluluğu (token) — panel yakıt göstergesi */
  contextTokens?: number;
  /** Oturumun şu an kullandığı model (otomatik geçişle temelden sapabilir) */
  currentModel?: string;
  /** Bu oturumda "/" ile çağrılabilen komutlar (panel otomatik tamamlaması) */
  commands?: SlashCommand[];
}
