import type {
  AgentDraft,
  AitmplKind,
  AitmplListView,
  CatalogSkill,
  CommandDraft,
  McpDraft,
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
import { L } from './i18n';

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Sunucu çevrilebilir hatalarda `code` da yollar; metin sunucunun dilinde.
    const { error, code } = data as { error?: string; code?: string };
    throw new Error((code && L.apiErrors[code]) || error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  listAgents: () => req<AgentSnapshot[]>('GET', '/api/agents'),
  createAgent: (input: unknown) => req<AgentSnapshot>('POST', '/api/agents', input),
  searchSkillsRemote: (q: string) =>
    req<{ skills: CatalogSkill[] }>('GET', `/api/skills/search-remote?q=${encodeURIComponent(q)}`),
  scanSkillLink: (url: string) => req<{ skills: CatalogSkill[] }>('POST', '/api/skills/scan-link', { url }),
  aitmplList: (kind: AitmplKind) => req<AitmplListView>('GET', `/api/aitmpl/${kind}`),
  refreshAitmplList: (kind: AitmplKind) => req<AitmplListView>('POST', `/api/aitmpl/${kind}/refresh`),
  aitmplAgentDraft: (id: string) =>
    req<AgentDraft>('GET', `/api/aitmpl/agents/draft?id=${encodeURIComponent(id)}`),
  aitmplMcpDraft: (id: string) =>
    req<McpDraft>('GET', `/api/aitmpl/mcps/draft?id=${encodeURIComponent(id)}`),
  aitmplCommandDraft: (id: string) =>
    req<CommandDraft>('GET', `/api/aitmpl/commands/draft?id=${encodeURIComponent(id)}`),
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
  statusLine: (id: string) =>
    req<{ configured: boolean; text: string | null }>('GET', `/api/agents/${id}/statusline`),
  permission: (id: string, requestId: string, allow: boolean, message?: string, answers?: Record<string, string>) =>
    req('POST', `/api/agents/${id}/permission`, { requestId, allow, message, answers }),
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
  /** Sonuçlanmış her görevin (alt görevler dahil) alt ağaç kanıt sayısı. */
  taskEvidence: () => req<Record<string, number>>('GET', '/api/tasks/evidence'),
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
    items: { id: string; repo: string; skillPath: string; ref?: string; skillId?: string; name?: string }[];
    scope: SkillScope;
    agentId?: string;
  }) => req<BulkResult[]>('POST', '/api/skills/install-many', input),
  info: () => req<{ memoryDir: string; projectDir: string }>('GET', '/api/info'),
  system: () => req<SystemInfo>('GET', '/api/system'),
  /** Sunucunun kullanıcıya yazdığı notların dili (bkz. server/src/i18n.ts). */
  setServerLocale: (locale: string) => req<{ locale: string }>('PUT', '/api/locale', { locale }),
};
