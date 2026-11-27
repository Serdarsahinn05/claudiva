import type { EventEmitter } from 'node:events';
import type { AgentConfig, McpServerDef, SlashCommand } from '../types.js';

/**
 * Bir backend'in ne kadarını yapabildiği. Şu an tek backend (Claude) var ve
 * hepsi true — bu tip, ikinci bir backend eklendiğinde neyin gerçekten
 * kısıtlanacağını önceden belgeler. `AgentSession`/`AgentManager` bu bayrakları
 * ŞU AN dallanma için kullanmıyor (yalnızca `resume` istisna — bkz. session.ts):
 * her metot "en iyi çabayla, desteklenmiyorsa sessizce no-op" sözleşmesiyle
 * tanımlı, yani desteklemeyen bir backend otomatik olarak zararsız davranır.
 */
export interface BackendCapabilities {
  /** Sunucu yeniden başladıktan sonra oturumu geri yükleyebilir mi. */
  resume: boolean;
  /** Oturum sürerken canlı model değişimi destekler mi. */
  liveModelSwitch: boolean;
  /** Slash komut keşfi sunar mı. */
  slashCommands: boolean;
  /** İşlem-içi MCP sunucusu (team/self/task delegasyon araçları) enjekte edilebilir mi. */
  mcpTools: boolean;
  /** Gerçek $ maliyeti raporlar mı (yoksa yalnızca ham token sayısı). */
  costUSD: boolean;
  /** Oturum iç görüsü (bağlam dökümü, model listesi, MCP durumu…) sunar mı. */
  introspect: boolean;
}

// --------------------------------------------------------------- iç görü
/**
 * Yerleşik slash komutlarının (`/context`, `/model`, `/mcp`, `/agents`,
 * `/status`) beslendiği NORMALLEŞTİRİLMİŞ oturum iç görüsü.
 *
 * Şekil bilerek SDK'nınkinden küçük ve sağlayıcıdan bağımsız: panelin
 * gösterdiği alanların tamamı burada, SDK'ya özel her alan (renk kodları,
 * ızgara satırları, effort seviyeleri) backend'de bırakılır. Böylece ikinci
 * bir sağlayıcı eklendiğinde komut katmanı hiç değişmez.
 */
export interface ContextUsageInfo {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  model: string;
  /** Bağlamın nereye gittiği (sistem prompt'u, araçlar, mesajlar, MCP…). */
  categories: { name: string; tokens: number }[];
  /**
   * TEK GERÇEK "hangi dosya kaç token" kaynağı: bağlama yüklenmiş hafıza/kural
   * dosyaları, tek tek yol ve token'la. Araç sonuçları (bir Read'in kaç token
   * götürdüğü) hiçbir yerde token'a atfedilmiyor — o sayı UYDURULAMAZ, bu
   * yüzden panel yalnızca burayı "dosya" diye gösterir.
   */
  memoryFiles: { path: string; type: string; tokens: number }[];
  /** MCP araçlarının şema maliyeti (sunucu başına toplanabilir). */
  mcpTools: { name: string; serverName: string; tokens: number }[];
  /** Yerleşik araç şemalarının maliyeti. */
  systemTools: { name: string; tokens: number }[];
}

export interface ModelOption {
  value: string;
  displayName: string;
  description?: string;
}

export interface SubagentInfo {
  name: string;
  description: string;
  model?: string;
}

export interface McpStatusInfo {
  name: string;
  status: string;
  toolCount: number;
  error?: string;
  scope?: string;
}

export interface AccountInfoLite {
  email?: string;
  organization?: string;
  subscriptionType?: string;
  apiProvider?: string;
}

export type InspectPart = 'context' | 'models' | 'agents' | 'mcp' | 'account';

/**
 * İstenen parçalar. Bir parça DESTEKLENMİYORSA ya da okunamazsa `null` gelir —
 * `undefined` "istenmedi" demektir. Panel ikisini ayırabilmeli: birincide
 * "okunamadı" yazar, ikincide hiç göstermez.
 */
export interface SessionInspect {
  context?: ContextUsageInfo | null;
  models?: ModelOption[] | null;
  agents?: SubagentInfo[] | null;
  mcp?: McpStatusInfo[] | null;
  account?: AccountInfoLite | null;
}

