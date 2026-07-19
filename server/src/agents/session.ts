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
import type { SessionStore } from './sessionStore.js';
import {
  addUsage,
  zeroUsage,
  type AgentConfig,
  type AgentStatus,
  type PermissionRequestInfo,
  type SlashCommand,
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
  /** Model switched (auto-model self-assessment or panel edit). */
  model_changed: (model: string) => void;
  /** Kullanılabilir slash komutları değişti (oturum açılışı veya orta-oturum keşif). */
  commands_changed: (commands: SlashCommand[]) => void;
}

interface PendingPermission {
  info: PermissionRequestInfo;
  resolve: (r: PermissionResult) => void;
}

/**
 * One running agent = one long-lived Agent SDK query() in streaming-input
 * mode. Messages are pushed into the queue; the SDK keeps the session alive
 * between turns, so no resume is needed WHILE THE PROCESS LIVES.
 *
 * Sunucu yeniden başladığında ise oturum ölür. O yüzden sessionId diske
 * yazılır ve sonraki açılışta `resume` olarak geri verilir (bkz. SessionStore).
 */
export class AgentSession extends EventEmitter {
  readonly config: AgentConfig;
  status: AgentStatus = 'offline';
  usage: TokenUsage = zeroUsage();
  transcript: TranscriptEvent[] = [];
  sessionId?: string;
  currentActivity?: string;
  /** Son turdaki bağlam doluluğu (input + cache token) — panel yakıt göstergesi */
  contextTokens = 0;
  /** Oturumun şu an kullandığı model (haiku/sonnet/opus). Otomatik model
   *  seçimi config.model'i (temel modeli) değiştirmeden bunu oynatır. */
  currentModel: string;
  /** Bu oturumda "/" ile çağrılabilen komutlar; panelin otomatik tamamlaması bunu kullanır. */
  commands: SlashCommand[] = [];
  /**
   * Bütçe muhafızı. Yeni iş kabul edilemiyorsa gerekçe döner, aksi hâlde null.
   * Manager tarafından bağlanır — oturum manager'ı tanımasın diye geri çağırım.
   */
  budgetGuard?: () => string | null;

  private queue: AsyncQueue<SDKUserMessage> | null = null;
  private q: Query | null = null;
  private abort: AbortController | null = null;
  private pending = new Map<string, PendingPermission>();
  /** Set while a turn is in flight so queued sends show as working. */
  private turnDepth = 0;

  // --- resume durumu ---
  /** Bu açılışta hangi id ile resume denendi (yoksa null). */
  private resumeAttempt: string | null = null;
  /** Bu açılışta SDK'dan system/init mesajı geldi mi? */
  private sawInit = false;
  /** loop() bitince sıfırdan yeniden başlatılmalı mı? */
  private resumeFailed = false;
  /**
   * Henüz sonuçlanmamış turların ham metni.
   *
   * Resume başarısız olursa oturum ölür ve kuyruktaki mesajlar kaybolur;
   * sıfırdan açılan oturuma bunları yeniden gönderebilmek için tutulur.
   */
  private inFlightMessages: string[] = [];

