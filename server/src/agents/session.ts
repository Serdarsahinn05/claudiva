import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { SessionStore } from './sessionStore.js';
import type { AgentBackend, BackendEvent, InspectPart, SessionInspect } from './backend.js';
import { createBackend } from './backends/index.js';
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
import { agentWorkspaceDir } from '../paths.js';
import { S } from '../i18n.js';

const MAX_TRANSCRIPT = 500;

/** Claude Code'un seçenekli soru aracı (panel bunu izin değil soru kartı olarak çizer). */
export const QUESTION_TOOL = 'AskUserQuestion';

export interface SessionEvents {
  status: (status: AgentStatus) => void;
  event: (event: TranscriptEvent) => void;
  permission_request: (req: PermissionRequestInfo) => void;
  permission_resolved: (requestId: string) => void;
  usage: (usage: TokenUsage) => void;
  /**
   * A turn finished (result message received). Carries the final result text.
   *
   * `taskId` yalnızca tur bir görev olarak gönderildiyse doludur. Sohbet
   * turlarında undefined gelir — kuyruk bu turları görmezden gelmelidir.
   */
  turn_complete: (resultText: string, isError: boolean, taskId?: string) => void;
  /**
   * Bir görev turu sonuçlanmadan oturum kapandı. Bu olmadan görev sonsuza
   * kadar `running` asılı kalırdı.
   */
  turn_abandoned: (taskId: string) => void;
  /** Model switched (auto-model self-assessment or panel edit). */
  model_changed: (model: string) => void;
  /** Kullanılabilir slash komutları değişti (oturum açılışı veya orta-oturum keşif). */
  commands_changed: (commands: SlashCommand[]) => void;
}

interface PendingPermission {
  info: PermissionRequestInfo;
  resolve: (r: { behavior: 'allow' | 'deny'; updatedInput?: Record<string, unknown>; message?: string }) => void;
}

/**
 * Bir ajan = bir backend (bkz. agents/backend.ts, agents/backends/*) + bu
 * sınıfın tuttuğu SAĞLAYICIDAN BAĞIMSIZ defter: döküm, bütçe, görev↔tur
 * korelasyonu, izin bekletme, durum makinesi. "Modele nasıl konuşulur"
 * sorusunun cevabı burada YOKTUR — o backend'e ait. Bu ayrım bilerek:
 * yeni bir sağlayıcı eklemek yalnızca backends/ altına bir dosya + bir
 * `createBackend` dalı ister, bu dosyaya dokunmaz.
 *
 * Sunucu yeniden başladığında oturum ölür. sessionId diske yazılır ve
 * sonraki açılışta backend'e `resumeId` olarak verilir (bkz. SessionStore) —
 * yalnızca backend'in `capabilities.resume` true olduğu durumda.
 */
export class AgentSession extends EventEmitter {
  readonly config: AgentConfig;
  status: AgentStatus = 'offline';
  usage: TokenUsage = zeroUsage();
  /**
   * YALNIZCA son turun payı. `usage` tümel toplam (diskten geri yükleniyor) ve
   * ondan tur payı türetilemez; panelin "bu tur ne kadara mal oldu" okuması
   * bunu ister. Oturum kapanınca sıfırlanmaz: kapalı bir ajanın son turu da
   * okunabilir kalmalı (`cleanup()` bu alana dokunmaz).
   */
  lastTurn: TokenUsage | null = null;
  transcript: TranscriptEvent[] = [];
  sessionId?: string;
  currentActivity?: string;
  /** Son turdaki bağlam doluluğu (input + cache token) — panel yakıt göstergesi */
  contextTokens = 0;
  /** Oturumun şu an kullandığı model. Otomatik model seçimi config.model'i
   *  (temel modeli) değiştirmeden bunu oynatır. */
  currentModel: string;
  /** Son turun bitiş anı. Yönlendirici önbelleğin sıcak olup olmadığını buradan
   *  kestirir (router/index.ts WARM_MS). */
  lastTurnAt?: number;
  /** Bu oturumda "/" ile çağrılabilen komutlar; panelin otomatik tamamlaması bunu kullanır. */
  commands: SlashCommand[] = [];
  /**
   * Bütçe muhafızı. Yeni iş kabul edilemiyorsa gerekçe döner, aksi hâlde null.
   * Manager tarafından bağlanır — oturum manager'ı tanımasın diye geri çağırım.
   */
  budgetGuard?: () => string | null;

