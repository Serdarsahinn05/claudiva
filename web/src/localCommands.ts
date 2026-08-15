import { api } from './api';
import type {
  AgentSnapshot,
  BudgetState,
  SlashCommand,
  Task,
  TranscriptEvent,
  UsageSummary,
} from './types';

/**
 * YERLEŞİK SLASH KOMUTLARI — panelde çalışan katman.
 *
 * Sınır tek bir soruyla çiziliyor: **komut CLI'da etkileşimli bir ekran mı
 * açıyor, yoksa modele bir prompt mu genişliyor?**
 *
 *  - Etkileşimli ekran açanlar (`/model`, `/context`, `/mcp`, `/agents`,
 *    `/status`, `/config`, `/usage`, `/doctor`, `/export`, `/resume`,
 *    `/memory`, `/todos`) BURADA çalışır. Bunları SDK'ya göndermenin bir
 *    anlamı yok: CLI'ın çizeceği menü/diyalog panelde bir yüzeye sahip değil,
 *    ajan da "bende böyle bir arayüz yok" der. Veri zaten sunucuda —
 *    `/api/agents/:id/inspect` oturumun kendi kontrol isteklerini normalleştirir.
 *  - Prompt'a genişleyen HER ŞEY (`/compact`, `/init`, `/review`, `/pr-comments`,
 *    skill'ler, kullanıcının kendi komutları…) olduğu gibi SDK'ya gider.
 *    Panel hiçbir komutu reddetmez.
 *
 * Taşınabilirlik: burada projeye özel hiçbir şey yok. Komut seti oturumun
 * kendisinden (SDK) ve panelin kendi defterinden okunuyor, dolayısıyla
 * claudiva hangi projeye kurulursa kurulsun aynı set geliyor.
 */
export interface LocalCommand {
  name: string;
  aliases?: string[];
  description: string;
  /** "/" menüsünde adın yanında görünen argüman ipucu. */
  argumentHint?: string;
  /** Çıktı metni döndürür; null dönerse terminale bir şey yazılmaz. */
  run: (ctx: LocalContext) => Promise<string | null>;
}

export interface LocalContext {
  agent: AgentSnapshot;
  args: string;
  /** Panelin genel durumu — komutlar veriyi buradan okur, kendileri istek atmaz
   *  (istisna: oturum iç görüsü ve hafıza, ikisi de anlık okunmak zorunda). */
  agents: AgentSnapshot[];
  tasks: Task[];
  usage: UsageSummary | null;
  budget: BudgetState | null;
  projectDir: string;
  connected: boolean;
  /** Bu ajanın terminal dökümü (/export bunu yazar). */
  events: TranscriptEvent[];
  /** Terminaldeki dökümü temizler (sunucudaki kayıt da silinir). */
  clearTranscript: () => Promise<void>;
  /** Ajan listesini sunucudan tazeler (ör. /model değişikliğinden sonra). */
  refreshAgents: () => Promise<void>;
}

// ---------------------------------------------------------------- biçimleme

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUSD(n: number): string {
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
}

