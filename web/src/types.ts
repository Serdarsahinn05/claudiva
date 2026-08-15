export type AgentRole = 'boss' | 'manager' | 'team-leader' | 'worker';
export type AgentStatus = 'offline' | 'idle' | 'working' | 'waiting';
export type MemoryMode = 'shared' | 'private' | 'both' | 'none';

/** Bir ajan hafızası (memory/<ajanId|shared>/*.md). Kenarlar `links`'ten türetilir. */
export interface MemoryNode {
  id: string;
  agentId: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  content: string;
  links: string[];
}

export interface McpServerDef {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

/** Sunucudaki ProviderId'nin aynısı (server/src/types.ts) — proje kuralı gereği
 *  elle çoğaltılmış. Tek üye: soyutlama katmanı kuruldu, ikinci sağlayıcı yok. */
export type ProviderId = 'claude';

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  model: string;
  /** Tanımsızsa 'claude' sayılır. */
  provider?: ProviderId;
  memoryMode: MemoryMode;
  /** Takım adı (serbest metin). Takımlar ajanlardan türetilir — bkz. teams.ts. */
  team?: string;
  autoApprove: boolean;
  /** Göreve göre otomatik model seçimi (set_model aracı). Varsayılan: açık. */
  autoModel?: boolean;
  description?: string;
  mcpServers?: Record<string, McpServerDef>;
  /** Paneldeki sıra. Küçük olan üstte; tanımsızsa listenin sonuna düşer. */
  order?: number;
  /** Bu ajanın günlük harcama tavanı (USD). 0/tanımsız = yalnızca genel sınır. */
  dailyLimitUSD?: number;
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

export type TranscriptKind =
  | 'user'
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error'
  | 'system'
  /** Yalnızca panelde üretilir (ör. /usage çıktısı); sunucudan hiç gelmez. */
  | 'local';

export interface TranscriptEvent {
  id: string;
  ts: number;
  kind: TranscriptKind;
  text?: string;
  toolName?: string;
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
  assignedTo: string;
  assignedBy: string;
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
  /** Bu görev hangi görevin içinde doğdu (delegasyon zinciri). Raporun kanıt
   *  ağacı bunu izler; olmadan delege edilen işin kanıtı kayboluyordu. */
  parentTaskId?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  template: string;
  tags?: string[];
}

/** Terminalde "/" ile çağrılabilen komut (skill, plugin komutu veya CLI yerleşiği). */
export interface SlashCommand {
  name: string;
  description: string;
  argumentHint?: string;
  aliases?: string[];
}

export interface AgentSnapshot {
  config: AgentConfig;
  status: AgentStatus;
  usage: TokenUsage;
  /** Yalnızca son turun payı. `usage` tümel toplamdır (açılışta diskten geri
   *  yüklenir), ondan tur payı türetilemez — ayrıca taşınır. */
  lastTurn?: TokenUsage | null;
  currentActivity?: string;
  pendingPermissions: PermissionRequestInfo[];
  sessionId?: string;
  /** Son turdaki bağlam doluluğu (token) — ofis yakıt göstergesi */
  contextTokens?: number;
  /** Oturumun şu an kullandığı model (otomatik geçişle temelden sapabilir) */
  currentModel?: string;
  /** Terminalde "/" yazınca listelenecek komutlar */
  commands?: SlashCommand[];
}

/** Köprü ekranının gösterdiği sistem telemetrisi (GET /api/system). */
export interface SystemInfo {
  host: {
    platform: string;
    release: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    loadAvg: number;
    memTotal: number;
    memFree: number;
    uptimeSec: number;
    nodeVersion: string;
  };
  project: {
    dir: string;
    name: string;
    fileCount: number;
    sizeBytes: number;
    truncated: boolean;
    gitBranch: string | null;
  };
  claude: {
    sdkVersion: string;
    teamDir: string;
    installRoot: string;
  };
}

export interface UsageSummary {
  total: TokenUsage;
  perAgent: Record<string, TokenUsage>;
}

// ------------------------------------------------------------ oturum iç görüsü
/** Sunucudaki karşılıklarının aynısı (server/src/agents/backend.ts) — proje
 *  kuralı gereği elle çoğaltılmış. Yerleşik slash komutları bunları okur. */
export interface ContextUsageInfo {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  model: string;
  categories: { name: string; tokens: number }[];
  /** Bağlama yüklenmiş dosyalar, yol + token. "Hangi dosya kaç token" sorusunun
   *  TEK gerçek kaynağı — araç sonuçları token'a atfedilmiyor. */
  memoryFiles: { path: string; type: string; tokens: number }[];
  mcpTools: { name: string; serverName: string; tokens: number }[];
  systemTools: { name: string; tokens: number }[];
}

/** Bir turun zaman damgalı kaydı (GET /api/usage/history). */
export interface UsageTurn {
  ts: number;
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUSD: number;
  taskId?: string;
}

export interface UsageHistoryResponse {
  /** Kaydın başladığı an; öncesi tur tur bölünemez. */
  since: number;
  turns: UsageTurn[];
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

/** `null` = istendi ama okunamadı (oturum kapalı/desteklenmiyor);
 *  `undefined` = hiç istenmedi. Komutlar ikisini ayrı yazdırır. */
export interface SessionInspect {
  context?: ContextUsageInfo | null;
  models?: ModelOption[] | null;
  agents?: SubagentInfo[] | null;
  mcp?: McpStatusInfo[] | null;
  account?: AccountInfoLite | null;
}

// ------------------------------------------------------------------ bütçe
export interface BudgetSettings {
  /** Günlük toplam harcama tavanı (USD). 0/tanımsız = sınırsız. */
  dailyLimitUSD?: number;
  /** Bu yüzdede uyarı verilir. */
  warnAtPercent?: number;
}

export interface BudgetState {
  /** Pencerenin günü (YYYY-MM-DD); yerel gece yarısında döner. */
  date: string;
  spentUSD: number;
  limitUSD?: number;
  perAgentUSD: Record<string, number>;
  /** Sınır yoksa null. */
  pct: number | null;
  warn: boolean;
  exceeded: boolean;
  settings?: BudgetSettings;
}

// ----------------------------------------------------------- değişiklikler
export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

/** Bir dosyaya yapılan tek bir ajan dokunuşu. */
export interface Touch {
  agentId: string;
  taskId?: string;
  ts: number;
  tool: string;
}

export interface ChangedFile {
  /** Proje köküne göreli yol. */
  path: string;
  status: ChangeStatus;
  /** Yeniden eskiye; boşsa değişikliği ajan değil kullanıcı yapmış demektir. */
  touches: Touch[];
}

// ------------------------------------------------------------------- kod
export interface TreeEntry {
  path: string;
  name: string;
  kind: 'dir' | 'file';
  size?: number;
  /**
   * Sunucunun çözdüğü ikon adı; panel `/api/file-icon/<ad>.svg` ister.
   * Eşleme tablosu 450 KB olduğu için sunucuda kalıyor (bkz. fileIcons.ts).
   * Paket kurulu değilse tanımsız gelir ve ağaç ikonsuz çizilir.
   */
  icon?: string;
  iconOpen?: string;
}

export interface FileContent {
  path: string;
  size: number;
  text: string;
  /** İkili dosya — içerik gelmez. */
  binary: boolean;
  /** Boyut sınırını aştı — içerik gelmez. */
  tooLarge: boolean;
  lines: number;
  /** Bu dosyaya dokunan ajanlar (git listesinden düşmüş olsa da). */
  touches: Touch[];
}

// --------------------------------------------------------------- browser
/** Sunucudaki tarayıcının durumu (GET /api/browser/state). */
export interface BrowserState {
  running: boolean;
  url: string;
  title: string;
  /** Playwright ya da indirilmiş tarayıcı yoksa dolu gelir. */
  unavailable?: string;
  viewport: { width: number; height: number };
}

export type BrowserAction =
  | { action: 'click'; x: number; y: number }
  | { action: 'type'; text: string; submit?: boolean }
  | { action: 'scroll'; dy: number }
  | { action: 'back' }
  | { action: 'reload' };

// ---------------------------------------------------------------- skills
export type SkillScope = 'global' | 'project' | 'agent';

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  agentId?: string;
  dir: string;
  /** `SKILL.md` var mı (yoksa `.disabled` soneki taşıyor). */
  enabled: boolean;
  size: number;
  extras: string[];
}

/**
 * Skill katalogu — KURULABİLECEK olanlar (diskteki `SkillInfo`dan ayrı).
 * Sunucu karşılığı `server/src/skillCatalog.ts`; şema iki yerde elle
 * çoğaltılıyor (bkz. CLAUDE.md), birini değiştirirken diğerini de değiştir.
 */
export interface CatalogSource {
  repo: string;
  label: string;
  /** Yerleşik kaynaklar silinmez, gizlenir. */
  builtin: boolean;
  count?: number;
  error?: string;
}

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
  repo: string;
  skillPath: string;
  /** Kurulunca oluşacak dizin adı. */
  folder: string;
  /** Bu ad hangi kapsamlarda zaten kurulu (boş = kurulu değil). */
  installedScopes: SkillScope[];
}