export interface BackendUsage {
  inputTokens: number;
  outputTokens: number;
  /** Yalnızca önbellekleme kavramı olan backend'lerde (Claude) dolu gelir. */
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/**
 * Backend'in `AgentSession`'a bildirdiği normalleştirilmiş olay.
 *
 * `kind` değerleri KASITLI olarak `TranscriptKind` ile aynı: `AgentSession`
 * bunu doğrudan `pushEvent()`'e verir, ayrı bir çeviri katmanı gerekmez.
 * `system` alt türleri bugün SDK'nın tek bir mesaj tipinde çoğullanan üç ayrı
 * genel defter-tutma olayını (oturum kuruldu / komut listesi değişti / durum
 * geçişi) aynı şekilde tek olayda taşır.
 */
export type BackendEvent =
  | { kind: 'text' | 'thinking' | 'tool_result' | 'error'; text: string; meta?: Record<string, unknown> }
  | { kind: 'tool_use'; toolName: string; input: string }
  | {
      kind: 'system';
      subtype: 'init' | 'commands_changed' | 'session_state_changed';
      text?: string;
      sessionId?: string;
      state?: 'running' | 'requires_action' | 'idle';
      commands?: SlashCommand[];
    }
  | { kind: 'result'; text: string; isError: boolean; usage?: BackendUsage; costUSD?: number };

export interface BackendStartOptions {
  /** Aynı referans — AgentManager'ın canlı mutasyonları (update()) otomatik yansır. */
  config: AgentConfig;
  personality: string;
  workspace: string;
  /** Yalnızca capabilities.resume true ise anlamlıdır. */
  resumeId?: string;
  /** capabilities.mcpTools false ise backend bunu yok sayar. */
  mcpServers: Record<string, McpServerDef>;
  /** İşlem-içi MCP sunucuları (team/self/task delegasyon araçları). Şekli
   *  backend'e özeldir (Claude için SDK'nın McpServerConfig'i) — bu arayüz
   *  içeriğini incelemez, opak taşır. capabilities.mcpTools false ise yok sayılır. */
  extraMcpServers: Record<string, unknown>;
  extraAllowedTools: string[];
  canUseTool: (
    toolName: string,
    input: Record<string, unknown>,
    opts: { title?: string; description?: string; signal: AbortSignal },
  ) => Promise<{ behavior: 'allow' | 'deny'; updatedInput?: Record<string, unknown>; message?: string }>;
  /**
   * Oturumun AÇILIŞ modeli. Verilmezse `config.model` (temel model).
   * Yönlendirici kapalı bir oturumu ucuz modelle açabilsin diye var.
   */
  model?: string;
}

export interface BackendSendOptions {
  /**
   * Otomatik model seçimi hatırlatması eklensin mi (varsayılan: evet).
   * Yönlendirilmiş görevde hayır: modeli yönlendirici zaten seçti.
   */
  reminder?: boolean;
}

/**
 * Bir ajanın "arkasında" konuşan CLI/SDK'nın soyutlaması. `AgentSession`
 * bunun ötesinde hiçbir sağlayıcıya özel şey bilmez — döküm, bütçe, görev
 * korelasyonu, izin bekletme gibi tüm genel defter tutma `AgentSession`'da
 * kalır; yalnızca "modele nasıl konuşulur" burada değişir.
 */
export interface AgentBackend extends EventEmitter {
  readonly capabilities: BackendCapabilities;
  start(opts: BackendStartOptions): void;
  send(text: string, opts?: BackendSendOptions): void;
  interrupt(): Promise<void>;
  stop(): Promise<void>;
  /** Oturum akışta değilse ya da desteklenmiyorsa reddedebilir — çağıran
   *  (AgentSession) bunu yakalayıp kendi ilkesine göre yutar ya da geri sarar. */
  setModel(model: string): Promise<void>;
  /** Düşünme eforunu canlı değiştirir; oturum kapalıysa sessizce çözülür. */
  setEffort(effort: string): Promise<void>;
  /** Desteklenmiyorsa/oturum kapalıysa boş dizi döner; gerçek bir hata olursa reddeder. */
  refreshCommands(): Promise<SlashCommand[]>;
  /**
   * Yerleşik komutların okuduğu oturum iç görüsü. Parça başına EN İYİ ÇABA:
   * biri okunamazsa `null` konur, diğerleri yine döner — tek bir kırık kontrol
   * isteği `/status` gibi çok parçalı bir komutu tümüyle boş bırakmasın diye.
   * Hiç desteklenmiyorsa (capabilities.introspect false) her parça `null`.
   */
  inspect(parts: InspectPart[]): Promise<SessionInspect>;
  /** Yalnızca Claude'da anlamlı deneysel plan-kotası verisi; diğerleri null döner. */
  planUsage(): Promise<unknown | null>;

  on(event: 'message', listener: (e: BackendEvent) => void): this;
  /** Oturum bir daha kendiliğinden dönmeyecek şekilde kapandı.
   *  `resumeFailed` true ise AgentSession kayıtlı id'yi silip yeniden dener. */
  on(event: 'exit', listener: (info: { resumeFailed: boolean; error?: Error }) => void): this;
}