/** "2026-07-18T12:20:00Z" -> "18 Tem 12:20" */
function fmtReset(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Yüzdeyi çubuğa çevirir. Genişlik 16: döşeli terminalde bir göz 400px
 * olabiliyor ve 20 karakterlik çubuk etiketiyle birlikte satırı sardırıyordu.
 */
function bar(pct: number, width = 16): string {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function section(title: string, lines: string[]): string[] {
  return lines.length ? ['', title, ...lines] : [];
}

/** "anahtar    değer" — anahtarlar hizalı. */
function kv(rows: [string, string][], pad = 16): string[] {
  return rows.map(([k, v]) => `  ${k.padEnd(pad)} ${v}`);
}

const STATUS_TR: Record<string, string> = {
  offline: 'kapalı',
  idle: 'boşta',
  working: 'çalışıyor',
  waiting: 'onay bekliyor',
};

/**
 * "İstendi ama okunamadı" (null) ile "hiç istenmedi" (undefined) ayrımını
 * kullanıcıya çevirir. Oturum kapalıyken her parça null gelir; sebebi
 * neredeyse her zaman budur, o yüzden ajan durumu da söylenir.
 */
function unreadable(agent: AgentSnapshot): string {
  return agent.status === 'offline'
    ? '  (ajan kapalı — bu veri açık oturumdan okunur)'
    : '  (okunamadı — oturum şu an kontrol isteği kabul etmiyor)';
}

// ------------------------------------------------------------------ komutlar

async function usageOutput(ctx: LocalContext): Promise<string> {
  const { tracked, plan } = await api.usageDetail();
  const lines: string[] = [];

  const t = tracked.total;
  lines.push('Bu projedeki kullanım (claudiva sayımı)');
  lines.push(
    `  ${fmtTokens(t.inputTokens + t.outputTokens)} token · ${fmtUSD(t.costUSD)} · ${t.requests} istek`,
  );

  const rows = Object.entries(tracked.perAgent).filter(([, u]) => u.requests > 0);
  if (rows.length) {
    lines.push('');
    for (const [id, u] of rows.sort((a, b) => b[1].costUSD - a[1].costUSD)) {
      const name = id === ctx.agent.config.id ? `${id} (bu ajan)` : id;
      lines.push(
        `  ${name.padEnd(24)} ${fmtTokens(u.inputTokens + u.outputTokens).padStart(7)} · ${fmtUSD(u.costUSD)}`,
      );
    }
  }

  const turn = ctx.agent.lastTurn;
  if (turn) {
    lines.push(...section('Bu ajanın son turu', kv([
      ['girdi', `${fmtTokens(turn.inputTokens)} tok`],
      ['çıktı', `${fmtTokens(turn.outputTokens)} tok`],
      ['önbellek', `${fmtTokens(turn.cacheReadTokens)} okundu · ${fmtTokens(turn.cacheCreationTokens)} yazıldı`],
      ['maliyet', fmtUSD(turn.costUSD)],
    ])));
  }

  const b = ctx.budget;
  if (b) {
    lines.push('', 'Panel bütçesi (bugün)');
    if (b.limitUSD && b.pct !== null) {
      lines.push(`  ${bar(b.pct)} %${Math.round(b.pct)}  ${fmtUSD(b.spentUSD)} / ${fmtUSD(b.limitUSD)}`);
    } else {
      lines.push(`  ${fmtUSD(b.spentUSD)} harcandı · sınır yok (Ayarlar'dan koyabilirsin)`);
    }
  }

  const p = plan as PlanUsage | null;
  const windows = p?.rate_limits ? Object.entries(p.rate_limits) : [];
  const usable = windows.filter(
    (e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number',
  );

  lines.push('');
  if (p?.rate_limits_available && usable.length) {
    lines.push('Hesap plan kotası');
    for (const [key, win] of usable) {
      const label = WINDOW_LABEL[key] ?? key;
      const reset = fmtReset(win.resets_at);
      lines.push(
        `  ${label.padEnd(18)} ${bar(win.utilization!)} %${String(win.utilization).padStart(3)}${reset ? `  ↻ ${reset}` : ''}`,
      );
    }
  } else {
    lines.push('Hesap plan kotası okunamadı.');
    lines.push('  En az bir ajanın çalışıyor olması gerekiyor (kota açık oturumdan okunur).');
  }

  return lines.join('\n');
}

interface RateWindow {
  utilization?: number;
  resets_at?: string;
}

interface PlanUsage {
  rate_limits_available?: boolean;
  rate_limits?: Record<string, RateWindow | null>;
}

/** Plan penceresi anahtarlarının okunabilir adları. */
const WINDOW_LABEL: Record<string, string> = {
  five_hour: '5 saatlik',
  seven_day: '7 günlük',
  seven_day_opus: '7 günlük (Opus)',
  seven_day_sonnet: '7 günlük (Sonnet)',
};

async function contextOutput(ctx: LocalContext): Promise<string> {
  const { context } = await api.inspect(ctx.agent.config.id, ['context']);
  if (!context) return ['Bağlam dökümü alınamadı.', unreadable(ctx.agent)].join('\n');

  const lines = [
    `Bağlam penceresi · ${context.model}`,
    `  ${bar(context.percentage)} %${Math.round(context.percentage)}` +
      `  ${fmtTokens(context.totalTokens)} / ${fmtTokens(context.maxTokens)} tok`,
    '',
    'Nereye gidiyor',
  ];

  const cats = context.categories.filter((c) => c.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  const width = Math.max(...cats.map((c) => c.name.length), 8);
  for (const c of cats) {
    /**
     * Payda `maxTokens`, `totalTokens` DEĞİL. Kategoriler pencerenin TAMAMINI
     * böler — "Free space" ve "Autocompact buffer" da bir kategori, ama ikisi
     * de `totalTokens`in (kullanılan kısım) içinde değil. Kullanılana bölmek
     * ölçülmüş bir saçmalık üretiyordu: 889.6k boş alan "%2023" çıkıyordu.
     */
    const pct = context.maxTokens ? (c.tokens / context.maxTokens) * 100 : 0;
    lines.push(`  ${c.name.padEnd(width)} ${fmtTokens(c.tokens).padStart(7)}  %${Math.round(pct)}`);
  }
  if (!cats.length) lines.push('  (bağlam boş — henüz tur yapılmamış)');

  lines.push('', 'Bağlamı küçültmek için: /compact  (ajanın kendi özetlemesi)');
  return lines.join('\n');
}

async function modelOutput(ctx: LocalContext): Promise<string> {
  const wanted = ctx.args.trim();
  const current = ctx.agent.currentModel ?? ctx.agent.config.model;

  if (wanted) {
    await api.updateAgent(ctx.agent.config.id, { model: wanted });
    await ctx.refreshAgents();
    return [
      `Temel model değişti: ${current} → ${wanted}`,
      '  Oturum açıksa anında uygulanır, değilse bir sonraki başlatmada.',
      ctx.agent.config.autoModel === false
        ? ''
        : '  Not: otomatik model seçimi açık — ajan zor işlerde geçici olarak yükseltebilir.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const { models } = await api.inspect(ctx.agent.config.id, ['models']);
  const lines = [
    'Model',
    ...kv([
      ['temel', ctx.agent.config.model],
      ['şu an', current],
      ['oto seçim', ctx.agent.config.autoModel === false ? 'kapalı' : 'açık'],
    ]),
  ];

  if (models === null) {
    lines.push('', 'Seçilebilir modeller okunamadı.', unreadable(ctx.agent));
  } else if (models?.length) {
    lines.push('', 'Seçilebilir modeller');
    const width = Math.max(...models.map((m) => m.value.length));
    for (const m of models) {
      const mark = m.value === current ? '›' : ' ';
      lines.push(`  ${mark} ${m.value.padEnd(width)}  ${m.displayName}`);
    }
  }

  lines.push('', 'Değiştirmek için: /model <ad>   (ör. /model sonnet)');
  return lines.join('\n');
}

async function statusOutput(ctx: LocalContext): Promise<string> {
  const a = ctx.agent;
  const { context, account } = await api.inspect(a.config.id, ['context', 'account']);
  const u = a.usage;

  const lines = [
    `${a.config.name} · ${STATUS_TR[a.status] ?? a.status}`,
    ...kv([
      ['rol', a.config.role],
      ['takım', a.config.team ?? '(yok)'],
      ['model', `${a.currentModel ?? a.config.model}${a.currentModel && a.currentModel !== a.config.model ? ` (temel: ${a.config.model})` : ''}`],
      ['oturum', a.sessionId ? a.sessionId.slice(0, 8) : '(yok)'],
      ['oto onay', a.config.autoApprove ? 'açık' : 'kapalı'],
      ['hafıza', a.config.memoryMode],
      ['komut', `${a.commands?.length ?? 0} tane`],
    ]),
  ];

  lines.push(...section('Kullanım (tüm zamanlar)', kv([
    ['token', `${fmtTokens(u.inputTokens + u.outputTokens)} (${u.requests} istek)`],
    ['maliyet', fmtUSD(u.costUSD)],
    ['son tur', a.lastTurn ? `${fmtTokens(a.lastTurn.inputTokens + a.lastTurn.outputTokens)} tok · ${fmtUSD(a.lastTurn.costUSD)}` : '(henüz yok)'],
  ])));

  if (context) {
    lines.push(...section('Bağlam', [
      `  ${bar(context.percentage)} %${Math.round(context.percentage)}  ${fmtTokens(context.totalTokens)} / ${fmtTokens(context.maxTokens)}`,
    ]));
  }

  if (ctx.budget) {
    const b = ctx.budget;
    const own = b.perAgentUSD[a.config.id] ?? 0;
    lines.push(...section('Bütçe (bugün)', kv([
      ['bu ajan', fmtUSD(own)],
      ['panel', b.limitUSD ? `${fmtUSD(b.spentUSD)} / ${fmtUSD(b.limitUSD)} (%${Math.round(b.pct ?? 0)})` : `${fmtUSD(b.spentUSD)} · sınırsız`],
    ])));
  }

  if (account) {
    lines.push(...section('Hesap', kv([
      ['e-posta', account.email ?? '—'],
      ['plan', account.subscriptionType ?? '—'],
      ['sağlayıcı', account.apiProvider ?? '—'],
    ])));
  }

  lines.push(...section('Ortam', kv([
    ['proje', ctx.projectDir || '—'],
    ['panel', ctx.connected ? 'bağlı' : 'BAĞLANTI YOK'],
    ['ekip', `${ctx.agents.length} ajan · ${ctx.agents.filter((x) => x.status !== 'offline').length} açık`],
  ])));

  return lines.join('\n');
}

async function agentsOutput(ctx: LocalContext): Promise<string> {
  const { agents } = await api.inspect(ctx.agent.config.id, ['agents']);
  const lines = ['Paneldeki ajanlar'];
  const width = Math.max(...ctx.agents.map((a) => a.config.id.length), 8);
  for (const a of ctx.agents) {
    const mark = a.config.id === ctx.agent.config.id ? '›' : ' ';
    lines.push(
      `  ${mark} ${a.config.id.padEnd(width)}  ${(STATUS_TR[a.status] ?? a.status).padEnd(12)} ${a.config.role}${a.config.team ? ` · ${a.config.team}` : ''}`,
    );
  }

  if (agents === null) {
    lines.push('', 'Oturum alt ajanları okunamadı.', unreadable(ctx.agent));
  } else if (agents?.length) {
    lines.push('', `Bu oturumun alt ajanları (Task aracıyla çağrılır) — ${agents.length} tane`);
    const w = Math.max(...agents.map((a) => a.name.length));
    for (const a of agents) {
      const desc = a.description.length > 60 ? `${a.description.slice(0, 60)}…` : a.description;
      lines.push(`  ${a.name.padEnd(w)}  ${desc}`);
    }
  }
  return lines.join('\n');
}

async function mcpOutput(ctx: LocalContext): Promise<string> {
  const { mcp } = await api.inspect(ctx.agent.config.id, ['mcp']);
  if (mcp === null) return ['MCP sunucu durumu okunamadı.', unreadable(ctx.agent)].join('\n');
  if (!mcp?.length) return 'Bu oturumda MCP sunucusu yok.';

  const width = Math.max(...mcp.map((s) => s.name.length));
  const lines = [`MCP sunucuları — ${mcp.length} tane`];
  for (const s of mcp) {
    const mark = s.status === 'connected' ? '●' : s.status === 'failed' ? '✗' : '○';
    lines.push(
      `  ${mark} ${s.name.padEnd(width)}  ${s.status.padEnd(10)} ${s.toolCount} araç${s.scope ? ` · ${s.scope}` : ''}`,
    );
    if (s.error) lines.push(`      ${s.error}`);
  }
  return lines.join('\n');
}

async function doctorOutput(ctx: LocalContext): Promise<string> {
  const a = ctx.agent;
  const [{ mcp, context }, system] = await Promise.all([
    api.inspect(a.config.id, ['mcp', 'context']),
    api.system().catch(() => null),
  ]);

  /** ok / uyarı / hata — üçü de tek sütunda hizalı. */
  const rows: [string, string, string][] = [];
  const check = (label: string, ok: boolean | null, detail: string) =>
    rows.push([ok === null ? '?' : ok ? '✓' : '✗', label, detail]);

  check('panel ↔ sunucu', ctx.connected, ctx.connected ? 'bağlı' : 'websocket kapalı — sayfayı yenile');
  check('oturum', a.status !== 'offline', a.status === 'offline' ? 'ajan kapalı' : `${STATUS_TR[a.status]} · ${a.sessionId ? a.sessionId.slice(0, 8) : 'id yok'}`);
  check('komut listesi', (a.commands?.length ?? 0) > 0, `${a.commands?.length ?? 0} komut`);

  if (mcp == null) check('MCP', null, 'okunamadı (oturum kapalı olabilir)');
  else {
    const bad = mcp.filter((s) => s.status === 'failed' || s.status === 'needs-auth');
    check('MCP', bad.length === 0, bad.length ? bad.map((s) => `${s.name}: ${s.status}`).join(', ') : `${mcp.length} sunucu bağlı`);
  }

  if (context == null) check('bağlam', null, 'okunamadı');
  else check('bağlam', context.percentage < 80, `%${Math.round(context.percentage)} dolu${context.percentage >= 80 ? ' — /compact öner' : ''}`);

  const b = ctx.budget;
  if (!b?.limitUSD) check('bütçe', null, 'günlük sınır tanımlı değil (Ayarlar)');
  else check('bütçe', !b.warn, `${fmtUSD(b.spentUSD)} / ${fmtUSD(b.limitUSD)} (%${Math.round(b.pct ?? 0)})`);

  check('proje dizini', !!ctx.projectDir, ctx.projectDir || 'okunamadı');
  if (system) {
    check('git', !!system.project.gitBranch, system.project.gitBranch ?? 'depo değil — değişiklik geri alınamaz');
    check('SDK', true, `agent-sdk ${system.claude.sdkVersion} · node ${system.host.nodeVersion}`);
  }

  const width = Math.max(...rows.map((r) => r[1].length));
  return ['Tanılama', ...rows.map(([m, label, detail]) => `  ${m} ${label.padEnd(width)}  ${detail}`)].join('\n');
}

async function configOutput(ctx: LocalContext): Promise<string> {
  const c = ctx.agent.config;
  const b = ctx.budget;
  const lines = [
    `Yapılandırma · ${c.name}`,
    ...kv([
      ['id', c.id],
      ['rol', c.role],
      ['takım', c.team ?? '(yok)'],
      ['sağlayıcı', c.provider ?? 'claude'],
      ['temel model', c.model],
      ['oto model', c.autoModel === false ? 'kapalı' : 'açık'],
      ['oto onay', c.autoApprove ? 'açık' : 'kapalı'],
      ['hafıza', c.memoryMode],
      ['günlük sınır', c.dailyLimitUSD ? fmtUSD(c.dailyLimitUSD) : '(yok)'],
      ['MCP', String(Object.keys(c.mcpServers ?? {}).length)],
    ]),
  ];

  lines.push(...section('Panel', kv([
    ['günlük sınır', b?.settings?.dailyLimitUSD ? fmtUSD(b.settings.dailyLimitUSD) : '(yok)'],
    ['uyarı eşiği', `%${b?.settings?.warnAtPercent ?? 80}`],
    ['tema', document.documentElement.dataset.theme ?? '(varsayılan)'],
    ['terminal', localStorage.getItem('claude-manager.cli') ?? 'claude'],
  ])));

  lines.push('', 'Değiştirmek için: ajan kartındaki düzenle · Ayarlar (bütçe) · Görünüm (tema)');
  return lines.join('\n');
}

async function memoryOutput(ctx: LocalContext): Promise<string> {
  const { nodes } = await api.getMemory();
  const id = ctx.agent.config.id;
  const mine = nodes.filter((n) => n.agentId === id);
  const shared = nodes.filter((n) => n.agentId === 'shared');

  const list = (ns: typeof nodes) =>
    ns.map((n) => `  ${n.slug.padEnd(28)} ${n.description || n.name}`);

  const lines = [`Hafıza · ${ctx.agent.config.name} (mod: ${ctx.agent.config.memoryMode})`];
  lines.push(...section(`Özel — ${mine.length} kayıt`, list(mine)));
  lines.push(...section(`Ortak — ${shared.length} kayıt`, list(shared)));
  if (!mine.length && !shared.length) lines.push('  (henüz kayıt yok)');
  lines.push('', 'Haritası için Hafıza panelini aç.');
  return lines.join('\n');
}

async function todosOutput(ctx: LocalContext): Promise<string> {
  const id = ctx.agent.config.id;
  const mine = ctx.tasks.filter((t) => t.assignedTo === id);
  if (!mine.length) return `${ctx.agent.config.name} ajanına atanmış görev yok.`;

  const MARK: Record<string, string> = { pending: '○', running: '◐', done: '✓', failed: '✗' };
  const lines = [`Görevler · ${ctx.agent.config.name} — ${mine.length} tane`];
  for (const t of mine.slice(0, 40)) {
    const title = t.title.length > 48 ? `${t.title.slice(0, 48)}…` : t.title;
    const chain = t.chainId ? ` [zincir ${(t.stepIndex ?? 0) + 1}]` : '';
    lines.push(`  ${MARK[t.status] ?? '·'} ${title.padEnd(50)} ${t.assignedBy === 'user' ? 'kullanıcı' : t.assignedBy}${chain}`);
  }
  if (mine.length > 40) lines.push(`  … ${mine.length - 40} tane daha (Görevler paneli)`);
  return lines.join('\n');
}

/**
 * Dökümü dosya olarak indirir. Panel localhost'ta kendi sunucusundan
 * servis edildiği için tarayıcı indirmesi burada gerçekten çalışıyor.
 */
async function exportOutput(ctx: LocalContext): Promise<string> {
  const fmt = ctx.args.trim().toLowerCase() === 'json' ? 'json' : 'md';
  const a = ctx.agent;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${a.config.id}-${stamp}.${fmt}`;

  let body: string;
  if (fmt === 'json') {
    body = JSON.stringify({ agent: a.config, exportedAt: new Date().toISOString(), events: ctx.events }, null, 2);
  } else {
    const head = [
      `# ${a.config.name} — terminal dökümü`,
      '',
      `- Ajan: \`${a.config.id}\` (${a.config.role})`,
      `- Model: ${a.currentModel ?? a.config.model}`,
      `- Proje: ${ctx.projectDir}`,
      `- Dışa aktarma: ${new Date().toLocaleString('tr-TR')}`,
      '',
      '---',
      '',
    ];
    const body_ = ctx.events.map((e) => {
      const ts = new Date(e.ts).toLocaleTimeString('tr-TR');
      switch (e.kind) {
        case 'user':
          return `### › ${ts}\n\n${e.text ?? ''}`;
        case 'text':
          return `${e.text ?? ''}`;
        case 'thinking':
          return `> _düşünme:_ ${(e.text ?? '').replace(/\n/g, '\n> ')}`;
        case 'tool_use':
          return `\`\`\`\n${e.toolName}(${e.input ?? ''})\n\`\`\``;
        case 'tool_result':
          return `\`\`\`\n${e.text ?? ''}\n\`\`\``;
        case 'error':
          return `**HATA:** ${e.text ?? ''}`;
        default:
          return `_${e.text ?? ''}_`;
      }
    });
    body = [...head, ...body_].join('\n\n');
  }

  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);

  return `${ctx.events.length} olay ${fmt.toUpperCase()} olarak indirildi: ${name}\n  Başka biçim: /export json  ·  /export md`;
}

async function resumeOutput(ctx: LocalContext): Promise<string> {
  const a = ctx.agent;
  const id = a.config.id;

  if (ctx.args.trim() === 'yeniden' || ctx.args.trim() === 'restart') {
    await api.stopAgent(id);
    await api.startAgent(id);
    await ctx.refreshAgents();
    return [
      'Oturum yeniden başlatıldı.',
      a.sessionId
        ? `  Kayıtlı oturum (${a.sessionId.slice(0, 8)}) sürdürülmeye çalışılır; eskimişse sıfırdan açılır.`
        : '  Kayıtlı oturum yoktu — sıfırdan açıldı.',
    ].join('\n');
  }

  return [
    'Oturum',
    ...kv([
      ['durum', STATUS_TR[a.status] ?? a.status],
      ['oturum id', a.sessionId ?? '(yok — henüz açılmadı)'],
      ['döküm', `${ctx.events.length} olay`],
    ]),
    '',
    'Sunucu yeniden başladığında oturum bu id ile kendiliğinden sürdürülür.',
    'Elle yeniden başlatmak için: /resume yeniden',
  ].join('\n');
}

async function helpOutput(ctx: LocalContext): Promise<string> {
  const width = Math.max(...LOCAL_COMMANDS.map((c) => c.name.length + (c.argumentHint?.length ?? 0))) + 2;
  const local = LOCAL_COMMANDS.map((c) => {
    const head = `/${c.name}${c.argumentHint ? ` ${c.argumentHint}` : ''}`;
    const alias = c.aliases?.length ? ` (= /${c.aliases.join(', /')})` : '';
    return `  ${head.padEnd(width)} ${c.description}${alias}`;
  });

  const agentCmds = (ctx.agent.commands ?? []).filter((c) => !isLocal(c.name));
  return [
    `Panelde çalışan komutlar — ${LOCAL_COMMANDS.length} tane`,
    '  (ajana gönderilmez; veriyi panelin kendisi okur)',
    ...local,
    '',
    `Ajana giden komutlar — ${agentCmds.length} tane`,
    '  /compact, /init, /review, skill\'ler ve kendi komutların dahil.',
    '  "/" yazıp listeden seç; hepsi CLI\'daki gibi çalışır.',
    '',
    'Komut olmayan her şey doğrudan ajana görev olarak gider.',
  ].join('\n');
}

export const LOCAL_COMMANDS: LocalCommand[] = [
  { name: 'help', description: 'Komutları listeler', run: helpOutput },
  { name: 'status', description: 'Ajanın tam durumu (model, oturum, kullanım, bütçe)', run: statusOutput },
  { name: 'context', description: 'Bağlam penceresi dökümü', run: contextOutput },
  { name: 'usage', aliases: ['cost'], description: 'Token/maliyet sayımı ve hesabın plan kotası', run: usageOutput },
  { name: 'model', argumentHint: '[ad]', description: 'Modeli gösterir veya değiştirir', run: modelOutput },
  { name: 'agents', description: 'Panel ajanları + oturumun alt ajanları', run: agentsOutput },
  { name: 'mcp', description: 'MCP sunucularının bağlantı durumu', run: mcpOutput },
  { name: 'config', description: 'Ajan ve panel yapılandırması', run: configOutput },
  { name: 'doctor', description: 'Tanılama: bağlantı, oturum, MCP, bağlam, bütçe', run: doctorOutput },
  { name: 'memory', description: 'Bu ajanın hafıza kayıtları', run: memoryOutput },
  { name: 'todos', description: 'Bu ajana atanmış görevler', run: todosOutput },
  { name: 'export', argumentHint: '[md|json]', description: 'Dökümü dosya olarak indirir', run: exportOutput },
  { name: 'resume', argumentHint: '[yeniden]', description: 'Oturum bilgisi; "yeniden" ile oturumu yeniden başlatır', run: resumeOutput },
  {
    name: 'clear',
    description: 'Terminal dökümünü temizler (ajanın bağlamı korunur)',
    run: async (ctx) => {
      await ctx.clearTranscript();
      return null;
    },
  },
];

const LOCAL_NAMES = new Set(LOCAL_COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]));

export function isLocal(name: string): boolean {
  return LOCAL_NAMES.has(name.toLowerCase());
}

/** Girdi yerel bir komutsa onu döndürür; değilse null (ajana gitmeli). */
export function matchLocal(input: string): { cmd: LocalCommand; args: string } | null {
  const m = /^\/(\S+)\s*(.*)$/s.exec(input.trim());
  if (!m) return null;
  const name = m[1].toLowerCase();
  const cmd = LOCAL_COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
  return cmd ? { cmd, args: m[2] } : null;
}

/** Yerel komutları "/" menüsünde de göstermek için SlashCommand biçimine çevirir. */
export function localAsSlashCommands(): SlashCommand[] {
  return LOCAL_COMMANDS.map((c) => ({
    name: c.name,
    description: `(panel) ${c.description}`,
    argumentHint: c.argumentHint,
    aliases: c.aliases,
  }));
}
