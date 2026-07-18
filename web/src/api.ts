import type { AgentSnapshot, PromptTemplate, Task, TranscriptEvent, UsageSummary } from './types';

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
  transcript: (id: string) => req<TranscriptEvent[]>('GET', `/api/agents/${id}/transcript`),
  startAgent: (id: string) => req<AgentSnapshot>('POST', `/api/agents/${id}/start`),
  stopAgent: (id: string) => req<AgentSnapshot>('POST', `/api/agents/${id}/stop`),
  sendMessage: (id: string, text: string) => req('POST', `/api/agents/${id}/message`, { text }),
  interrupt: (id: string) => req('POST', `/api/agents/${id}/interrupt`),
  permission: (id: string, requestId: string, allow: boolean, message?: string) =>
    req('POST', `/api/agents/${id}/permission`, { requestId, allow, message }),
  listTasks: () => req<Task[]>('GET', '/api/tasks'),
  createTask: (input: { title: string; prompt: string; assignedTo: string }) => req<Task>('POST', '/api/tasks', input),
  usage: () => req<UsageSummary>('GET', '/api/usage'),
  usageDetail: () => req<{ tracked: UsageSummary; plan: unknown }>('GET', '/api/usage/detail'),
  clearTranscript: (id: string) => req('POST', `/api/agents/${id}/clear`),
  listPrompts: () => req<PromptTemplate[]>('GET', '/api/prompts'),
  createPrompt: (input: unknown) => req<PromptTemplate>('POST', '/api/prompts', input),
  updatePrompt: (id: string, patch: unknown) => req<PromptTemplate>('PUT', `/api/prompts/${id}`, patch),
  deletePrompt: (id: string) => req('DELETE', `/api/prompts/${id}`),
  info: () => req<{ memoryDir: string; projectDir: string }>('GET', '/api/info'),
};
