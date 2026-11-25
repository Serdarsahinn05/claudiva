import { api } from './api';
import type {
  AgentSnapshot,
  BudgetState,
  SlashCommand,
  Task,
  TranscriptEvent,
  UsageSummary,
} from './types';
import { L, dateLocale } from './i18n';

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
 * Çıktı metni MODEL DEĞİL panel yazar, bu yüzden arayüz diliyle gelir
 * (`L.cmdOut`). Kullanıcının yazdığı dile uyan yalnız SDK'ya giden komutlardır.
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

const O = L.cmdOut;

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
  return d.toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

const onOff = (v: boolean) => (v ? O.on : O.off);

const STATUS_TR: Record<string, string> = {
  ...L.status,
};

/**
 * "İstendi ama okunamadı" (null) ile "hiç istenmedi" (undefined) ayrımını
 * kullanıcıya çevirir. Oturum kapalıyken her parça null gelir; sebebi
 * neredeyse her zaman budur, o yüzden ajan durumu da söylenir.
 */
function unreadable(agent: AgentSnapshot): string {
  return agent.status === 'offline' ? O.unreadableOffline : O.unreadableBusy;
}

// ------------------------------------------------------------------ komutlar

async function usageOutput(ctx: LocalContext): Promise<string> {
  const { tracked, plan } = await api.usageDetail();
  const lines: string[] = [];

  const t = tracked.total;
  lines.push(O.projectUsage);
  lines.push(
    `  ${fmtTokens(t.inputTokens + t.outputTokens)} token · ${fmtUSD(t.costUSD)} · ${O.requests(t.requests)}`,
  );

  const rows = Object.entries(tracked.perAgent).filter(([, u]) => u.requests > 0);
  if (rows.length) {
    lines.push('');
    for (const [id, u] of rows.sort((a, b) => b[1].costUSD - a[1].costUSD)) {
      const name = id === ctx.agent.config.id ? `${id} ${O.thisAgent}` : id;
      lines.push(
        `  ${name.padEnd(24)} ${fmtTokens(u.inputTokens + u.outputTokens).padStart(7)} · ${fmtUSD(u.costUSD)}`,
      );
    }
  }

  const turn = ctx.agent.lastTurn;
  if (turn) {
    lines.push(...section(O.lastTurnOfAgent, kv([
      [O.input, `${fmtTokens(turn.inputTokens)} ${O.tok}`],
      [O.output, `${fmtTokens(turn.outputTokens)} ${O.tok}`],
      [O.cache, O.cacheRW(fmtTokens(turn.cacheReadTokens), fmtTokens(turn.cacheCreationTokens))],
      [O.cost, fmtUSD(turn.costUSD)],
    ])));
  }

  const b = ctx.budget;
  if (b) {
    lines.push('', O.panelBudgetToday);
    if (b.limitUSD && b.pct !== null) {
      lines.push(`  ${bar(b.pct)} %${Math.round(b.pct)}  ${fmtUSD(b.spentUSD)} / ${fmtUSD(b.limitUSD)}`);
    } else {
      lines.push(`  ${O.spentNoLimit(fmtUSD(b.spentUSD))}`);
    }
  }

  const p = plan as PlanUsage | null;
  const windows = p?.rate_limits ? Object.entries(p.rate_limits) : [];
  const usable = windows.filter(
    (e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number',
  );

  lines.push('');
  if (p?.rate_limits_available && usable.length) {
    lines.push(O.planQuota);
    for (const [key, win] of usable) {
      const label = O.windows[key] ?? key;
      const reset = fmtReset(win.resets_at);
      lines.push(
        `  ${label.padEnd(18)} ${bar(win.utilization!)} %${String(win.utilization).padStart(3)}${reset ? `  ↻ ${reset}` : ''}`,
      );
    }
  } else {
    lines.push(O.planUnreadable);
    lines.push(O.planNeedsAgent);
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

async function contextOutput(ctx: LocalContext): Promise<string> {
  const { context } = await api.inspect(ctx.agent.config.id, ['context']);
  if (!context) return [O.contextUnavailable, unreadable(ctx.agent)].join('\n');

  const lines = [
    O.contextWindow(context.model),
    `  ${bar(context.percentage)} %${Math.round(context.percentage)}` +
      `  ${fmtTokens(context.totalTokens)} / ${fmtTokens(context.maxTokens)} ${O.tok}`,
    '',
    O.whereItGoes,
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
  if (!cats.length) lines.push(O.contextEmpty);

  lines.push('', O.compactHint);
  return lines.join('\n');
}

async function modelOutput(ctx: LocalContext): Promise<string> {
  const wanted = ctx.args.trim();
  const current = ctx.agent.currentModel ?? ctx.agent.config.model;

  if (wanted) {
    await api.updateAgent(ctx.agent.config.id, { model: wanted });
    await ctx.refreshAgents();
    return [
      O.modelChanged(current, wanted),
      O.modelApplies,
      ctx.agent.config.autoModel === false ? '' : O.modelAutoNote,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const { models } = await api.inspect(ctx.agent.config.id, ['models']);
  const lines = [
    O.model,
    ...kv([
      [O.base, ctx.agent.config.model],
      [O.now, current],
      [O.autoPick, onOff(ctx.agent.config.autoModel !== false)],
    ]),
  ];

  if (models === null) {
    lines.push('', O.modelsUnreadable, unreadable(ctx.agent));
  } else if (models?.length) {
    lines.push('', O.models);
    const width = Math.max(...models.map((m) => m.value.length));
    for (const m of models) {
      const mark = m.value === current ? '›' : ' ';
      lines.push(`  ${mark} ${m.value.padEnd(width)}  ${m.displayName}`);
    }
  }

  lines.push('', O.modelHint);
  return lines.join('\n');
}

async function statusOutput(ctx: LocalContext): Promise<string> {
  const a = ctx.agent;
  const { context, account } = await api.inspect(a.config.id, ['context', 'account']);
  const u = a.usage;

  const lines = [
    `${a.config.name} · ${STATUS_TR[a.status] ?? a.status}`,
    ...kv([
      [O.role, a.config.role],
      [O.team, a.config.team ?? O.none],
      ['model', `${a.currentModel ?? a.config.model}${a.currentModel && a.currentModel !== a.config.model ? O.baseParen(a.config.model) : ''}`],
      [O.session, a.sessionId ? a.sessionId.slice(0, 8) : O.none],
      [O.autoApprove, onOff(!!a.config.autoApprove)],
      [O.memory, a.config.memoryMode],
      [O.commands, O.count(a.commands?.length ?? 0)],
    ]),
  ];

  lines.push(...section(O.usageAllTime, kv([
    [O.token, `${fmtTokens(u.inputTokens + u.outputTokens)} (${O.requests(u.requests)})`],
    [O.cost, fmtUSD(u.costUSD)],
    [O.lastTurn, a.lastTurn ? `${fmtTokens(a.lastTurn.inputTokens + a.lastTurn.outputTokens)} ${O.tok} · ${fmtUSD(a.lastTurn.costUSD)}` : O.notYet],
  ])));

  if (context) {
    lines.push(...section(O.context, [
      `  ${bar(context.percentage)} %${Math.round(context.percentage)}  ${fmtTokens(context.totalTokens)} / ${fmtTokens(context.maxTokens)}`,
    ]));
  }

  if (ctx.budget) {
    const b = ctx.budget;
    const own = b.perAgentUSD[a.config.id] ?? 0;
    lines.push(...section(O.budgetToday, kv([
      [O.thisAgentKey, fmtUSD(own)],
      [O.panel, b.limitUSD ? `${fmtUSD(b.spentUSD)} / ${fmtUSD(b.limitUSD)} (%${Math.round(b.pct ?? 0)})` : `${fmtUSD(b.spentUSD)} · ${O.unlimited}`],
    ])));
  }

  if (account) {
    lines.push(...section(O.account, kv([
      [O.email, account.email ?? '—'],
      [O.plan, account.subscriptionType ?? '—'],
      [O.provider, account.apiProvider ?? '—'],
    ])));
  }

  lines.push(...section(O.env, kv([
    [O.project, ctx.projectDir || '—'],
    [O.panel, ctx.connected ? O.connected : O.disconnected],
    [O.crew, O.crewCount(ctx.agents.length, ctx.agents.filter((x) => x.status !== 'offline').length)],
  ])));

  return lines.join('\n');
}

async function agentsOutput(ctx: LocalContext): Promise<string> {
  const { agents } = await api.inspect(ctx.agent.config.id, ['agents']);
  const lines = [O.panelAgents];
  const width = Math.max(...ctx.agents.map((a) => a.config.id.length), 8);
  for (const a of ctx.agents) {
    const mark = a.config.id === ctx.agent.config.id ? '›' : ' ';
    lines.push(
      `  ${mark} ${a.config.id.padEnd(width)}  ${(STATUS_TR[a.status] ?? a.status).padEnd(12)} ${a.config.role}${a.config.team ? ` · ${a.config.team}` : ''}`,
    );
  }

  if (agents === null) {
    lines.push('', O.subagentsUnreadable, unreadable(ctx.agent));
  } else if (agents?.length) {
    lines.push('', O.subagents(agents.length));
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
  if (mcp === null) return [O.mcpUnreadable, unreadable(ctx.agent)].join('\n');
  if (!mcp?.length) return O.mcpNone;

  const width = Math.max(...mcp.map((s) => s.name.length));
  const lines = [O.mcpServers(mcp.length)];
  for (const s of mcp) {
    const mark = s.status === 'connected' ? '●' : s.status === 'failed' ? '✗' : '○';
    lines.push(
      `  ${mark} ${s.name.padEnd(width)}  ${s.status.padEnd(10)} ${O.tools(s.toolCount)}${s.scope ? ` · ${s.scope}` : ''}`,
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

  check(O.dPanel, ctx.connected, ctx.connected ? O.connected : O.dWsClosed);
  check(O.session, a.status !== 'offline', a.status === 'offline' ? O.dAgentOff : `${STATUS_TR[a.status]} · ${a.sessionId ? a.sessionId.slice(0, 8) : O.dNoId}`);
  check(O.dCmdList, (a.commands?.length ?? 0) > 0, O.dCmds(a.commands?.length ?? 0));

  if (mcp == null) check('MCP', null, O.dMcpUnreadable);
  else {
    const bad = mcp.filter((s) => s.status === 'failed' || s.status === 'needs-auth');
    check('MCP', bad.length === 0, bad.length ? bad.map((s) => `${s.name}: ${s.status}`).join(', ') : O.dMcpOk(mcp.length));
  }

  if (context == null) check(O.dContext, null, O.dUnreadable);
  else check(O.dContext, context.percentage < 80, `${O.dFull(Math.round(context.percentage))}${context.percentage >= 80 ? O.dSuggestCompact : ''}`);

  const b = ctx.budget;
  if (!b?.limitUSD) check(O.dBudget, null, O.dNoLimit);
  else check(O.dBudget, !b.warn, `${fmtUSD(b.spentUSD)} / ${fmtUSD(b.limitUSD)} (%${Math.round(b.pct ?? 0)})`);

  check(O.dProjectDir, !!ctx.projectDir, ctx.projectDir || O.dUnreadable);
  if (system) {
    check('git', !!system.project.gitBranch, system.project.gitBranch ?? O.dNotRepo);
    check('SDK', true, `agent-sdk ${system.claude.sdkVersion} · node ${system.host.nodeVersion}`);
  }

  const width = Math.max(...rows.map((r) => r[1].length));
  return [O.doctor, ...rows.map(([m, label, detail]) => `  ${m} ${label.padEnd(width)}  ${detail}`)].join('\n');
}

async function configOutput(ctx: LocalContext): Promise<string> {
  const c = ctx.agent.config;
  const b = ctx.budget;
  const lines = [
    O.configTitle(c.name),
    ...kv([
      ['id', c.id],
      [O.role, c.role],
      [O.team, c.team ?? O.none],
      [O.provider, c.provider ?? 'claude'],
      [O.baseModel, c.model],
      [O.autoModel, onOff(c.autoModel !== false)],
      [O.autoApprove, onOff(!!c.autoApprove)],
      [O.memory, c.memoryMode],
      [O.dailyLimit, c.dailyLimitUSD ? fmtUSD(c.dailyLimitUSD) : O.none],
      ['MCP', String(Object.keys(c.mcpServers ?? {}).length)],
    ]),
  ];

  lines.push(...section(O.panelTitle, kv([
    [O.dailyLimit, b?.settings?.dailyLimitUSD ? fmtUSD(b.settings.dailyLimitUSD) : O.none],
    [O.warnAt, `%${b?.settings?.warnAtPercent ?? 80}`],
    [O.theme, document.documentElement.dataset.theme ?? O.themeDefault],
    [O.terminal, localStorage.getItem('claudiva.cli') ?? 'claude'],
  ])));

  lines.push('', O.configHint);
  return lines.join('\n');
}

async function memoryOutput(ctx: LocalContext): Promise<string> {
  const { nodes } = await api.getMemory();
  const id = ctx.agent.config.id;
  const mine = nodes.filter((n) => n.agentId === id);
  const shared = nodes.filter((n) => n.agentId === 'shared');

  const list = (ns: typeof nodes) =>
    ns.map((n) => `  ${n.slug.padEnd(28)} ${n.description || n.name}`);

  const lines = [O.memoryTitle(ctx.agent.config.name, ctx.agent.config.memoryMode)];
  lines.push(...section(O.privateN(mine.length), list(mine)));
  lines.push(...section(O.sharedN(shared.length), list(shared)));
  if (!mine.length && !shared.length) lines.push(O.noRecords);
  lines.push('', O.memoryHint);
  return lines.join('\n');
}

async function todosOutput(ctx: LocalContext): Promise<string> {
  const id = ctx.agent.config.id;
  const mine = ctx.tasks.filter((t) => t.assignedTo === id);
  if (!mine.length) return O.noTasks(ctx.agent.config.name);

  const MARK: Record<string, string> = { pending: '○', running: '◐', done: '✓', failed: '✗' };
  const lines = [O.tasksTitle(ctx.agent.config.name, mine.length)];
  for (const t of mine.slice(0, 40)) {
    const title = t.title.length > 48 ? `${t.title.slice(0, 48)}…` : t.title;
    const chain = t.chainId ? O.chainStep((t.stepIndex ?? 0) + 1) : '';
    lines.push(`  ${MARK[t.status] ?? '·'} ${title.padEnd(50)} ${t.assignedBy === 'user' ? O.user : t.assignedBy}${chain}`);
  }
  if (mine.length > 40) lines.push(O.moreTasks(mine.length - 40));
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
      O.exTitle(a.config.name),
      '',
      `- ${O.exAgent}: \`${a.config.id}\` (${a.config.role})`,
      `- Model: ${a.currentModel ?? a.config.model}`,
      `- ${O.exProject}: ${ctx.projectDir}`,
      `- ${O.exAt}: ${new Date().toLocaleString(dateLocale)}`,
      '',
      '---',
      '',
    ];
    const body_ = ctx.events.map((e) => {
      const ts = new Date(e.ts).toLocaleTimeString(dateLocale);
      switch (e.kind) {
        case 'user':
          return `### › ${ts}\n\n${e.text ?? ''}`;
        case 'text':
          return `${e.text ?? ''}`;
        case 'thinking':
          return `> _${O.exThinking}:_ ${(e.text ?? '').replace(/\n/g, '\n> ')}`;
        case 'tool_use':
          return `\`\`\`\n${e.toolName}(${e.input ?? ''})\n\`\`\``;
        case 'tool_result':
          return `\`\`\`\n${e.text ?? ''}\n\`\`\``;
        case 'error':
          return `**${O.exError}:** ${e.text ?? ''}`;
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

  return O.exported(ctx.events.length, fmt.toUpperCase(), name);
}

async function resumeOutput(ctx: LocalContext): Promise<string> {
  const a = ctx.agent;
  const id = a.config.id;

  // İki dilde de iki argüman kabul edilir (eski dökümler/alışkanlık).
  if (ctx.args.trim() === 'yeniden' || ctx.args.trim() === 'restart') {
    await api.stopAgent(id);
    await api.startAgent(id);
    await ctx.refreshAgents();
    return [
      O.restarted,
      a.sessionId ? O.resumeTried(a.sessionId.slice(0, 8)) : O.resumeFresh,
    ].join('\n');
  }

  return [
    O.sessionTitle,
    ...kv([
      [O.state, STATUS_TR[a.status] ?? a.status],
      [O.sessionId, a.sessionId ?? O.noSession],
      [O.transcript, O.events(ctx.events.length)],
    ]),
    '',
    O.resumeAuto,
    O.resumeHint,
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
    O.helpLocal(LOCAL_COMMANDS.length),
    O.helpLocalNote,
    ...local,
    '',
    O.helpAgent(agentCmds.length),
    O.helpAgentNote1,
    O.helpAgentNote2,
    '',
    O.helpRest,
  ].join('\n');
}

export const LOCAL_COMMANDS: LocalCommand[] = [
  { name: 'help', description: L.commands.help, run: helpOutput },
  { name: 'status', description: L.commands.status, run: statusOutput },
  { name: 'context', description: L.commands.context, run: contextOutput },
  { name: 'usage', aliases: ['cost'], description: L.commands.usage, run: usageOutput },
  { name: 'model', argumentHint: L.commands.modelArg, description: L.commands.model, run: modelOutput },
  { name: 'agents', description: L.commands.agents, run: agentsOutput },
  { name: 'mcp', description: L.commands.mcp, run: mcpOutput },
  { name: 'config', description: L.commands.config, run: configOutput },
  { name: 'doctor', description: L.commands.doctor, run: doctorOutput },
  { name: 'memory', description: L.commands.memory, run: memoryOutput },
  { name: 'todos', description: L.commands.todos, run: todosOutput },
  { name: 'export', argumentHint: '[md|json]', description: L.commands.export, run: exportOutput },
  { name: 'resume', argumentHint: L.commands.resumeArg, description: L.commands.resume, run: resumeOutput },
  {
    name: 'clear',
    description: L.commands.clear,
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
    description: `${O.panelTag} ${c.description}`,
    argumentHint: c.argumentHint,
    aliases: c.aliases,
  }));
}
