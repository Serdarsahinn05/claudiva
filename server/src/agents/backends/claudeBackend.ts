import { EventEmitter } from 'node:events';
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
import { AsyncQueue } from '../asyncQueue.js';
import { claudeExecutable } from '../claudeExecutable.js';
import type { AgentConfig, SlashCommand } from '../../types.js';
import { agentDir, agentMemoryDir, SHARED_MEMORY_DIR } from '../../paths.js';
import { S, agentFacing } from '../../i18n.js';
import type {
  AgentBackend,
  BackendCapabilities,
  BackendEvent,
  BackendSendOptions,
  BackendStartOptions,
  InspectPart,
  SessionInspect,
} from '../backend.js';

// Kısa adlar (`sonnet` vb.) Claude Code'a OLDUĞU GİBİ gider: CLI onları o
// anki en güncel sürüme çözer. Sabit tablo yeni sürümde paneli eskide
// bırakıyordu (bkz. agents/models.ts).

const TRUNCATE_INPUT = 2000;

/**
 * Mesaj CLI'a bir slash komutu olarak mı gidiyor? Kural CLI'ın kendi kuralı:
 * ilk karakter "/" olmalı ve ardından bir komut adı gelmeli ("/" tek başına ya
 * da "/ " komut değildir). Yol adları ("/usr/bin/x") boşluk barındırmadan
 * gelebildiği için ad karakter kümesi dar tutuldu.
 */
function isSlashCommand(text: string): boolean {
  return /^\/[a-z0-9][a-z0-9:_-]*(\s|$)/i.test(text.trimStart());
}

/**
 * Claude Agent SDK'nın `query()`'sini `AgentBackend`'e uyarlar.
 *
 * `AgentSession`'dan taşınan mantık burada DAVRANIŞ OLARAK DEĞİŞMEDİ — yalnızca
 * SDK'ya özel kısım (Options inşası, `SDKMessage` çevirisi, resume tuhaflığı)
 * buraya taşındı; döküm/bütçe/görev-korelasyonu gibi genel defter tutma
 * `AgentSession`'da kaldı (bkz. session.ts başındaki yorum).
 */
export class ClaudeBackend extends EventEmitter implements AgentBackend {
  readonly capabilities: BackendCapabilities = {
    resume: true,
    liveModelSwitch: true,
    slashCommands: true,
    mcpTools: true,
    costUSD: true,
    introspect: true,
  };

  private config!: AgentConfig;
  private personality = '';
  private opts!: BackendStartOptions;
  private queue: AsyncQueue<SDKUserMessage> | null = null;
  private q: Query | null = null;
  private abort: AbortController | null = null;

  // --- resume durumu ---
  /** Bu açılışta hangi id ile resume denendi (yoksa null). */
  private resumeAttempt: string | null = null;
  /** Bu açılışta SDK'dan system/init mesajı geldi mi? */
  private sawInit = false;
  /** loop() bitince "resume başarısız, yeniden dene" mi bildirilecek? */
  private resumeFailed = false;

  /** Oturumun şu anki modeli: açılış modeli (yönlendirici) ya da son setModel. */
  private activeModel: string | null = null;

  private resolveModel(): string {
    return this.activeModel ?? this.config.model;
  }

  start(opts: BackendStartOptions): void {
    if (this.q) return;
    // İkili yoksa SDK `query()` İÇİNDE senkron fırlatır (ölçüldü); loop()'un
    // catch'ine hiç ulaşmaz. Oturum açılış akışını bitirsin diye olaylar bir
    // sonraki tikte: önce anlaşılır mesaj, sonra kapanış (ajan çevrimdışı).
    if (claudeExecutable().source === 'missing') {
      setImmediate(() => {
        this.emit('message', { kind: 'error', text: S.claudeNotFound } satisfies BackendEvent);
        this.emit('exit', { resumeFailed: false });
      });
      return;
    }
    this.opts = opts;
    this.config = opts.config;
    this.activeModel = opts.model ?? null;
    this.personality = opts.personality;
    this.queue = new AsyncQueue<SDKUserMessage>();
    this.abort = new AbortController();

    this.resumeAttempt = opts.resumeId ?? null;
    this.sawInit = false;
    this.resumeFailed = false;

    this.q = query({
      prompt: this.queue,
      options: { ...this.buildSdkOptions(opts), ...(opts.resumeId ? { resume: opts.resumeId } : {}) },
    });

    void this.loop();
  }