  private backend: AgentBackend | null = null;
  private pending = new Map<string, PendingPermission>();
  /** Set while a turn is in flight so queued sends show as working. */
  private turnDepth = 0;

  /**
   * Henüz sonuçlanmamış turlar: ham metin + (varsa) görev kimliği.
   *
   * İki işi birden görür:
   *  1. **Korelasyon.** Mesajlar sırayla işlendiği için bu dizinin başı = şu an
   *     işlenen tur. `result` gelince baştaki tur çıkarılır ve `taskId`
   *     `turn_complete` ile birlikte yayılır. Böylece bir görev çalışırken
   *     araya giren sohbet mesajı görevi yanlışlıkla kapatamaz.
   *  2. **Resume geri düşüşü.** Oturum ölürse kuyruktaki mesajlar kaybolur;
   *     sıfırdan açılan oturuma görev kimliğiyle birlikte yeniden gönderilir.
   */
  private inFlightTurns: { text: string; taskId?: string; routed?: boolean }[] = [];

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

  /**
   * Şu an işlenmekte olan turun görev kimliği (yoksa undefined).
   * Dosya değişikliği atfı bunu kullanır: ajan bir dosyaya dokunduğunda
   * hangi görev bağlamında olduğunu bilmek gerekir.
   */
  get currentTaskId(): string | undefined {
    return this.inFlightTurns[0]?.taskId;
  }

  start(): void {
    if (this.backend) return;
    const backend = createBackend(this.config.provider ?? 'claude');
    this.backend = backend;
    // Kimlik denetimi: cleanup() backend'i null'ladıktan (ya da yeni bir
    // start() farklı bir backend ata dıktan) sonra bu ÖZEL nesneden gelen
    // gecikmiş bir olay artık geçerli değildir. Yalnızca nullness kontrolü
    // ("if (!this.backend) return") bunu YAKALAMAZ: cleanup+restart tek bir
    // senkron akışta olduğunda `this.backend` restart sonrası tekrar dolu
    // olur, ama YENİ backend'e ait değildir. Ölçülen bir yarışın (8 ajanı
    // paralel durdurmada ~1/8 oranında `offline`dan `idle`ya geri dönme)
    // kökeni tam olarak buydu; kimlik kontrolü nullness kontrolünü kapsar.
    backend.on('message', (e) => {
      if (this.backend !== backend) return;
      this.onBackendMessage(e);
    });
    backend.on('exit', (info) => {
      if (this.backend !== backend) return;
      this.onBackendExit(info);
    });

    const ws = agentWorkspaceDir(this.config.id);
    fs.mkdirSync(ws, { recursive: true });

    const resumeId = backend.capabilities.resume ? this.store?.getSessionId(this.config.id) : undefined;

    backend.start({
      config: this.config,
      personality: this.personality,
      workspace: ws,
      resumeId,
      mcpServers: this.config.mcpServers ?? {},
      extraMcpServers: this.extraMcpServers,
      extraAllowedTools: this.extraAllowedTools,
      canUseTool: this.buildCanUseTool(),
      // Yönlendirici kapalı bir oturumu ucuz modelle açmaya karar verdiyse
      // (applyRoute) currentModel zaten o modeldir; aksi hâlde temel model.
      model: this.currentModel,
    });

    this.setStatus('idle');
    this.pushEvent({
      kind: 'system',
      text: resumeId
        ? S.sessionResumed(this.currentModel)
        : S.sessionStarted(this.currentModel),
    });
    void this.refreshCommands();
  }

  async stop(): Promise<void> {
    if (!this.backend) return;
    await this.backend.stop();
    this.cleanup();
  }

