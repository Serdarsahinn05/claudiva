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
  | 'system';

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

export interface AgentSnapshot {
  config: AgentConfig;
  status: AgentStatus;
  usage: TokenUsage;
  currentActivity?: string;
  pendingPermissions: PermissionRequestInfo[];
  sessionId?: string;
}

export interface UsageSummary {
  total: TokenUsage;
  perAgent: Record<string, TokenUsage>;
}

export type WsPayload =
  | { type: 'agent_status'; agentId: string; status: AgentStatus; activity?: string }
  | { type: 'agent_event'; agentId: string; event: TranscriptEvent }
  | { type: 'permission_request'; request: PermissionRequestInfo }
  | { type: 'permission_resolved'; agentId: string; requestId: string }
  | { type: 'usage'; usage: UsageSummary }
  | { type: 'agents_changed' }
  | { type: 'task_update'; task: Task };
