import type {
  AgentSnapshot,
  BrowserAction,
  BrowserState,
  BudgetSettings,
  BudgetState,
  BulkResult,
  CatalogSource,
  CatalogView,
  ChangesResponse,
  FileContent,
  InspectPart,
  MemoryNode,
  PromptTemplate,
  Report,
  SkillInfo,
  SkillScope,
  TreeEntry,
  SessionInspect,
  SystemInfo,
  Task,
  TranscriptEvent,
  UsageHistoryResponse,
  UsageSummary,
} from './types';

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  listAgents: () => req<AgentSnapshot[]>('GET', '/api/agents'),
  createAgent: (input: unknown) => req<AgentSnapshot>('POST', '/api/agents', input),
  updateAgent: (id: string, patch: unknown) => req<AgentSnapshot>('PUT', `/api/agents/${id}`, patch),
  deleteAgent: (id: string) => req('DELETE', `/api/agents/${id}`),
  reorderAgents: (ids: string[]) => req<AgentSnapshot[]>('PUT', '/api/agents/order', { ids }),
  transcript: (id: string) => req<TranscriptEvent[]>('GET', `/api/agents/${id}/transcript`),
  startAgent: (id: string) => req<AgentSnapshot>('POST', `/api/agents/${id}/start`),
  stopAgent: (id: string) => req<AgentSnapshot>('POST', `/api/agents/${id}/stop`),
  sendMessage: (id: string, text: string) => req('POST', `/api/agents/${id}/message`, { text }),
  interrupt: (id: string) => req('POST', `/api/agents/${id}/interrupt`),
  /** Yerleşik komutların (`/context`, `/model`, `/mcp`…) oturum iç görüsü. */
  inspect: (id: string, parts: InspectPart[]) =>
    req<SessionInspect>('GET', `/api/agents/${id}/inspect?parts=${parts.join(',')}`),
  permission: (id: string, requestId: string, allow: boolean, message?: string) =>
    req('POST', `/api/agents/${id}/permission`, { requestId, allow, message }),
  getMemory: () => req<{ nodes: MemoryNode[] }>('GET', '/api/memory'),
  listTasks: () => req<Task[]>('GET', '/api/tasks'),
  createTask: (input: { title: string; prompt: string; assignedTo: string }) => req<Task>('POST', '/api/tasks', input),
  createChain: (steps: { title: string; prompt: string; assignedTo: string }[]) =>
    req<Task[]>('POST', '/api/tasks/chain', { steps }),
  usage: () => req<UsageSummary>('GET', '/api/usage'),
  usageDetail: () => req<{ tracked: UsageSummary; plan: unknown }>('GET', '/api/usage/detail'),
  usageHistory: () => req<UsageHistoryResponse>('GET', '/api/usage/history'),
  clearTranscript: (id: string) => req('POST', `/api/agents/${id}/clear`),
  pushLocal: (id: string, kind: 'user' | 'local' | 'error', text: string) =>
    req('POST', `/api/agents/${id}/local`, { kind, text }),
  listPrompts: () => req<PromptTemplate[]>('GET', '/api/prompts'),
  createPrompt: (input: unknown) => req<PromptTemplate>('POST', '/api/prompts', input),
  updatePrompt: (id: string, patch: unknown) => req<PromptTemplate>('PUT', `/api/prompts/${id}`, patch),
  deletePrompt: (id: string) => req('DELETE', `/api/prompts/${id}`),
  budget: () => req<BudgetState>('GET', '/api/budget'),
  updateSettings: (patch: BudgetSettings) => req<BudgetState>('PUT', '/api/settings', patch),
  changes: () => req<ChangesResponse>('GET', '/api/changes'),
  changeDiff: (p: string) =>
    req<{ path: string; diff: string }>('GET', `/api/changes/diff?path=${encodeURIComponent(p)}`),
  revertChange: (p: string) => req('POST', '/api/changes/revert', { path: p }),
  fileTree: (p: string) =>
    req<{ path: string; entries: TreeEntry[] }>('GET', `/api/files/tree?path=${encodeURIComponent(p)}`),
  fileRead: (p: string) => req<FileContent>('GET', `/api/files/read?path=${encodeURIComponent(p)}`),
  reports: () => req<Report[]>('GET', '/api/reports'),
  browserState: () => req<BrowserState>('GET', '/api/browser/state'),
  browserNavigate: (url: string) => req<BrowserState>('POST', '/api/browser/navigate', { url }),
  browserAct: (a: BrowserAction) => req<BrowserState>('POST', '/api/browser/act', a),
  browserClose: () => req('POST', '/api/browser/close'),
  listSkills: () => req<SkillInfo[]>('GET', '/api/skills'),
  toggleSkill: (id: string, enabled: boolean) =>
    req<SkillInfo>('POST', '/api/skills/toggle', { id, enabled }),
  removeSkill: (id: string) => req('DELETE', `/api/skills?id=${encodeURIComponent(id)}`),
  installSkill: (input: { repo: string; skillPath: string; scope: SkillScope; agentId?: string }) =>
    req<SkillInfo>('POST', '/api/skills/install', input),

  /** Önbellekten okur, ağa çıkmaz. */
  skillCatalog: () => req<CatalogView>('GET', '/api/skills/catalog'),
  /** Ağa çıkan tek uç; kaynak sayısına göre birkaç saniye sürebilir. */
  refreshSkillCatalog: () => req<CatalogView>('POST', '/api/skills/catalog/refresh'),
  addSkillSource: (repo: string, label?: string) =>
    req<CatalogSource[]>('POST', '/api/skills/sources', { repo, label }),
  removeSkillSource: (repo: string) =>
    req<CatalogSource[]>('DELETE', `/api/skills/sources?repo=${encodeURIComponent(repo)}`),
  installSkills: (input: {
    items: { id: string; repo: string; skillPath: string; name?: string }[];
    scope: SkillScope;
    agentId?: string;
  }) => req<BulkResult[]>('POST', '/api/skills/install-many', input),
  info: () => req<{ memoryDir: string; projectDir: string }>('GET', '/api/info'),
  system: () => req<SystemInfo>('GET', '/api/system'),
};
