import { S } from '../i18n.js';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentSession } from './session.js';
import { SessionStore } from './sessionStore.js';
import { UsageHistory } from './usageHistory.js';
import { SettingsStore } from '../settings.js';
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
  /**
   * Günlük pencere. Bütçe sınırı buna bakar, `total`'a DEĞİL: `total` tüm
   * zamanların toplamı ve diskten geri yükleniyor; ona sınır konsaydı bir kez
   * aşıldığında proje kalıcı olarak kilitlenirdi.
   */
  daily?: { date: string; total: TokenUsage; perAgent: Record<string, TokenUsage> };
}

/** Yerel gün (YYYY-MM-DD). Pencere yerel gece yarısında döner. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** a - b (negatife düşmez). Turun kendi payını bulmak için. */
function deltaUsage(a: TokenUsage, b?: TokenUsage): Partial<TokenUsage> {
  const d = (x: number, y: number) => Math.max(0, x - y);
  const z = b ?? zeroUsage();
  return {
    inputTokens: d(a.inputTokens, z.inputTokens),
    outputTokens: d(a.outputTokens, z.outputTokens),
    cacheReadTokens: d(a.cacheReadTokens, z.cacheReadTokens),
    cacheCreationTokens: d(a.cacheCreationTokens, z.cacheCreationTokens),
    costUSD: Math.max(0, a.costUSD - z.costUSD),
    requests: d(a.requests, z.requests),
  };
}

/**
 * Owns agent definitions on disk (agents/<id>/config.json + personality.md),
 * live sessions, and cumulative token usage (data/usage.json).
 */