  constructor(
    config: AgentConfig,
    private personality: string,
    private store?: SessionStore,
  ) {
    super();
    this.config = config;
    this.currentModel = config.model;
    // Önceki çalıştırmadan kalan döküm panelde boş ekran görünmesin diye
    // hemen yüklenir; oturumun açık olması gerekmez.
    if (store) this.transcript = store.loadTranscript(config.id);
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

    // Önceki çalıştırmadan kalan oturum varsa modele geçmişi yükletiriz.
    const resume = this.store?.getSessionId(this.config.id);
    this.resumeAttempt = resume ?? null;
    this.sawInit = false;
    this.resumeFailed = false;

    this.currentModel = this.config.model;
    this.q = query({
      prompt: this.queue,
      options: { ...this.buildOptions(ws), ...(resume ? { resume } : {}) },
    });

    this.setStatus('idle');
    this.pushEvent({
      kind: 'system',
      text: resume
        ? `Oturum sürdürülüyor (model: ${this.resolveModel()})`
        : `Oturum başlatıldı (model: ${this.resolveModel()})`,
    });
    void this.loop();
    void this.refreshCommands();
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
    /**
     * Bütçe kapısı. Burada olmak ZORUNDA: aşağıdaki satır ölü oturumu
     * kendiliğinden yeniden başlatıyor, dolayısıyla "ajanı durdur" biçiminde
     * bir yaptırım bir sonraki mesajda kendiliğinden delinirdi.
     */
    const blocked = this.budgetGuard?.();
    if (blocked) {
      this.pushEvent({ kind: 'error', text: blocked });
      return;
    }
    if (!this.q || !this.queue) this.start();
    this.pushEvent({ kind: 'user', text });
    // Resume başarısız olursa oturumla birlikte bu mesaj da yok olur;
    // sıfırdan açılan oturuma yeniden gönderebilmek için sakla.
    this.inFlightMessages.push(text);
    this.turnDepth += 1;
    this.setStatus('working');
    // Otomatik model seçimi: sistem prompt'unun dibindeki talimat (özellikle
    // haiku'da) gözden kaçıyor; her mesajın başına kısa bir hatırlatma koy.
    // Transcript'e orijinal metin yazılır, hatırlatma yalnız modele gider.
    const wrapped =
      this.config.autoModel !== false
        ? `[Hatırlatma: yanıtlamadan önce görevin zorluğunu değerlendir; mevcut model (${this.currentModel}) uygun değilse önce mcp__self__set_model ile değiştir: basit→haiku, orta→sonnet, zor→opus.]\n\n${text}`
        : text;
    this.queue!.push({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: wrapped }] },
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
    this.currentModel = model;
    try {
      await this.q?.setModel(MODEL_ALIASES[model] ?? model);
    } catch {
      // applied on next start if session not in streaming state
    }
    this.emit('model_changed', model);
  }

  /**
   * Oturum-içi model geçişi (otomatik model seçimi): temel modeli
   * (config.model) DEĞİŞTİRMEZ; bir sonraki oturum başlangıcında temele dönülür.
   */
  async switchModel(model: string, reason?: string): Promise<void> {
    if (model === this.currentModel) return;
    const prev = this.currentModel;
    this.currentModel = model;
    try {
      await this.q?.setModel(MODEL_ALIASES[model] ?? model);
    } catch {
      this.currentModel = prev;
      throw new Error('Model değiştirilemedi (oturum akış durumunda değil).');
    }
    this.pushEvent({
      kind: 'system',
      text: `Model geçişi: ${prev} → ${model}${reason ? ` — ${reason}` : ''}`,
    });
    this.emit('model_changed', model);
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

    // Otomatik model seçimi: ajan her görevin zorluğunu kendisi değerlendirip
    // mcp__self__set_model ile motoru değiştirir (varsayılan açık).
    const autoModelInstructions =
      this.config.autoModel !== false
        ? `\n\n# Otomatik model seçimi\n` +
          `Temel modelin: ${this.config.model}. Her yeni görev/mesaja başlarken önce işin zorluğunu ` +
          `değerlendir; mevcut model uygun değilse İLK İŞ olarak mcp__self__set_model aracını çağır, ` +
          `sonra göreve devam et:\n` +
          `- haiku → basit işler: kısa cevap, özet, listeleme, tek dosya okuma, basit arama\n` +
          `- sonnet → orta işler: kod yazma/düzenleme, çok adımlı görevler, araştırma + sentez\n` +
          `- opus → zor işler: mimari kararlar, karmaşık hata ayıklama, geniş refactor, kritik kod\n` +
          `Model zaten uygunsa aracı çağırma. Yükseltme görev-bazlıdır: tur bitince otomatik ` +
          `olarak temel modele dönülür, her yeni görevde yeniden değerlendirirsin.`
        : '';

    // Ajanın kendi skill'leri agents/<id>/ altında bir yerel plugin olarak durur
    // (agents/<id>/.claude-plugin/plugin.json + skills/<ad>/SKILL.md). Plugin yolu
    // settingSources'tan bağımsız çalışır; böylece izolasyon bozulmadan ajan
    // sohbette /<skill-adı> yazarak skill'i çağırabilir.
    const dir = agentDir(this.config.id);
    const hasSkills =
      fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json')) &&
      fs.existsSync(path.join(dir, 'skills'));

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
          memoryInstructions +
          autoModelInstructions,
      },
      // Tam Claude Code CLI paritesi: kullanıcının kendi ~/.claude skill'leri,
      // plugin'leri, komutları ve CLAUDE.md'si ajanlarda da geçerli olsun.
      settingSources: ['user', 'project', 'local'],
      plugins: hasSkills ? [{ type: 'local', path: dir, skipMcpDiscovery: true }] : undefined,
      additionalDirectories: memoryDirs,
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
      // Bozuk resume iki biçimde gelebilir: önce `error_during_execution`
      // sonuçlu bir result (case 'result' yakalar) ya da doğrudan fırlatma.
      // İkincisinde de geri düşmeliyiz, yoksa ajan anlaşılmaz bir hatayla
      // çevrimdışı kalır ve kayıtlı bozuk id bir daha hep denenir.
      if (!this.sawInit && this.resumeAttempt) this.resumeFailed = true;
      this.pushEvent({ kind: 'error', text: `Oturum hatası: ${(err as Error).message}` });
    } finally {
      const retry = this.resumeFailed;
      const replay = retry ? [...this.inFlightMessages] : [];
      this.cleanup();

      /**
       * Resume geri düşüşü.
       *
       * Bozuk/eskimiş bir sessionId ile açılan sorgu HATA FIRLATMAZ — ampirik
       * olarak ölçüldü: system/init hiç gelmez ve tur `error_during_execution`
       * ile sonuçlanır. Yani başarısızlık ancak bu noktada, döngü bittikten
       * sonra anlaşılır. Kayıtlı id'yi atıp sıfırdan açıyor ve kaybolan
       * mesajları yeniden gönderiyoruz.
       */
      if (retry) {
        this.store?.clearSessionId(this.config.id);
        this.pushEvent({
          kind: 'system',
          text: 'Önceki oturum yüklenemedi (kayıt eskimiş olabilir); sıfırdan başlatıldı.',
        });
        this.start();
        for (const text of replay) this.send(text);
      }
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
    this.inFlightMessages = [];
    this.currentActivity = undefined;
    this.contextTokens = 0;
    this.setStatus('offline');
  }

  /**
   * Oturumun slash komut listesini SDK'dan çeker. supportedCommands() yalnızca
   * açılışta yakalanan listeyi döndürür; orta-oturum değişiklikleri
   * `system/commands_changed` mesajıyla gelir (bkz. handleMessage).
   */
  private async refreshCommands(): Promise<void> {
    try {
      const commands = await this.q?.supportedCommands();
      if (commands) this.setCommands(commands);
    } catch {
      // Komut listesi alınamazsa panel yalnızca otomatik tamamlamayı kaybeder;
      // oturumun kendisi çalışmaya devam eder.
    }
  }

  /**
   * Panelin istemci tarafı komutlarının çıktısını (ör. /usage) döküme yazar.
   * Modele gönderilmez; sadece diğer olaylarla aynı akışta saklanıp yayınlanır
   * ki ajanlar arasında gezerken veya sayfa yenilenince kaybolmasın.
   */
  pushLocal(kind: 'user' | 'local' | 'error', text: string): void {
    this.pushEvent({ kind, text });
  }

  /**
   * `/usage`ın arkasındaki plan kotası verisi (5 saatlik / 7 günlük pencereler).
   *
   * SDK bu metodu deneysel işaretliyor ve habersiz kaldırabileceğini söylüyor,
   * bu yüzden çağrı yutulur: veri gelmezse panel kendi token sayımıyla devam
   * eder, hata vermez.
   */
  async planUsage(): Promise<unknown | null> {
    try {
      const q = this.q as unknown as {
        usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET?: () => Promise<unknown>;
      } | null;
      return (await q?.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET?.()) ?? null;
    } catch {
      return null;
    }
  }

  private setCommands(commands: SlashCommand[]): void {
    this.commands = commands.map((c) => ({
      name: c.name,
      description: c.description,
      argumentHint: c.argumentHint || undefined,
      aliases: c.aliases,
    }));
    this.emit('commands_changed', this.commands);
  }

  private handleMessage(msg: SDKMessage): void {
    switch (msg.type) {
      case 'system': {
        if (msg.subtype === 'init') {
          // init'in gelmesi = oturum gerçekten kuruldu. Resume denendiyse
          // başarılı demektir; gelmezse loop() sonunda geri düşülür.
          this.sawInit = true;
          this.sessionId = msg.session_id;
          this.store?.setSessionId(this.config.id, msg.session_id);
        } else if (msg.subtype === 'commands_changed') {
          this.setCommands((msg as { commands?: SlashCommand[] }).commands ?? []);
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
        /**
         * Resume başarısızlığı buraya düşer: init hiç gelmemişse oturum
         * kurulamamış demektir. Bu bir TUR SONUCU DEĞİL — kullanım sayılmaz,
         * hata olayı yazılmaz ve özellikle `turn_complete` YAYILMAZ; yoksa
         * görev kuyruğu çalışan bir görevi yanlışlıkla "başarısız" kapatır.
         * Gerçek toparlanma loop()'un finally'sinde yapılır.
         */
        if (!this.sawInit && this.resumeAttempt) {
          this.resumeFailed = true;
          break;
        }
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
        // Bağlam doluluğu ≈ son isteğin girdi tarafı (taze + cache'ten okunan)
        this.contextTokens =
          (usage?.input_tokens ?? 0) +
          (usage?.cache_read_input_tokens ?? 0) +
          (usage?.cache_creation_input_tokens ?? 0);
        this.emit('usage', this.usage);

        const isError = msg.subtype !== 'success';
        const resultText = (msg as { result?: string }).result ?? (isError ? `Hata: ${msg.subtype}` : '');
        this.pushEvent({
          kind: isError ? 'error' : 'result',
          text: resultText,
          meta: { subtype: msg.subtype, costUSD: (msg as { total_cost_usd?: number }).total_cost_usd },
        });
        this.turnDepth = Math.max(0, this.turnDepth - 1);
        this.inFlightMessages.shift(); // bu tur sonuçlandı, tekrar gönderilmeyecek
        this.currentActivity = undefined;
        if (this.turnDepth === 0) this.setStatus('idle');
        // Otomatik model seçimi: yükseltme görev-bazlıdır — tur bitince temel
        // modele dön (dinlenme hâli her zaman ucuz model; sonraki görev
        // gerekirse yeniden yükseltir).
        if (
          this.turnDepth === 0 &&
          this.config.autoModel !== false &&
          this.currentModel !== this.config.model
        ) {
          void this.switchModel(this.config.model, 'tur bitti — temel modele dönüş').catch(() => {});
        }
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
    this.store?.appendEvent(this.config.id, event);
    if (this.transcript.length > MAX_TRANSCRIPT) this.transcript.splice(0, this.transcript.length - MAX_TRANSCRIPT);
    this.emit('event', event);
  }
}
