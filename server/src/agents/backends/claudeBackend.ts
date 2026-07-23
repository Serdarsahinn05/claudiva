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
import type { AgentConfig, SlashCommand } from '../../types.js';
import { agentDir, agentMemoryDir, SHARED_MEMORY_DIR } from '../../paths.js';
import type { AgentBackend, BackendCapabilities, BackendEvent, BackendStartOptions } from '../backend.js';

const MODEL_ALIASES: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-4-8',
};

const TRUNCATE_INPUT = 2000;

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

  private resolveModel(): string {
    return MODEL_ALIASES[this.config.model] ?? this.config.model;
  }

  start(opts: BackendStartOptions): void {
    if (this.q) return;
    this.opts = opts;
    this.config = opts.config;
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

  send(text: string): void {
    // Otomatik model seçimi: sistem prompt'unun dibindeki talimat (özellikle
    // haiku'da) gözden kaçıyor; her mesajın başına kısa bir hatırlatma koy.
    // Transcript'e orijinal metin AgentSession tarafından yazılır, bu
    // hatırlatma yalnız modele gider — mcp__self__set_model'e referans verdiği
    // için Claude'a özel, bu yüzden AgentSession'da değil burada.
    const wrapped =
      this.config.autoModel !== false
        ? `[Hatırlatma: yanıtlamadan önce görevin zorluğunu değerlendir; mevcut model (${this.resolveModel()}) uygun değilse önce mcp__self__set_model ile değiştir: basit→haiku, orta→sonnet, zor→opus.]\n\n${text}`
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
    await this.q?.setModel(MODEL_ALIASES[model] ?? model);
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
      ? `\n\n# Hafıza\nKalıcı hafıza klasörlerin: ${memoryDirs.join(' , ')}\n` +
        `Bir göreve başlamadan önce ilgili hafıza dosyalarını oku. Görev sırasında öğrendiğin ` +
        `kalıcı değerde bilgileri (kararlar, tercihler, proje bilgisi) bu klasörlere markdown ` +
        `dosyası olarak yaz; dosya başına tek konu, [[wikilink]] ile ilişkilendir. ` +
        `Zaten kayıtlı bilgiyi tekrar yazma, güncelle.`
      : '';

    const autoModelInstructions =
      config.autoModel !== false
        ? `\n\n# Otomatik model seçimi\n` +
          `Temel modelin: ${config.model}. Her yeni görev/mesaja başlarken önce işin zorluğunu ` +
          `değerlendir; mevcut model uygun değilse İLK İŞ olarak mcp__self__set_model aracını çağır, ` +
          `sonra göreve devam et:\n` +
          `- haiku → basit işler: kısa cevap, özet, listeleme, tek dosya okuma, basit arama\n` +
          `- sonnet → orta işler: kod yazma/düzenleme, çok adımlı görevler, araştırma + sentez\n` +
          `- opus → zor işler: mimari kararlar, karmaşık hata ayıklama, geniş refactor, kritik kod\n` +
          `Model zaten uygunsa aracı çağırma. Yükseltme görev-bazlıdır: tur bitince otomatik ` +
          `olarak temel modele dönülür, her yeni görevde yeniden değerlendirirsin.`
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
        mcpServers[name] = { type: def.type, url: def.url } as McpServerConfig;
      }
    }
    // İşlem-içi sunucular (team/self/task delegasyon araçları) — AgentSession
    // içeriğini incelemeden opak taşıyor, burada SDK'nın gerçek tipine dönüyoruz.
    Object.assign(mcpServers, opts.extraMcpServers as Record<string, McpServerConfig>);

    return {
      model: this.resolveModel(),
      cwd: opts.workspace,
      abortController: this.abort ?? undefined,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append:
          `# Kimlik\nSen "${config.name}" adlı bir ajansın. Rolün: ${config.role}.\n\n` +
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
      else this.emit('message', { kind: 'error', text: `Oturum hatası: ${(err as Error).message}` } satisfies BackendEvent);
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