export class AgentManager extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  /** sessionId + transcript kalıcılığı; oturumlara aktarılır. */
  readonly store = new SessionStore();
  readonly settings = new SettingsStore();
  /** Tur tur harcama geçmişi — panelin zaman eksenli grafikleri bunu okur. */
  readonly history = new UsageHistory();
  /** Sınır aşımı her turda tekrar duyurulmasın. */
  private budgetAnnounced = false;
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
    this.store.init();
    this.settings.init();
    this.history.init();
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
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as AgentConfig;
        // Eski config.json dosyalarında provider yok — 'claude' say (geriye uyum).
        configs.push({ ...raw, provider: raw.provider ?? 'claude' });
      } catch (err) {
        console.error(S.badConfig(file), err);
      }
    }
    // Panel sırası: order verilmişse ona, yoksa oluşturulma zamanına göre.
    configs.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    });
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
    // Manifest YALNIZ yoksa yazılır. Eskiden her güncellemede (ad değişimi, oto-onay
    // düğmesi…) yeniden yazılıp paketteki açıklamayı eziyordu; agentUpgrade bu
    // üretilmiş kalıbı tanıyıp onarır (isGeneratedManifest).
    fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
    const manifest = path.join(dir, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(manifest)) {
      fs.writeFileSync(
        manifest,
        JSON.stringify({ name: config.id, description: `${config.name} agent skills`, version: '1.0.0' }, null, 2) + '\n',
        'utf-8'
      );
    }
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
    const session = new AgentSession(config, this.readPersonality(config.id), this.store);
    // Oturum manager'ı tanımaz; sınırı bir geri çağırımla sorar.
    session.budgetGuard = () => {
      const r = this.canWork(config.id);
      return r.ok ? null : r.reason;
    };
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
      // session.usage tümel (diskten geri yükleniyor); günlük pencereye
      // yalnızca bu turun payı eklenmeli, o yüzden önceki değerle farkı alınır.
      const delta = deltaUsage(session.usage, this.usage.perAgent[config.id]);
      this.usage.perAgent[config.id] = structuredClone(session.usage);
      this.recomputeTotal();
      this.addDaily(config.id, delta);
      // Geçmişe `lastTurn` yazılır, `delta` DEĞİL: ikisi normalde aynı, ama
      // delta negatife düşmemek için kırpılıyor ve ajan silinip yeniden
      // yaratıldığında (perAgent sıfırlanır) turu olduğundan büyük gösterirdi.
      // `lastTurn` turun kendi raporudur, karşılaştırmadan gelmez.
      if (session.lastTurn) {
        this.history.append(config.id, session.currentModel, session.lastTurn, session.currentTaskId);
      }
      this.persistUsage();
      this.emit('usage', this.usageSummary());

      // Sınır aşıldıysa SÜREN TUR KESİLMEZ (yarım iş bırakmamak için);
      // yeni iş send()/dispatch() tarafında reddedilir. Panel haberdar olsun.
      const b = this.budget();
      if (b.exceeded && !this.budgetAnnounced) {
        this.budgetAnnounced = true;
        session.pushLocal('error', S.budgetExceeded(b.spentUSD.toFixed(4), b.limitUSD?.toFixed(2) ?? '?'));
        this.emit('agents_changed');
      } else if (!b.exceeded) {
        this.budgetAnnounced = false;
      }
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

  // ------------------------------------------------------------- bütçe

  /** Gün döndüyse pencereyi sıfırlar ve bugünkü kaydı döndürür. */
  private dailyWindow(): NonNullable<UsageFile['daily']> {
    const d = today();
    if (!this.usage.daily || this.usage.daily.date !== d) {
      this.usage.daily = { date: d, total: zeroUsage(), perAgent: {} };
    }
    return this.usage.daily;
  }

  private addDaily(agentId: string, delta: Partial<TokenUsage>): void {
    const w = this.dailyWindow();
    addUsage(w.total, delta);
    w.perAgent[agentId] = w.perAgent[agentId] ?? zeroUsage();
    addUsage(w.perAgent[agentId], delta);
  }

  /** Bugünkü harcama ve sınır durumu. */
  budget(): {
    date: string;
    spentUSD: number;
    limitUSD?: number;
    perAgentUSD: Record<string, number>;
    pct: number | null;
    warn: boolean;
    exceeded: boolean;
  } {
    const w = this.dailyWindow();
    const limit = this.settings.get().dailyLimitUSD;
    const warnAt = this.settings.get().warnAtPercent ?? 80;
    const spent = w.total.costUSD;
    const pct = limit && limit > 0 ? (spent / limit) * 100 : null;
    const perAgentUSD: Record<string, number> = {};
    for (const [id, u] of Object.entries(w.perAgent)) perAgentUSD[id] = u.costUSD;
    return {
      date: w.date,
      spentUSD: spent,
      limitUSD: limit,
      perAgentUSD,
      pct,
      warn: pct !== null && pct >= warnAt,
      exceeded: pct !== null && pct >= 100,
    };
  }

  /**
   * Yeni iş kabul edilebilir mi? Sınır aşıldıysa gerekçe döner.
   *
   * İki yerden çağrılır — `AgentSession.send()` ve `TaskQueue.dispatch()`.
   * İkisi de gerekli: send() ölü oturumu kendiliğinden yeniden başlattığı için
   * yalnızca ajanı durdurmak sınırı delerdi.
   */
  canWork(agentId?: string): { ok: true } | { ok: false; reason: string } {
    const b = this.budget();
    if (b.exceeded) {
      return {
        ok: false,
        reason: S.budgetExceededTask(b.spentUSD.toFixed(4), b.limitUSD?.toFixed(2) ?? '?'),
      };
    }
    if (agentId) {
      const cfg = this.sessions.get(agentId)?.config;
      const own = cfg?.dailyLimitUSD;
      const spent = b.perAgentUSD[agentId] ?? 0;
      if (own && own > 0 && spent >= own) {
        return {
          ok: false,
          reason: S.agentBudgetExceeded(cfg?.name ?? agentId, spent.toFixed(4), own.toFixed(2)),
        };
      }
    }
    return { ok: true };
  }

  // ---------------------------------------------------------- public API

  list(): AgentSnapshot[] {
    return [...this.sessions.values()]
      .sort((a, b) => {
        const ao = a.config.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.config.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return (a.config.createdAt ?? '').localeCompare(b.config.createdAt ?? '');
      })
      .map((s) => this.snapshot(s));
  }

  /**
   * Panel sırasını kalıcılaştırır. Verilen id dizisi yeni sırayı belirler;
   * listede olmayan ajanlar sona eklenir (yarış durumunda kaybolmasınlar).
   */
  reorder(ids: string[]): AgentSnapshot[] {
    const rest = [...this.sessions.keys()].filter((id) => !ids.includes(id));
    [...ids.filter((id) => this.sessions.has(id)), ...rest].forEach((id, i) => {
      const s = this.sessions.get(id);
      if (!s || s.config.order === i) return;
      s.config.order = i;
      const file = path.join(agentDir(id), 'config.json');
      try {
        fs.writeFileSync(file, JSON.stringify(s.config, null, 2), 'utf-8');
      } catch (err) {
        console.error(S.orderWriteFailed(file), err);
      }
    });
    this.emit('agents_changed');
    return this.list();
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  snapshot(s: AgentSession): AgentSnapshot {
    return {
      config: s.config,
      status: s.status,
      usage: s.usage,
      lastTurn: s.lastTurn,
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

  /**
   * Plan kotası tek bir hesaba ait, oturumdan bağımsız. Açık olan herhangi bir
   * oturumdan okunur; hiç ajan çalışmıyorsa null döner.
   */
  async planUsage(): Promise<unknown | null> {
    for (const s of this.sessions.values()) {
      if (s.status === 'offline') continue;
      const u = await s.planUsage();
      if (u) return u;
    }
    return null;
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

  /**
   * Ajan başına SON TURUN payı. Kullanım yayınıyla birlikte gider: tur payı
   * `usageSummary()`den (tümel toplam) türetilemez, ayrıca taşınmak zorunda.
   */
  turnSnapshot(): Record<string, TokenUsage | null> {
    const out: Record<string, TokenUsage | null> = {};
    for (const [id, s] of this.sessions) out[id] = s.lastTurn;
    return out;
  }

  create(input: {
    name: string;
    role: AgentConfig['role'];
    model: string;
    provider?: AgentConfig['provider'];
    team?: string;
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
      provider: input.provider ?? 'claude',
      // Boş metin takımsızlıktır; "" yazıp bir takım var etmesin.
      team: input.team?.trim() || undefined,
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
    patch: Partial<Pick<AgentConfig, 'name' | 'role' | 'model' | 'provider' | 'team' | 'memoryMode' | 'autoApprove' | 'autoModel' | 'description' | 'mcpServers'>> & {
      personality?: string;
    },
  ): Promise<AgentSnapshot> {
    const session = this.sessions.get(id);
    if (!session) throw new Error(S.agentNotFound(id));
    const { personality, ...configPatch } = patch;
    // create() ile aynı kural: boş metin takımsızlık demektir, "" bir takım değil.
    if ('team' in configPatch) configPatch.team = configPatch.team?.trim() || undefined;
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
    if (!session) throw new Error(S.agentNotFound(id));
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
