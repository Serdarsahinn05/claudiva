export type AgentRole = 'boss' | 'manager' | 'team-leader' | 'worker';

export type AgentStatus = 'offline' | 'idle' | 'working' | 'waiting';

export type MemoryMode = 'shared' | 'private' | 'both' | 'none';

/** Bir ajan hafızası (memory/<ajanId|shared>/*.md). Kenarlar `links`'ten türetilir. */
export interface MemoryNode {
  /** `${agentId}/${slug}` — tekil. */
  id: string;
  /** Sahibi: bir ajan id'si ya da 'shared'. */
  agentId: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  content: string;
  /** Gövdedeki `[[hedef]]` bağlantıları (slug/ad). */
  links: string[];
}

/** Short aliases mapped to real model IDs in session.ts; full IDs pass through. */
export type ModelChoice = 'haiku' | 'sonnet' | 'opus' | string;

/** Düşünme eforu. Tanımsız = DEFAULT_EFFORT ('medium'); kullanıcının
 *  ~/.claude ayarındaki effortLevel ajanlara sızmasın diye her oturumda verilir. */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh';
export const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh'];
export const DEFAULT_EFFORT: EffortLevel = 'medium';

/**
 * Ajanın arkasında hangi CLI/SDK'nın konuştuğu. Şimdilik tek üye — soyutlama
 * katmanı (bkz. agents/backend.ts) kuruldu ama ikinci bir sağlayıcı henüz
 * uygulanmadı. Genişledikçe yalnızca burası ve agents/backends/index.ts
 * değişir, AgentSession'a dokunulmaz.
 */
export type ProviderId = 'claude';

export interface McpServerDef {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  /** Uzak (http/sse) sunucuda kimlik başlıkları (ör. Authorization). aitmpl'deki
   *  uzak MCP'lerin 11'i bunu kullanıyor; taşınmazsa sunucu yetki alamaz. */
  headers?: Record<string, string>;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  model: ModelChoice;
  /** Düşünme eforu; tanımsız = 'medium'. Oturum sürerken canlı değişir. */
  effort?: EffortLevel;
  /** Tanımsızsa 'claude' sayılır (bkz. AgentManager.readConfigs/create). */
  provider?: ProviderId;
  memoryMode: MemoryMode;
  /**
   * Ajanın bağlı olduğu takım (ör. "PRODUCT", "MARKETING"). Serbest metin:
   * takım listesi ayrı bir kayıt defterinde değil, ajanlardan TÜRETİLİR —
   * takım ekleme/silme diye bir işlem yok, bir ajana yeni bir ad yazmak
   * takımı var eder, son ajanı da taşımak yok eder. Tanımsız/boş olan ajanlar
   * panelde `DEFAULT_TEAM` altında toplanır.
   */
  team?: string;
  /** When true, tool permission requests are auto-approved. */
  autoApprove: boolean;
  /** Extra description shown on the dashboard card. */
  description?: string;
  /** Göreve göre otomatik model seçimi (set_model aracı). Varsayılan: açık. */
  autoModel?: boolean;
  mcpServers?: Record<string, McpServerDef>;
  /** Paneldeki sıra. Küçük olan üstte; tanımsızsa listenin sonuna düşer. */
  order?: number;
  /** Bu ajanın günlük harcama tavanı (USD). 0/tanımsız = yalnızca genel sınır geçerli. */
  dailyLimitUSD?: number;
  /**
   * Paket ajanlarının dile göre adı/açıklaması (`agents/<id>/config.json`).
   * `tr` paketin kendi değeri; panel `name`/`description` hâlâ `tr` değerine
   * EŞİTSE (kullanıcı değiştirmediyse) arayüz dilindeki değeri gösterir. Disk
   * hep `tr` değerini taşır. Kullanıcının oluşturduğu ajanda yoktur.
   */
  i18n?: Record<string, { name?: string; description?: string }>;
  /** aitmpl şablonundan oluşturulduysa kaynak kimliği ("agents/<kat>/<ad>"),
   *  ileride "şablon güncellendi" kontrolü için. */
  template?: string;
  createdAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUSD: number;
  requests: number;
}

export function zeroUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUSD: 0, requests: 0 };
}

export function addUsage(a: TokenUsage, b: Partial<TokenUsage>): void {
  a.inputTokens += b.inputTokens ?? 0;
  a.outputTokens += b.outputTokens ?? 0;
  a.cacheReadTokens += b.cacheReadTokens ?? 0;
  a.cacheCreationTokens += b.cacheCreationTokens ?? 0;
  a.costUSD += b.costUSD ?? 0;
  a.requests += b.requests ?? 0;
}

