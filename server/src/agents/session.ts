import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  query,
  type Options,
  type PermissionResult,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  type McpServerConfig,
} from '@anthropic-ai/claude-agent-sdk';
import { AsyncQueue } from './asyncQueue.js';
import {
  addUsage,
  zeroUsage,
  type AgentConfig,
  type AgentStatus,
  type PermissionRequestInfo,
  type TokenUsage,
  type TranscriptEvent,
  type TranscriptKind,
} from '../types.js';
import { agentDir, agentMemoryDir, agentWorkspaceDir, SHARED_MEMORY_DIR } from '../paths.js';

const MODEL_ALIASES: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-4-8',
};

const MAX_TRANSCRIPT = 500;
const TRUNCATE_INPUT = 2000;

export interface SessionEvents {
  status: (status: AgentStatus) => void;
  event: (event: TranscriptEvent) => void;
  permission_request: (req: PermissionRequestInfo) => void;
  permission_resolved: (requestId: string) => void;
  usage: (usage: TokenUsage) => void;
  /** A turn finished (result message received). Carries the final result text. */
  turn_complete: (resultText: string, isError: boolean) => void;
}

interface PendingPermission {
  info: PermissionRequestInfo;
  resolve: (r: PermissionResult) => void;
}

/**
 * One running agent = one long-lived Agent SDK query() in streaming-input
 * mode. Messages are pushed into the queue; the SDK keeps the session alive
 * between turns, so context is preserved without resume gymnastics.
 */
export class AgentSession extends EventEmitter {
  readonly config: AgentConfig;
  status: AgentStatus = 'offline';
  usage: TokenUsage = zeroUsage();
  transcript: TranscriptEvent[] = [];
  sessionId?: string;
  currentActivity?: string;

  private queue: AsyncQueue<SDKUserMessage> | null = null;
  private q: Query | null = null;
  private abort: AbortController | null = null;
  private pending = new Map<string, PendingPermission>();
  /** Set while a turn is in flight so queued sends show as working. */
  private turnDepth = 0;

  constructor(config: AgentConfig, private personality: string) {
    super();
    this.config = config;
  }

  get pendingPermissions(): PermissionRequestInfo[] {
    return [...this.pending.values()].map((p) => p.info);
  }

  start(): void {
    if (this.q) return;
    this.queue = new AsyncQueue<SDKUserMessage>();
    this.abort = new AbortController();

    const ws = agentWorkspaceDir(this.config.id);
    fs.mkdirSync(ws, { recursive: true });

    this.q = query({
      prompt: this.queue,
      options: this.buildOptions(ws),
    });

    this.setStatus('idle');
    this.pushEvent({ kind: 'system', text: `Oturum başlatıldı (model: ${this.resolveModel()})` });
    void this.loop();
  }

  async stop(): Promise<void> {
    if (!this.q) return;
    this.queue?.end();
    try {
      await this.q.interrupt();
    } catch {
      // session may already be finished
    }
    this.abort?.abort();
    this.cleanup();
  }

