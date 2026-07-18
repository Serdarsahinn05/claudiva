import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentSession } from './session.js';
import {
  addUsage,
  zeroUsage,
  type AgentConfig,
  type AgentSnapshot,
  type SlashCommand,
  type TokenUsage,
} from '../types.js';
import { AGENTS_DIR, DATA_DIR, agentDir } from '../paths.js';

const USAGE_FILE = path.join(DATA_DIR, 'usage.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');

interface UsageFile {
  total: TokenUsage;
  perAgent: Record<string, TokenUsage>;
}

/**
 * Owns agent definitions on disk (agents/<id>/config.json + personality.md),
 * live sessions, and cumulative token usage (data/usage.json).
 */
export class AgentManager extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private usage: UsageFile = { total: zeroUsage(), perAgent: {} };
  private saveTimer: NodeJS.Timeout | null = null;
  /** Son bilinen slash komut listeleri. Komutlar ancak oturum açıkken SDK'dan
   *  gelir; panelin "/" menüsü ajan kapalıyken de dolu görünsün diye diske
   *  yazılır ve açılışta geri yüklenir. */
  private commandCache: Record<string, SlashCommand[]> = {};
  /** Called for every session before it is wired/started — used to inject
   *  extra MCP servers (e.g. delegation tools for boss-role agents). */
  sessionDecorator?: (session: AgentSession) => void;

  init(): void {
    if (fs.existsSync(USAGE_FILE)) {
      try {
        this.usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
      } catch {
        // corrupt file -> start fresh
      }
    }
    if (fs.existsSync(COMMANDS_FILE)) {
      try {
        this.commandCache = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf-8'));
      } catch {
        // corrupt file -> start fresh
      }
    }
    for (const config of this.readConfigs()) {
      this.attachSession(config);
    }
  }

  // ---------------------------------------------------------- disk I/O

  private readConfigs(): AgentConfig[] {
    if (!fs.existsSync(AGENTS_DIR)) return [];
    const configs: AgentConfig[] = [];
    for (const entry of fs.readdirSync(AGENTS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(AGENTS_DIR, entry.name, 'config.json');
      if (!fs.existsSync(file)) continue;
      try {
        configs.push(JSON.parse(fs.readFileSync(file, 'utf-8')) as AgentConfig);
      } catch (err) {
        console.error(`Bozuk config atlandı: ${file}`, err);
      }
    }
    return configs;
  }

  private readPersonality(id: string): string {
    const file = path.join(agentDir(id), 'personality.md');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  }

  private writeAgentFiles(config: AgentConfig, personality: string): void {
    const dir = agentDir(config.id);
    fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
    // Ajan dizini aynı zamanda yerel bir Claude Code plugin'idir; manifest olmadan
    // skills/ klasörü yüklenmez (bkz. AgentSession.buildOptions).
    fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: config.id, description: `${config.name} skill'leri`, version: '1.0.0' }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'personality.md'), personality, 'utf-8');
  }

  private persistUsage(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.usage, null, 2), 'utf-8');
    }, 500);
  }

  // ---------------------------------------------------------- sessions

  private attachSession(config: AgentConfig): AgentSession {
    const session = new AgentSession(config, this.readPersonality(config.id));
    this.sessionDecorator?.(session);
    this.sessions.set(config.id, session);

    // Restore historical usage into the live counter so the panel shows totals.
    const prior = this.usage.perAgent[config.id];
    if (prior) Object.assign(session.usage, structuredClone(prior));

    session.on('status', (status) => this.emit('agent_status', config.id, status, session.currentActivity));
    session.on('model_changed', () => this.emit('agents_changed'));
    session.on('commands_changed', (commands) => {
      this.commandCache[config.id] = commands;
      this.persistCommands();
      this.emit('commands_changed', config.id, commands);
    });
    session.on('event', (event) => this.emit('agent_event', config.id, event));
    session.on('permission_request', (req) => this.emit('permission_request', req));
    session.on('permission_resolved', (id) => this.emit('permission_resolved', config.id, id));
    session.on('usage', () => {
      this.usage.perAgent[config.id] = structuredClone(session.usage);
      this.recomputeTotal();
      this.persistUsage();
      this.emit('usage', this.usageSummary());
    });
    return session;
  }

  private persistCommands(): void {
    try {
      fs.writeFileSync(COMMANDS_FILE, JSON.stringify(this.commandCache, null, 2), 'utf-8');
    } catch {
      // önbellek yazılamazsa panel yalnızca kapalı ajanda menüyü kaybeder
    }
  }

  private recomputeTotal(): void {
    const total = zeroUsage();
    for (const u of Object.values(this.usage.perAgent)) addUsage(total, u);
    this.usage.total = total;
  }

  // ---------------------------------------------------------- public API

  list(): AgentSnapshot[] {
    return [...this.sessions.values()].map((s) => this.snapshot(s));
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  snapshot(s: AgentSession): AgentSnapshot {
    return {
      config: s.config,
      status: s.status,
      usage: s.usage,
      currentActivity: s.currentActivity,
      pendingPermissions: s.pendingPermissions,
      sessionId: s.sessionId,
      contextTokens: s.contextTokens,
      currentModel: s.currentModel,
      // Oturum kapalıyken canlı liste boştur; panel menüsü boş kalmasın diye
      // son bilinen listeye düşülür.
      commands: s.commands.length ? s.commands : this.commandCache[s.config.id] ?? [],
    };
  }

  usageSummary(): { total: TokenUsage; perAgent: Record<string, TokenUsage> } {
    return this.usage;
  }

  /** Ajan başına anlık bağlam doluluğu (token) — panel yakıt göstergesi */
  contextSnapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, s] of this.sessions) out[id] = s.contextTokens;
    return out;
  }

  create(input: {
    name: string;
    role: AgentConfig['role'];
    model: string;
    memoryMode: AgentConfig['memoryMode'];
    autoApprove: boolean;
    autoModel?: boolean;
    description?: string;
    personality: string;
    mcpServers?: AgentConfig['mcpServers'];
  }): AgentSnapshot {
    const id = input.name
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü]+/gi, '-')
      .replace(/^-+|-+$/g, '') || randomUUID().slice(0, 8);
    if (this.sessions.has(id)) throw new Error(`"${id}" kimlikli ajan zaten var.`);

    const config: AgentConfig = {
      id,
      name: input.name,
      role: input.role,
      model: input.model,
      memoryMode: input.memoryMode,
      autoApprove: input.autoApprove,
      autoModel: input.autoModel ?? true,
      description: input.description,
      mcpServers: input.mcpServers,
      createdAt: new Date().toISOString(),
    };
    this.writeAgentFiles(config, input.personality);
    const session = this.attachSession(config);
    this.emit('agents_changed');
    return this.snapshot(session);
  }

  async update(
    id: string,
    patch: Partial<Pick<AgentConfig, 'name' | 'role' | 'model' | 'memoryMode' | 'autoApprove' | 'autoModel' | 'description' | 'mcpServers'>> & {
      personality?: string;
    },
  ): Promise<AgentSnapshot> {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Ajan bulunamadı.');
    const { personality, ...configPatch } = patch;
    Object.assign(session.config, configPatch);
    const newPersonality = personality ?? this.readPersonality(id);
    this.writeAgentFiles(session.config, newPersonality);

    // Model can be switched live; other changes apply on next session start.
    if (patch.model) await session.setModel(patch.model);

    this.emit('agents_changed');
    return this.snapshot(session);
  }

  async remove(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Ajan bulunamadı.');
    await session.stop();
    this.sessions.delete(id);
    fs.rmSync(agentDir(id), { recursive: true, force: true });
    delete this.usage.perAgent[id];
    this.recomputeTotal();
    this.persistUsage();
    this.emit('agents_changed');
    this.emit('usage', this.usageSummary());
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled([...this.sessions.values()].map((s) => s.stop()));
  }
}