  send(text: string, opts: BackendSendOptions = {}): void {
    // Otomatik model seçimi: sistem prompt'unun dibindeki talimat (özellikle
    // haiku'da) gözden kaçıyor; her mesajın başına kısa bir hatırlatma koy.
    // Transcript'e orijinal metin AgentSession tarafından yazılır, bu
    // hatırlatma yalnız modele gider — mcp__self__set_model'e referans verdiği
    // için Claude'a özel, bu yüzden AgentSession'da değil burada.
    //
    // SLASH KOMUTLARI HATIRLATMA ALMAZ. CLI bir mesajı ancak İLK KARAKTERİ "/"
    // ise komut olarak ayrıştırır; önüne bir satır eklemek "/compact"i düz
    // metne çevirir ve komut sessizce hiç çalışmaz (yalnızca model onu okur).
    // Panelin yerleşik komutları bu yüzden karşılıksız kalıyordu.
    const wrapped =
      this.config.autoModel !== false && opts.reminder !== false && !isSlashCommand(text)
        ? `[Reminder: before answering, judge how hard the task is; if the current model (${this.resolveModel()}) does not fit, switch first with mcp__self__set_model: simple→haiku, medium→sonnet, hard→opus.]\n\n${text}`
        : text;
    this.queue?.push({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: wrapped }] },
      parent_tool_use_id: null,
    });
  }

  async interrupt(): Promise<void> {
    try {
      await this.q?.interrupt();
    } catch {
      // oturum zaten bitmiş olabilir
    }
  }

  async stop(): Promise<void> {
    if (!this.q) return;
    this.queue?.end();
    try {
      await this.q.interrupt();
    } catch {
      // oturum zaten bitmiş olabilir
    }
    this.abort?.abort();
  }

  /**
   * `this.q` yoksa (oturum kapalı) sessizce çözülür — optional chaining
   * bunu doğal olarak yapar. SDK gerçekten reddederse (ör. oturum akış
   * durumunda değil) bilerek YUTULMAZ: iki farklı çağıran (setModel vs.
   * switchModel) bu hataya iki farklı tepki veriyor (biri yutar, biri
   * currentModel'i geri alıp yeniden fırlatır) — o ilke AgentSession'da
   * kalmalı, burada tek tip davranış dayatılmamalı.
   */
  async setModel(model: string): Promise<void> {
    await this.q?.setModel(model);
    // Başarılıysa hatırlatmadaki "mevcut model" de doğru modeli söylesin.
    if (this.q) this.activeModel = model;
  }

  /** `this.q` yoksa boş dizi; SDK gerçekten reddederse çağırana yansır
   *  (AgentSession kendi try/catch'iyle yutar, mevcut listeyi korur). */
  async refreshCommands(): Promise<SlashCommand[]> {
    return (await this.q?.supportedCommands()) ?? [];
  }

  /**
   * `/usage`ın arkasındaki plan kotası verisi (5 saatlik / 7 günlük pencereler).
   * SDK bu metodu deneysel işaretliyor ve habersiz kaldırabileceğini söylüyor,
   * bu yüzden çağrı yutulur.
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

  /**
   * SDK'nın kontrol isteklerini normalleştirilmiş iç görüye çevirir.
   *
   * Her parça KENDİ try/catch'inde: bunlar ayrı ayrı kontrol istekleri ve biri
   * (ör. oturum akış durumunda değilken `getContextUsage`) reddedince diğerleri
   * hâlâ geçerli. Tek bir try bloğu olsaydı `/status` gibi çok parçalı bir
   * komut tek bir kırık istek yüzünden tümüyle boşalırdı.
   */
  async inspect(parts: InspectPart[]): Promise<SessionInspect> {
    const q = this.q;
    const out: SessionInspect = {};
    if (!q) {
      // Oturum kapalı: istenen her parça "okunamadı" (null) — hiç istenmemiş
      // (undefined) ile karıştırılmasın.
      for (const p of parts) out[p] = null;
      return out;
    }

    const read = async <K extends InspectPart>(key: K, fn: () => Promise<SessionInspect[K]>) => {
      if (!parts.includes(key)) return;
      try {
        out[key] = await fn();
      } catch {
        out[key] = null;
      }
    };

    await Promise.all([
      read('context', async () => {
        const c = await q.getContextUsage();
        return {
          totalTokens: c.totalTokens,
          maxTokens: c.maxTokens,
          percentage: c.percentage,
          model: c.model,
          categories: c.categories.map((x) => ({ name: x.name, tokens: x.tokens })),
          memoryFiles: (c.memoryFiles ?? []).map((f) => ({
            path: f.path,
            type: f.type,
            tokens: f.tokens,
          })),
          mcpTools: (c.mcpTools ?? []).map((t) => ({
            name: t.name,
            serverName: t.serverName,
            tokens: t.tokens,
          })),
          systemTools: (c.systemTools ?? []).map((t) => ({ name: t.name, tokens: t.tokens })),
        };
      }),
      read('models', async () =>
        (await q.supportedModels()).map((m) => ({
          value: m.value,
          displayName: m.displayName,
          description: m.description,
        })),
      ),
      read('agents', async () =>
        (await q.supportedAgents()).map((a) => ({
          name: a.name,
          description: a.description,
          model: a.model,
        })),
      ),
      read('mcp', async () =>
        (await q.mcpServerStatus()).map((s) => ({
          name: s.name,
          status: s.status,
          toolCount: s.tools?.length ?? 0,
          error: s.error,
          scope: s.scope,
        })),
      ),
      read('account', async () => {
        const a = await q.accountInfo();
        return {
          email: a.email,
          organization: a.organization,
          subscriptionType: a.subscriptionType,
          apiProvider: a.apiProvider,
        };
      }),
    ]);

    return out;
  }

  // ------------------------------------------------------------------

  private buildSdkOptions(opts: BackendStartOptions): Options {
    const config = opts.config;
    const memoryDirs: string[] = [];
    if (config.memoryMode === 'shared' || config.memoryMode === 'both') {
      memoryDirs.push(SHARED_MEMORY_DIR);
    }
    if (config.memoryMode === 'private' || config.memoryMode === 'both') {
      const dir = agentMemoryDir(config.id);
      fs.mkdirSync(dir, { recursive: true });
      memoryDirs.push(dir);
    }

    const memoryInstructions = memoryDirs.length
      ? `\n\n# Memory\nYour persistent memory folders: ${memoryDirs.join(' , ')}\n` +
        `Before starting a task, read the relevant memory files. Write information of lasting ` +
        `value you learn during a task (decisions, preferences, project facts) into these folders ` +
        `as markdown files; one topic per file, linked with [[wikilink]]. ` +
        `Do not write down what is already recorded; update it.`
      : '';

    const autoModelInstructions =
      config.autoModel !== false
        ? // Görev mesajlarında modeli panelin yönlendiricisi seçer (router/);
          // model değişimi oturum ortasında soğuk önbellek demek (ölçüldü:
          // Sonnet'e bir geçiş ≈ $0.24), bu yüzden ajan yalnız GERÇEKTEN
          // gerektiğinde yükseltsin. Sohbet mesajlarında eski davranış sürer.
          `\n\n# Model choice\n` +
          `Your base model: ${config.model}. For task messages ("# Task (id: …)") the panel has ` +
          `already picked a model sized to the task; do not switch just to re-evaluate. Call ` +
          `mcp__self__set_model only if the work turns out clearly harder than the current model ` +
          `can handle (escalate), or for a plain chat message whose size clearly mismatches the model:\n` +
          `- haiku → simple: short answer, summary, listing, reading one file, simple search\n` +
          `- sonnet → medium: writing/editing code, multi-step tasks, research + synthesis\n` +
          `- opus → hard: architecture decisions, complex debugging, wide refactors, critical code\n` +
          `Switching models mid-session is expensive (the prompt cache is per model). After the ` +
          `turn the panel returns to the base model automatically.`
        : '';

    const dir = agentDir(config.id);
    const hasSkills =
      fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json')) &&
      fs.existsSync(path.join(dir, 'skills'));

    const mcpServers: Record<string, McpServerConfig> = {};
    for (const [name, def] of Object.entries(opts.mcpServers)) {
      if (def.type === 'stdio' && def.command) {
        mcpServers[name] = { type: 'stdio', command: def.command, args: def.args, env: def.env };
      } else if ((def.type === 'http' || def.type === 'sse') && def.url) {
        // Başlıklar (Authorization vb.) taşınmazsa yetki isteyen uzak sunucu
        // bağlanır ama her çağrıda 401 döner.
        mcpServers[name] = {
          type: def.type,
          url: def.url,
          ...(def.headers ? { headers: def.headers } : {}),
        } as McpServerConfig;
      }
    }
    // İşlem-içi sunucular (team/self/task delegasyon araçları) — AgentSession
    // içeriğini incelemeden opak taşıyor, burada SDK'nın gerçek tipine dönüyoruz.
    Object.assign(mcpServers, opts.extraMcpServers as Record<string, McpServerConfig>);

    return {
      model: this.resolveModel(),
      cwd: opts.workspace,
      // Ajan oturumunu işaretler: kullanıcının kendi hook'ları (ör. skill
      // kütüphanesinin SessionStart önerileri) bu değişkene bakıp Claudiva'nın
      // çalıştırdığı oturumlarda sessiz kalır. `env` verildiğinde SDK süreç
      // ortamını DEVRALMAZ, bu yüzden process.env'in tamamı taşınıyor.
      env: { ...process.env, CLAUDIVA_AGENT: '1' },
      pathToClaudeCodeExecutable: claudeExecutable().path,
      abortController: this.abort ?? undefined,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append:
          `# Identity\nYou are an agent named "${agentFacing(config, 'name')}". Your role: ${config.role}.\n\n` +
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
      allowedTools: opts.extraAllowedTools.length ? opts.extraAllowedTools : undefined,
      permissionMode: 'default',
      canUseTool: async (toolName, input, sdkOpts) => {
        const result = await opts.canUseTool(toolName, input as Record<string, unknown>, {
          title: sdkOpts.title,
          description: sdkOpts.description,
          signal: sdkOpts.signal,
        });
        const mapped: PermissionResult =
          result.behavior === 'allow'
            ? { behavior: 'allow', updatedInput: result.updatedInput ?? input }
            : { behavior: 'deny', message: result.message ?? 'Reddedildi.' };
        return mapped;
      },
      stderr: (data: string) => {
        if (process.env.DEBUG_AGENTS) console.error(`[${config.id}] ${data}`);
      },
    };
  }

  private async loop(): Promise<void> {
    if (!this.q) return;
    try {
      for await (const msg of this.q) {
        this.handleMessage(msg);
      }
    } catch (err) {
      // Bozuk resume iki biçimde gelebilir: önce `error_during_execution`
      // sonuçlu bir result (handleMessage'ın 'result' dalı yakalar) ya da
      // doğrudan fırlatma. İkincisinde de yakalamalıyız, yoksa ajan anlaşılmaz
      // bir hatayla çevrimdışı kalır ve kayıtlı bozuk id bir daha hep denenir.
      if (!this.sawInit && this.resumeAttempt) this.resumeFailed = true;
      else this.emit('message', { kind: 'error', text: S.sessionError((err as Error).message) } satisfies BackendEvent);
    } finally {
      const resumeFailed = this.resumeFailed;
      this.q = null;
      this.queue = null;
      this.abort = null;
      this.emit('exit', { resumeFailed });
    }
  }

  private handleMessage(msg: SDKMessage): void {
    switch (msg.type) {
      case 'system': {
        if (msg.subtype === 'init') {
          // init'in gelmesi = oturum gerçekten kuruldu. Resume denendiyse
          // başarılı demektir; gelmezse loop() sonunda 'exit' ile geri düşülür.
          // "Oturum başlatıldı" metni burada DEĞİL — AgentSession.start()
          // bunu senkron/iyimser olarak zaten bastı (bkz. session.ts), init
          // beklemek o mesajı geciktirir/çiftler.
          this.sawInit = true;
          this.emit('message', { kind: 'system', subtype: 'init', sessionId: msg.session_id } satisfies BackendEvent);
        } else if (msg.subtype === 'commands_changed') {
          this.emit('message', {
            kind: 'system',
            subtype: 'commands_changed',
            commands: (msg as { commands?: SlashCommand[] }).commands ?? [],
          } satisfies BackendEvent);
        } else if (msg.subtype === 'session_state_changed') {
          const state = (msg as { state?: string }).state;
          if (state === 'running' || state === 'requires_action' || state === 'idle') {
            this.emit('message', { kind: 'system', subtype: 'session_state_changed', state } satisfies BackendEvent);
          }
        }
        break;
      }
      case 'assistant': {
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              this.emit('message', { kind: 'text', text: block.text } satisfies BackendEvent);
            } else if (block.type === 'thinking' && (block as { thinking?: string }).thinking) {
              this.emit('message', { kind: 'thinking', text: (block as { thinking: string }).thinking } satisfies BackendEvent);
            } else if (block.type === 'tool_use') {
              const input = JSON.stringify((block as { input?: unknown }).input ?? {});
              this.emit('message', {
                kind: 'tool_use',
                toolName: (block as { name: string }).name,
                input: input.length > TRUNCATE_INPUT ? input.slice(0, TRUNCATE_INPUT) + '…' : input,
              } satisfies BackendEvent);
            }
          }
        }
        break;
      }
      case 'user': {
        // Tool results echoed back into the transcript.
        const content = (msg as { message?: { content?: unknown } }).message?.content;
        if (Array.isArray(content)) {
          for (const block of content as { type?: string; content?: unknown; is_error?: boolean }[]) {
            if (block?.type === 'tool_result') {
              const raw = typeof block.content === 'string'
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.filter((c: { type?: string }) => c?.type === 'text').map((c: { text?: string }) => c.text ?? '').join('\n')
                  : '';
              const text = raw.length > TRUNCATE_INPUT ? raw.slice(0, TRUNCATE_INPUT) + '…' : raw;
              if (text) {
                this.emit('message', { kind: 'tool_result', text, meta: { isError: !!block.is_error } } satisfies BackendEvent);
              }
            }
          }
        }
        break;
      }
      case 'result': {
        /**
         * Resume başarısızlığı buraya düşer: init hiç gelmemişse oturum
         * kurulamamış demektir. Bu bir TUR SONUCU DEĞİL — kullanım sayılmaz,
         * olay yayılmaz. Gerçek toparlanma loop()'un finally'sinde ('exit'
         * olayıyla) yapılır.
         */
        if (!this.sawInit && this.resumeAttempt) {
          this.resumeFailed = true;
          break;
        }
        const usage = msg.usage as
          | { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
          | undefined;
        const isError = msg.subtype !== 'success';
        const resultText = (msg as { result?: string }).result ?? (isError ? `Hata: ${msg.subtype}` : '');
        this.emit('message', {
          kind: 'result',
          text: resultText,
          isError,
          usage: {
            inputTokens: usage?.input_tokens ?? 0,
            outputTokens: usage?.output_tokens ?? 0,
            cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
            cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
          },
          costUSD: (msg as { total_cost_usd?: number }).total_cost_usd ?? 0,
        } satisfies BackendEvent);
        break;
      }
      default:
        break;
    }
  }
}