export type TranscriptKind =
  | 'user'
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error'
  | 'system'
  /** Panelin kendi ürettiği çıktı (ör. /usage). Modele hiç gitmez, yalnızca
   *  dökümde görünür; ajan değişince veya sayfa yenilenince kaybolmasın diye
   *  diğer olaylarla aynı yerde saklanır. */
  | 'local';

export interface TranscriptEvent {
  id: string;
  ts: number;
  kind: TranscriptKind;
  text?: string;
  toolName?: string;
  /** JSON-stringified tool input (truncated). */
  input?: string;
  meta?: Record<string, unknown>;
}

export interface PermissionRequestInfo {
  id: string;
  agentId: string;
  toolName: string;
  input: Record<string, unknown>;
  title?: string;
  description?: string;
  ts: number;
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Task {
  id: string;
  title: string;
  prompt: string;
  assignedTo: string; // agent id
  assignedBy: string; // 'user' | agent id
  status: TaskStatus;
  result?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;

  // --- zincir alanları (tekil görevlerde tanımsız) ---
  /** Aynı zincirin adımlarını gruplar. */
  chainId?: string;
  /** Zincir içindeki sıra (0'dan başlar) — panel sıralaması için. */
  stepIndex?: number;
  /** Bu adım hangi görev bittikten sonra başlar. */
  dependsOn?: string;
  /** Önceki adımın sonucu prompt'un başına eklensin mi (varsayılan: evet). */
  passResult?: boolean;
  /** Bu görev hangi görevin içinde doğdu (delegasyon). Raporun kanıt ağacı
   *  bunu izler — bkz. TaskInput.parentTaskId. */
  parentTaskId?: string;
  /** Yönlendirici kararı (yönlendirilmediyse yok). */
  route?: TaskRoute;
}

/**
 * JEV yönlendiricisinin bu görev için verdiği model kararı (server/src/router).
 * Görev ajana gönderilmeden ÖNCE yazılır; panel bunu kartta ve harcama
 * panosunda (ölçülmüş tasarruf) gösterir.
 */
export interface TaskRoute {
  /** Görevin çalıştığı model (takma ad: haiku | sonnet | opus …). */
  model: string;
  tier?: 'small' | 'medium' | 'large';
  /** Kararı kim verdi: kural (0 token), sınıflandırıcı (haiku) ya da varsayılan. */
  by: 'rule' | 'classifier' | 'default';
  why: string;
  /**
   * Nasıl uygulandı. Önbellek modele özgü olduğu için (ölçüldü) SICAK bir
   * oturumda model yalnız yükseltilir, düşürülmez:
   *  opened    — oturum bu modelle açıldı
   *  switched  — soğuk oturumda model değişti (önbellek zaten yeniden yazılacaktı)
   *  escalated — sıcak oturumda daha güçlü modele çıkıldı
   *  kept      — sıcak oturum, model korundu (düşürmek önbelleği çöpe atardı)
   */
  applied: 'opened' | 'switched' | 'escalated' | 'kept';
  /** Sınıflandırıcı çağrısının maliyeti (yalnız by === 'classifier'). */
  classifierCostUSD?: number;
  /** Karar süresi (sınıflandırıcı gecikmesi dahil). */
  ms: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  template: string;
  tags?: string[];
}

/** Bir oturumda kullanılabilen slash komutu (skill, plugin komutu veya CLI yerleşiği). */
export interface SlashCommand {
  name: string;
  description: string;
  argumentHint?: string;
  aliases?: string[];
}

/** Snapshot of an agent for the panel. */
export interface AgentSnapshot {
  config: AgentConfig;
  status: AgentStatus;
  usage: TokenUsage;
  /** Yalnızca son turun payı — `usage` tümel toplam olduğu için ondan
   *  türetilemez (bkz. AgentSession.lastTurn). Hiç tur olmadıysa null. */
  lastTurn?: TokenUsage | null;
  currentActivity?: string;
  pendingPermissions: PermissionRequestInfo[];
  sessionId?: string;
  /** Son turdaki bağlam doluluğu (token) — panel yakıt göstergesi */
  contextTokens?: number;
  /** Oturumun şu an kullandığı model (otomatik geçişle temelden sapabilir) */
  currentModel?: string;
  /** Bu oturumda "/" ile çağrılabilen komutlar (panel otomatik tamamlaması) */
  commands?: SlashCommand[];
}