  /** Send a user message (a task or a chat turn) to this agent. */
  send(text: string): void {
    if (!this.q || !this.queue) this.start();
    this.pushEvent({ kind: 'user', text });
    this.turnDepth += 1;
    this.setStatus('working');
    this.queue!.push({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text }] },
      parent_tool_use_id: null,
    });
  }

  async interrupt(): Promise<void> {
    try {
      await this.q?.interrupt();
      this.pushEvent({ kind: 'system', text: 'Görev kullanıcı tarafından durduruldu.' });
    } catch {
      // ignore
    }
  }

  async setModel(model: string): Promise<void> {
    this.config.model = model;
    try {
      await this.q?.setModel(MODEL_ALIASES[model] ?? model);
    } catch {
      // applied on next start if session not in streaming state
    }
  }

  resolvePermission(requestId: string, allow: boolean, message?: string): boolean {
    const p = this.pending.get(requestId);
    if (!p) return false;
    this.pending.delete(requestId);
    if (allow) {
      p.resolve({ behavior: 'allow', updatedInput: p.info.input });
    } else {
      p.resolve({ behavior: 'deny', message: message || 'Kullanıcı bu işlemi reddetti.' });
    }
    this.emit('permission_resolved', requestId);
    if (this.pending.size === 0 && this.status === 'waiting') this.setStatus('working');
    return true;
  }

  // ------------------------------------------------------------------

  private resolveModel(): string {
    return MODEL_ALIASES[this.config.model] ?? this.config.model;
  }

  private buildOptions(workspace: string): Options {
    const memoryDirs: string[] = [];
    if (this.config.memoryMode === 'shared' || this.config.memoryMode === 'both') {
      memoryDirs.push(SHARED_MEMORY_DIR);
    }
    if (this.config.memoryMode === 'private' || this.config.memoryMode === 'both') {
      const dir = agentMemoryDir(this.config.id);
      fs.mkdirSync(dir, { recursive: true });
      memoryDirs.push(dir);
    }

    const memoryInstructions = memoryDirs.length
      ? `\n\n# Hafıza\nKalıcı hafıza klasörlerin: ${memoryDirs.join(' , ')}\n` +
        `Bir göreve başlamadan önce ilgili hafıza dosyalarını oku. Görev sırasında öğrendiğin ` +
        `kalıcı değerde bilgileri (kararlar, tercihler, proje bilgisi) bu klasörlere markdown ` +
        `dosyası olarak yaz; dosya başına tek konu, [[wikilink]] ile ilişkilendir. ` +
        `Zaten kayıtlı bilgiyi tekrar yazma, güncelle.`
      : '';

    const skillsDir = path.join(agentDir(this.config.id), 'skills');
    const hasSkills = fs.existsSync(skillsDir) && fs.readdirSync(skillsDir).length > 0;

    const mcpServers: Record<string, McpServerConfig> = {};
    for (const [name, def] of Object.entries(this.config.mcpServers ?? {})) {
      if (def.type === 'stdio' && def.command) {
        mcpServers[name] = { type: 'stdio', command: def.command, args: def.args, env: def.env };
      } else if ((def.type === 'http' || def.type === 'sse') && def.url) {
        mcpServers[name] = { type: def.type, url: def.url } as McpServerConfig;
      }
    }
    Object.assign(mcpServers, this.extraMcpServers);

    return {
      model: this.resolveModel(),
      cwd: workspace,
      abortController: this.abort ?? undefined,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append:
          `# Kimlik\nSen "${this.config.name}" adlı bir ajansın. Rolün: ${this.config.role}.\n\n` +
          this.personality +
          memoryInstructions,
      },
      settingSources: [],
      additionalDirectories: [...memoryDirs, ...(hasSkills ? [skillsDir] : [])],
      mcpServers: Object.keys(mcpServers).length ? mcpServers : undefined,
      allowedTools: this.extraAllowedTools.length ? this.extraAllowedTools : undefined,
      permissionMode: 'default',
      canUseTool: async (toolName, input, opts) => {
        if (this.config.autoApprove) {
          return { behavior: 'allow', updatedInput: input };
        }
        const info: PermissionRequestInfo = {
          id: randomUUID(),
          agentId: this.config.id,
          toolName,
          input,
          title: opts.title,
          description: opts.description,
          ts: Date.now(),
        };
        this.setStatus('waiting');
        return await new Promise<PermissionResult>((resolve) => {
          this.pending.set(info.id, { info, resolve });
          this.emit('permission_request', info);
          opts.signal.addEventListener('abort', () => {
            if (this.pending.delete(info.id)) {
              this.emit('permission_resolved', info.id);
              resolve({ behavior: 'deny', message: 'İşlem iptal edildi.' });
            }
          });
        });
      },
      stderr: (data: string) => {
        if (process.env.DEBUG_AGENTS) console.error(`[${this.config.id}] ${data}`);
      },
    };
  }

  /** Extra in-process MCP servers (e.g. boss delegation tools). Set before start(). */
  extraMcpServers: Record<string, McpServerConfig> = {};
  extraAllowedTools: string[] = [];

  private async loop(): Promise<void> {
    if (!this.q) return;
    try {
      for await (const msg of this.q) {
        this.handleMessage(msg);
      }
    } catch (err) {
      this.pushEvent({ kind: 'error', text: `Oturum hatası: ${(err as Error).message}` });
    } finally {
      this.cleanup();
    }
  }

  private cleanup(): void {
    for (const [id, p] of this.pending) {
      p.resolve({ behavior: 'deny', message: 'Oturum kapandı.' });
      this.emit('permission_resolved', id);
    }
    this.pending.clear();
    this.q = null;
    this.queue = null;
    this.turnDepth = 0;
    this.currentActivity = undefined;
    this.setStatus('offline');
  }

  private handleMessage(msg: SDKMessage): void {
    switch (msg.type) {
      case 'system': {
        if (msg.subtype === 'init') {
          this.sessionId = msg.session_id;
        } else if (msg.subtype === 'session_state_changed') {
          const state = (msg as { state?: string }).state;
          if (state === 'running') this.setStatus('working');
          else if (state === 'requires_action') this.setStatus('waiting');
          else if (state === 'idle' && this.turnDepth <= 0) this.setStatus('idle');
        }
        break;
      }
      case 'assistant': {
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              this.pushEvent({ kind: 'text', text: block.text });
            } else if (block.type === 'thinking' && (block as { thinking?: string }).thinking) {
              this.pushEvent({ kind: 'thinking', text: (block as { thinking: string }).thinking });
            } else if (block.type === 'tool_use') {
              const input = JSON.stringify((block as { input?: unknown }).input ?? {});
              this.currentActivity = `${(block as { name: string }).name}`;
              this.pushEvent({
                kind: 'tool_use',
                toolName: (block as { name: string }).name,
                input: input.length > TRUNCATE_INPUT ? input.slice(0, TRUNCATE_INPUT) + '…' : input,
              });
            }
          }
        }
        break;
      }
      case 'user': {
        // Tool results echoed back into the transcript.
        const content = (msg as { message?: { content?: unknown } }).message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'tool_result') {
              const raw = typeof block.content === 'string'
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.filter((c: { type?: string }) => c?.type === 'text').map((c: { text?: string }) => c.text ?? '').join('\n')
                  : '';
              const text = raw.length > TRUNCATE_INPUT ? raw.slice(0, TRUNCATE_INPUT) + '…' : raw;
              if (text) this.pushEvent({ kind: 'tool_result', text, meta: { isError: !!block.is_error } });
            }
          }
        }
        break;
      }
      case 'result': {
        const usage = msg.usage as
          | { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
          | undefined;
        addUsage(this.usage, {
          inputTokens: usage?.input_tokens ?? 0,
          outputTokens: usage?.output_tokens ?? 0,
          cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
          costUSD: (msg as { total_cost_usd?: number }).total_cost_usd ?? 0,
          requests: 1,
        });
        this.emit('usage', this.usage);

        const isError = msg.subtype !== 'success';
        const resultText = (msg as { result?: string }).result ?? (isError ? `Hata: ${msg.subtype}` : '');
        this.pushEvent({
          kind: isError ? 'error' : 'result',
          text: resultText,
          meta: { subtype: msg.subtype, costUSD: (msg as { total_cost_usd?: number }).total_cost_usd },
        });
        this.turnDepth = Math.max(0, this.turnDepth - 1);
        this.currentActivity = undefined;
        if (this.turnDepth === 0) this.setStatus('idle');
        this.emit('turn_complete', resultText, isError);
        break;
      }
      default:
        break;
    }
  }

  private setStatus(status: AgentStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit('status', status);
  }

  private pushEvent(partial: Omit<TranscriptEvent, 'id' | 'ts'> & { kind: TranscriptKind }): void {
    const event: TranscriptEvent = { id: randomUUID(), ts: Date.now(), ...partial };
    this.transcript.push(event);
    if (this.transcript.length > MAX_TRANSCRIPT) this.transcript.splice(0, this.transcript.length - MAX_TRANSCRIPT);
    this.emit('event', event);
  }
}
