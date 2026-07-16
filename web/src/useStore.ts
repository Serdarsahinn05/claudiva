import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type {
  AgentSnapshot,
  PermissionRequestInfo,
  PromptTemplate,
  Task,
  TranscriptEvent,
  UsageSummary,
  WsPayload,
} from './types';

const MAX_EVENTS = 500;

export interface Store {
  agents: AgentSnapshot[];
  tasks: Task[];
  prompts: PromptTemplate[];
  usage: UsageSummary | null;
  transcripts: Record<string, TranscriptEvent[]>;
  permissions: PermissionRequestInfo[];
  connected: boolean;
  refreshAgents: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshPrompts: () => Promise<void>;
  loadTranscript: (agentId: string) => Promise<void>;
}

export function useStore(): Store {
  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, TranscriptEvent[]>>({});
  const [permissions, setPermissions] = useState<PermissionRequestInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshAgents = useCallback(async () => {
    const list = await api.listAgents();
    setAgents(list);
    setPermissions(list.flatMap((a) => a.pendingPermissions));
  }, []);
  const refreshTasks = useCallback(async () => setTasks(await api.listTasks()), []);
  const refreshPrompts = useCallback(async () => setPrompts(await api.listPrompts()), []);
  const loadTranscript = useCallback(async (agentId: string) => {
    const events = await api.transcript(agentId);
    setTranscripts((t) => ({ ...t, [agentId]: events }));
  }, []);

  useEffect(() => {
    void refreshAgents();
    void refreshTasks();
    void refreshPrompts();
    void api.usage().then(setUsage).catch(() => {});
  }, [refreshAgents, refreshTasks, refreshPrompts]);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        void refreshAgents();
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as WsPayload;
        switch (msg.type) {
          case 'agent_status':
            setAgents((prev) =>
              prev.map((a) =>
                a.config.id === msg.agentId ? { ...a, status: msg.status, currentActivity: msg.activity } : a,
              ),
            );
            break;
          case 'agent_event':
            setTranscripts((t) => {
              const list = [...(t[msg.agentId] ?? []), msg.event];
              if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
              return { ...t, [msg.agentId]: list };
            });
            break;
          case 'permission_request':
            setPermissions((p) => [...p, msg.request]);
            setAgents((prev) =>
              prev.map((a) =>
                a.config.id === msg.request.agentId
                  ? { ...a, pendingPermissions: [...a.pendingPermissions, msg.request] }
                  : a,
              ),
            );
            break;
          case 'permission_resolved':
            setPermissions((p) => p.filter((x) => x.id !== msg.requestId));
            setAgents((prev) =>
              prev.map((a) =>
                a.config.id === msg.agentId
                  ? { ...a, pendingPermissions: a.pendingPermissions.filter((x) => x.id !== msg.requestId) }
                  : a,
              ),
            );
            break;
          case 'usage':
            setUsage(msg.usage);
            setAgents((prev) =>
              prev.map((a) => ({ ...a, usage: msg.usage.perAgent[a.config.id] ?? a.usage })),
            );
            break;
          case 'agents_changed':
            void refreshAgents();
            break;
          case 'task_update':
            setTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === msg.task.id);
              if (idx === -1) return [msg.task, ...prev];
              const next = [...prev];
              next[idx] = msg.task;
              return next;
            });
            break;
        }
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [refreshAgents]);

  return {
    agents,
    tasks,
    prompts,
    usage,
    transcripts,
    permissions,
    connected,
    refreshAgents,
    refreshTasks,
    refreshPrompts,
    loadTranscript,
  };
}