export interface CatalogView {
  /** Son tarama zamanı; hiç taranmadıysa null. */
  fetchedAt: number | null;
  sources: CatalogSource[];
  skills: CatalogSkill[];
}

/** Toplu kurulumda satır başına sonuç — bir hata diğerlerini iptal etmez. */
export interface BulkResult {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
}

// -------------------------------------------------------------- raporlar
/**
 * Sonuçlanmış bir KÖK görev + kanıtı.
 *
 * `files` alt ağacın tamamından toplanır (delege edilen iş dosyayı alt görevde
 * yazar), `subtasks` ise işin kimlere bölündüğünü gösterir.
 */
export interface Report {
  task: Task;
  files: { path: string; ts: number; tool: string; agentId: string }[];
  subtasks: {
    id: string;
    title: string;
    assignedTo: string;
    status: TaskStatus;
    result?: string;
  }[];
}

export interface ChangesResponse {
  /** false ise geri alma yapılamaz; panel düğmeleri kapanır. */
  isRepo: boolean;
  head: string | null;
  files: ChangedFile[];
}

export type WsPayload =
  | { type: 'agent_status'; agentId: string; status: AgentStatus; activity?: string }
  | { type: 'agent_event'; agentId: string; event: TranscriptEvent }
  | { type: 'permission_request'; request: PermissionRequestInfo }
  | { type: 'permission_resolved'; agentId: string; requestId: string }
  | {
      type: 'usage';
      usage: UsageSummary;
      context?: Record<string, number>;
      /** Ajan başına son turun payı (bkz. AgentSnapshot.lastTurn). */
      turns?: Record<string, TokenUsage | null>;
      budget?: BudgetState;
    }
  | { type: 'agents_changed' }
  | { type: 'commands_changed'; agentId: string; commands: SlashCommand[] }
  | { type: 'task_update'; task: Task };