  /**
   * Send a user message to this agent.
   *
   * `taskId` verilirse bu tur o göreve aittir ve sonucu `turn_complete` ile
   * birlikte geri döner. Sohbet mesajlarında verilmez.
   */
  send(text: string, taskId?: string, opts: { replay?: boolean; routed?: boolean } = {}): void {
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
    if (!this.backend) this.start();
    // Resume geri düşüşündeki yeniden gönderimde mesaj dökümde ZATEN var;
    // tekrar yazmak aynı mesajı iki kez gösteriyordu (ölçüldü: başka cwd'de
    // açılan oturumda her ajanın ilk mesajı çift çıkıyordu).
    if (!opts.replay) this.pushEvent({ kind: 'user', text });
    this.inFlightTurns.push({ text, taskId, routed: opts.routed });
    this.turnDepth += 1;
    this.setStatus('working');
    // Yönlendirilmiş görevde modeli yönlendirici seçti: "modeli değerlendir,
    // gerekirse değiştir" hatırlatması gönderilmez — oturum ortasında model
    // değişimi soğuk önbellek demek (ölçüldü, router/index.ts).
    this.backend!.send(text, { reminder: !opts.routed });
  }

  /** Yönlendiricinin okuduğu oturum durumu. */
  routeState(): { base: string; current: string; alive: boolean; busy: boolean; lastTurnAt?: number } {
    return {
      base: this.config.model,
      current: this.currentModel,
      alive: this.backend !== null,
      // Sürmekte olan bir tur varken model değiştirmek o turu yarıda başka
      // modele geçirir; yönlendirici bu durumda modeli korur.
      busy: this.turnDepth > 0,
      lastTurnAt: this.lastTurnAt,
    };
  }

  /**
   * Yönlendirici kararını uygular. Oturum kapalıysa yalnız currentModel
   * ayarlanır; sonraki start() o modelle açar (ek tur yok). Açıksa oturum içi
   * geçiş yapılır; başarısız olursa görev mevcut modelle sürer (karar kaydı
   * yine yazılır, panel gerçek modeli turdaki kayıttan görür).
   */
  async applyRoute(model: string, reason: string): Promise<void> {
    if (!this.backend) {
      this.currentModel = model;
      return;
    }
    if (model === this.currentModel) return;
    await this.switchModel(model, reason).catch(() => {});
  }

  async interrupt(): Promise<void> {
    await this.backend?.interrupt();
    this.pushEvent({ kind: 'system', text: S.taskStoppedByUser });
  }

  /** Panelden temel model değişikliği. Hata olursa sessizce yutulur —
   *  bir sonraki start()'ta yeni temel modelle açılır. */
  async setModel(model: string): Promise<void> {
    this.config.model = model;
    this.currentModel = model;
    try {
      await this.backend?.setModel(model);
    } catch {
      // sonraki start()'ta uygulanır
    }
    this.emit('model_changed', model);
  }

  /**
   * Oturum-içi model geçişi (otomatik model seçimi): temel modeli
   * (config.model) DEĞİŞTİRMEZ; bir sonraki oturum başlangıcında temele dönülür.
   * setModel()'in aksine BAŞARISIZLIĞI YUTMAZ — currentModel'i geri alıp
   * fırlatır (mcp__self__set_model çağıranı bunu bilmeli).
   */
  async switchModel(model: string, reason?: string): Promise<void> {
    if (model === this.currentModel) return;
    const prev = this.currentModel;
    this.currentModel = model;
    try {
      await this.backend?.setModel(model);
    } catch {
      this.currentModel = prev;
      throw new Error(S.modelSwitchFailed);
    }
    this.pushEvent({
      kind: 'system',
      text: S.modelSwitch(prev, model, reason),
    });
    this.emit('model_changed', model);
  }

  /**
   * @param answers Seçenekli soru (`AskUserQuestion`) cevabı: soru metni →
   *   seçilen etiket(ler). CLI cevabı aracın girdisindeki `answers`tan okur
   *   (ölçüldü: "Your questions have been answered: "…"="Blue"").
   */
  resolvePermission(requestId: string, allow: boolean, message?: string, answers?: Record<string, string>): boolean {
    const p = this.pending.get(requestId);
    if (!p) return false;
    this.pending.delete(requestId);
    if (allow) {
      p.resolve({ behavior: 'allow', updatedInput: answers ? { ...p.info.input, answers } : p.info.input });
    } else {
      p.resolve({ behavior: 'deny', message: message || 'The user denied this action.' });
    }
    this.emit('permission_resolved', requestId);
    if (this.pending.size === 0 && this.status === 'waiting') this.setStatus('working');
    return true;
  }

  /** Extra in-process MCP servers (e.g. boss delegation tools). Set before start().
   *  Şekli backend'e özeldir (Claude için SDK'nın McpServerConfig'i) — bu
   *  sınıf içeriğini hiç incelemez, olduğu gibi backend.start()'a geçirir. */
  extraMcpServers: Record<string, unknown> = {};
  extraAllowedTools: string[] = [];

  // ------------------------------------------------------------------

  /**
   * canUseTool kapanışı. Backend'e opak geçirilir (BackendStartOptions.canUseTool);
   * `this.pending`/`this.setStatus`/`this.emit` kullandığı için genel — hangi
   * backend çağırırsa çağırsın aynı izin akışını üretir.
   */
  private buildCanUseTool() {
    return async (
      toolName: string,
      input: Record<string, unknown>,
      opts: { title?: string; description?: string; signal: AbortSignal },
    ): Promise<{ behavior: 'allow' | 'deny'; updatedInput?: Record<string, unknown>; message?: string }> => {
      // Seçenekli soru bir izin değil, kullanıcıya soru: oto-onay onu ASLA
      // geçemez. Geçseydi araç cevapsız "onaylanır" ve ajan sormadan sürerdi.
      if (this.config.autoApprove && toolName !== QUESTION_TOOL) {
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
      return await new Promise((resolve) => {
        this.pending.set(info.id, { info, resolve });
        this.emit('permission_request', info);
        opts.signal.addEventListener('abort', () => {
          if (this.pending.delete(info.id)) {
            this.emit('permission_resolved', info.id);
            resolve({ behavior: 'deny', message: 'The action was cancelled.' });
          }
        });
      });
    };
  }

  /**
   * @param abandon Sonuçlanmamış görev turları "terk edildi" sayılsın mı.
   *   Resume geri düşüşünde `false` verilir: turlar kaybolmuyor, birazdan
   *   yeni oturuma aynı kimlikle yeniden gönderilecekler.
   */
  private cleanup(abandon = true): void {
    for (const [id, p] of this.pending) {
      p.resolve({ behavior: 'deny', message: 'The session closed.' });
      this.emit('permission_resolved', id);
    }
    this.pending.clear();
    if (abandon) {
      // Haber vermezsek bu görevler kuyrukta sonsuza dek `running` asılı kalır.
      for (const turn of this.inFlightTurns) {
        if (turn.taskId) this.emit('turn_abandoned', turn.taskId);
      }
    }
    this.backend = null;
    this.turnDepth = 0;
    this.inFlightTurns = [];
    // Kapanan oturumun modeli (yükseltilmiş ya da yönlendirilmiş) bir sonraki
    // açılışa sızmasın: start() artık currentModel ile açıyor.
    this.currentModel = this.config.model;
    this.currentActivity = undefined;
    this.contextTokens = 0;
    this.setStatus('offline');
  }

  /**
   * Backend'in exit bildirimi. `resumeFailed` true ise (yalnızca Claude'un
   * bozuk/eskimiş sessionId durumunda) kayıtlı id silinir, sıfırdan açılır,
   * kaybolan mesajlar görev kimlikleriyle yeniden gönderilir.
   */
  private onBackendExit(info: { resumeFailed: boolean }): void {
    const replay = info.resumeFailed ? [...this.inFlightTurns] : [];
    this.cleanup(!info.resumeFailed);
    if (info.resumeFailed) {
      this.store?.clearSessionId(this.config.id);
      this.pushEvent({
        kind: 'system',
        text: S.resumeFallback,
      });
      this.start();
      // Görev kimliğiyle birlikte: aksi hâlde yeniden gönderilen görev
      // sohbet turu sanılır ve kuyrukta kapanmadan kalır.
      for (const turn of replay) this.send(turn.text, turn.taskId, { replay: true, routed: turn.routed });
    }
  }

  /**
   * Backend'in normalleştirilmiş olayı — döküm/bütçe/korelasyon/durum
   * mantığının TEK yeri. Hangi backend gönderirse göndersin aynı şekilde işlenir.
   */
  private onBackendMessage(e: BackendEvent): void {
    switch (e.kind) {
      case 'system': {
        if (e.subtype === 'init') {
          if (e.sessionId) {
            this.sessionId = e.sessionId;
            this.store?.setSessionId(this.config.id, e.sessionId);
          }
        } else if (e.subtype === 'commands_changed') {
          this.setCommands(e.commands ?? []);
        } else if (e.subtype === 'session_state_changed') {
          if (e.state === 'running') this.setStatus('working');
          else if (e.state === 'requires_action') this.setStatus('waiting');
          else if (e.state === 'idle' && this.turnDepth <= 0) this.setStatus('idle');
        }
        break;
      }
      case 'text':
        this.pushEvent({ kind: 'text', text: e.text });
        break;
      case 'thinking':
        this.pushEvent({ kind: 'thinking', text: e.text });
        break;
      case 'tool_use':
        this.currentActivity = e.toolName;
        this.pushEvent({ kind: 'tool_use', toolName: e.toolName, input: e.input });
        break;
      case 'tool_result':
        this.pushEvent({ kind: 'tool_result', text: e.text, meta: e.meta });
        break;
      case 'error':
        this.pushEvent({ kind: 'error', text: e.text });
        break;
      case 'result': {
        const turn: TokenUsage = {
          inputTokens: e.usage?.inputTokens ?? 0,
          outputTokens: e.usage?.outputTokens ?? 0,
          cacheReadTokens: e.usage?.cacheReadTokens ?? 0,
          cacheCreationTokens: e.usage?.cacheCreationTokens ?? 0,
          costUSD: e.costUSD ?? 0,
          requests: 1,
        };
        this.lastTurn = turn;
        this.lastTurnAt = Date.now();
        addUsage(this.usage, turn);
        // Bağlam doluluğu ≈ son isteğin girdi tarafı (taze + cache'ten okunan)
        this.contextTokens =
          (e.usage?.inputTokens ?? 0) + (e.usage?.cacheReadTokens ?? 0) + (e.usage?.cacheCreationTokens ?? 0);
        this.emit('usage', this.usage);

        this.pushEvent({
          kind: e.isError ? 'error' : 'result',
          text: e.text,
          meta: { costUSD: e.costUSD },
        });
        this.turnDepth = Math.max(0, this.turnDepth - 1);
        // Bu tur sonuçlandı: tekrar gönderilmeyecek, kimliği sonuca eşlik edecek.
        const finished = this.inFlightTurns.shift();
        this.currentActivity = undefined;
        if (this.turnDepth === 0) this.setStatus('idle');
        // Otomatik model seçimi: ajanın KENDİ yükseltmesi (set_model) görev-
        // bazlıdır — tur bitince temel modele dön. Yönlendirilmiş görev turunda
        // DÖNÜLMEZ: model yönlendiricinin kararıdır ve sonraki görevi yine o
        // verir. Dönülseydi ardışık küçük görevler "sıcak oturum, düşürme yok"
        // kuralına takılıp hep temel modelde kalırdı (yönlendirme boşa çıkardı).
        if (
          this.turnDepth === 0 &&
          this.config.autoModel !== false &&
          !finished?.routed &&
          this.currentModel !== this.config.model
        ) {
          void this.switchModel(this.config.model, S.reasonTurnEnded).catch(() => {});
        }
        this.emit('turn_complete', e.text, e.isError, finished?.taskId);
        break;
      }
    }
  }

  /**
   * Oturumun slash komut listesini backend'den çeker. Açılışta ve orta-oturum
   * `commands_changed` olayında çağrılır. Hata/boş dönerse MEVCUT listeye
   * dokunmaz — geçici bir hata panelin "/" menüsünü boşaltmasın diye.
   */
  private async refreshCommands(): Promise<void> {
    try {
      const commands = await this.backend?.refreshCommands();
      if (commands && commands.length) this.setCommands(commands);
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

  /** Yalnızca Claude backend'inde anlamlı deneysel plan-kotası verisi. */
  async planUsage(): Promise<unknown | null> {
    return (await this.backend?.planUsage()) ?? null;
  }

  /**
   * Yerleşik slash komutlarının okuduğu oturum iç görüsü (`/context`, `/model`,
   * `/mcp`, `/agents`, `/status`). Oturum kapalıysa backend yok — istenen her
   * parça "okunamadı" (null) döner ki panel "kapalı" ile "boş"u ayırabilsin.
   */
  async inspect(parts: InspectPart[]): Promise<SessionInspect> {
    if (!this.backend) return Object.fromEntries(parts.map((p) => [p, null]));
    return await this.backend.inspect(parts);
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
