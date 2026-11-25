/**
 * Pano widget'ları. Her biri gerçek veriye bağlı; uydurma metrik yok.
 *
 * Gönderim ve izin yanıtı mevcut TEK yollardan geçer: ekibe yazma
 * Orchestrator ile aynı (`buildBrief` + `api.sendMessage`), izin yanıtı
 * `answerPermission`. Pano yeni bir uç ya da ikinci bir yol açmaz.
 */
import { useEffect, useMemo, useState } from 'react';
import type {
  AgentSnapshot,
  BudgetState,
  ChangesResponse,
  PermissionRequestInfo,
  SystemInfo,
  Task,
  TranscriptEvent,
  UsageTurn,
} from '../../types';
import { api } from '../../api';
import { buildBrief } from '../../brief';
import { canDelegate, leadOf } from '../../teams';
import { fmtCost, fmtNum, totalTokens, ROLE_LABEL, STATUS_LABEL } from '../../format';
import { answerPermission, permissionSummary } from '../../permissions';
import { Avatar } from '../chat/ChatMessage';
import { buildFeed, previewOf } from '../../chatFeed';
import { L, dateLocale } from '../../i18n';
import { BudgetDial, DelegationNet, Heatmap, findLead, useUsageHistory } from '../GlassOverview';

export interface WidgetData {
  agents: AgentSnapshot[];
  tasks: Task[];
  budget: BudgetState | null;
  transcripts: Record<string, TranscriptEvent[]>;
  permissions: PermissionRequestInfo[];
  onOpenSettings: () => void;
  refreshAgents: () => Promise<void>;
  loadTranscript: (id: string) => Promise<void>;
  /** Bir ajanın terminalini açar (delegasyon ağındaki düğüm). */
  onOpenAgent?: (id: string) => void;
}

/** Aralıklı yenilenen tek bir uç okuması (widget kapanınca durur). */
function usePoll<T>(load: () => Promise<T>, ms: number): T | null | undefined {
  // undefined = yükleniyor, null = okunamadı
  const [v, setV] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const run = () =>
      load()
        .then((x) => alive && setV(x))
        .catch(() => alive && setV(null));
    void run();
    const t = setInterval(run, ms);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

const nameOf = (agents: AgentSnapshot[], id: string) =>
  id === 'user' ? L.board.you : (agents.find((a) => a.config.id === id)?.config.name ?? id);

// ------------------------------------------------------------ ekibe yaz
export function ComposeWidget({ agents }: WidgetData) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; msg: string } | null>(null);
  const lead = leadOf(agents);

  async function send() {
    const request = text.trim();
    if (!request || !lead || busy) return;
    setBusy(true);
    setNote(null);
    try {
      // send() ölü oturumu kendiliğinden başlatır (bkz. Orchestrator).
      await api.sendMessage(lead.config.id, buildBrief(request, lead, agents));
      setText('');
      setNote({ ok: true, msg: L.board.sent(lead.config.name) });
    } catch (e) {
      setNote({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!lead) return <div className="bw-empty">{L.board.noTeam}</div>;
  return (
    <div className="bw-compose">
      <div className="bw-compose-lead">
        <Avatar agent={lead} size="sm" />
        <span>{lead.config.name}</span>
        <span className="bw-dim">{canDelegate(lead) ? L.board.splits(agents.length - 1) : L.board.direct}</span>
      </div>
      <textarea
        className="bw-input"
        rows={3}
        value={text}
        placeholder={L.board.placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <div className="bw-compose-foot">
        {note && <span className={note.ok ? 'bw-ok' : 'bw-err'}>{note.msg}</span>}
        <span className="bw-dim bw-kbd">Ctrl+Enter</span>
        <button className="primary" disabled={!text.trim() || busy} onClick={() => void send()}>
          {L.board.send}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ canlı akış
export function FlowWidget({ agents, tasks }: WidgetData) {
  const recent = useMemo(
    () => [...tasks].sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt)).slice(0, 7),
    [tasks]
  );
  if (!recent.length) return <div className="bw-empty">{L.board.noFlow}</div>;
  return (
    <ol className="bw-list">
      {recent.map((t) => (
        <li key={t.id} className={`bw-row s-${t.status}`}>
          <span className="bw-dot" aria-hidden="true" />
          <span className="bw-row-main">
            <span className="bw-row-title">{t.title}</span>
            <span className="bw-row-sub">
              {nameOf(agents, t.assignedBy)} → {nameOf(agents, t.assignedTo)}
            </span>
          </span>
          <time className="bw-row-time">
            {new Date(t.startedAt ?? t.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
          </time>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ onay bekleyenler
export function ApprovalsWidget({ agents }: WidgetData) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = agents.flatMap((a) => a.pendingPermissions.map((p) => ({ agent: a, req: p })));
  if (!items.length) return <div className="bw-empty bw-calm">{L.board.noApprovals}</div>;
  return (
    <ul className="bw-list">
      {items.map(({ agent, req }) => (
        <li key={req.id} className="bw-approval">
          <div className="bw-row-main">
            <span className="bw-row-title">
              {agent.config.name} · <code>{req.toolName}</code>
            </span>
            <span className="bw-row-sub" title={permissionSummary(req)}>{permissionSummary(req)}</span>
          </div>
          <div className="bw-approval-actions">
            <button
              className="primary"
              disabled={busyId === req.id}
              onClick={async () => {
                setBusyId(req.id);
                await answerPermission(agent.config.id, req, 0);
                setBusyId(null);
              }}
            >
              {L.board.allow}
            </button>
            <button
              disabled={busyId === req.id}
              onClick={async () => {
                setBusyId(req.id);
                await answerPermission(agent.config.id, req, 2);
                setBusyId(null);
              }}
            >
              {L.board.deny}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------ ajanlar
export function AgentsWidget({ agents, refreshAgents }: WidgetData) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!agents.length) return <div className="bw-empty">{L.board.noTeam}</div>;
  async function toggle(a: AgentSnapshot) {
    setBusyId(a.config.id);
    try {
      await (a.status === 'offline' ? api.startAgent(a.config.id) : api.stopAgent(a.config.id));
      await refreshAgents();
    } finally {
      setBusyId(null);
    }
  }
  return (
    <div className="bw-agents">
      {agents.map((a) => (
        <div key={a.config.id} className={`bw-agent st-${a.status}`}>
          <Avatar agent={a} size="md" />
          <div className="bw-agent-main">
            <span className="bw-row-title">{a.config.name}</span>
            <span className="bw-row-sub">
              {ROLE_LABEL[a.config.role] ?? a.config.role} · {a.currentModel ?? a.config.model}
            </span>
            <span className="bw-agent-meta">
              <span className={`bw-pill st-${a.status}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
              <span className="bw-dim">{fmtNum(totalTokens(a.usage))} tok</span>
            </span>
          </div>
          <button
            className="bw-icon"
            disabled={busyId === a.config.id}
            onClick={() => void toggle(a)}
            title={a.status === 'offline' ? L.board.start : L.board.stop}
            aria-label={`${a.config.name}: ${a.status === 'offline' ? L.board.start : L.board.stop}`}
          >
            {a.status === 'offline' ? '▶' : '■'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ durum
export function StatsWidget({ agents, tasks }: WidgetData) {
  const n = (s: Task['status']) => tasks.filter((t) => t.status === s).length;
  const cells: [string, number, string][] = [
    [L.board.online, agents.filter((a) => a.status !== 'offline').length, ''],
    [L.board.running, n('running'), 'aux'],
    [L.board.queued, n('pending'), ''],
    [L.board.done_, n('done'), 'ok'],
    [L.board.failed, n('failed'), n('failed') ? 'err' : ''],
  ];
  return (
    <div className="bw-stats">
      {cells.map(([k, v, tone]) => (
        <div key={k} className="bw-stat">
          <span className={`bw-stat-v${tone ? ` t-${tone}` : ''}`}>{v}</span>
          <span className="bw-stat-k">{k}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ bütçe
export function BudgetWidget({ budget, onOpenSettings }: WidgetData) {
  if (!budget) return <div className="bw-empty">{L.board.noData}</div>;
  const pct = budget.limitUSD ? Math.min(100, budget.pct ?? 0) : null;
  return (
    <div className="bw-budget">
      <span className="bw-big">{fmtCost(budget.spentUSD)}</span>
      <span className="bw-dim">
        {budget.limitUSD ? L.board.ofLimit(`$${budget.limitUSD.toFixed(2)}`) : L.board.noLimit}
      </span>
      {pct !== null && (
        <span className={`bw-gauge${budget.exceeded ? ' crit' : budget.warn ? ' warn' : ''}`}>
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
      <button className="bw-link" onClick={onOpenSettings}>
        {budget.limitUSD ? L.board.changeLimit : L.board.setLimit}
      </button>
    </div>
  );
}

// ------------------------------------------------------------ son 7 gün
const DAY = 86_400_000;
export function CostWidget(_: WidgetData) {
  const [turns, setTurns] = useState<UsageTurn[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .usageHistory()
        .then((h) => alive && setTurns(h.turns))
        .catch(() => alive && setTurns([]));
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const out = Array.from({ length: 7 }, (_, i) => ({ t: start.getTime() - (6 - i) * DAY, cost: 0 }));
    for (const turn of turns ?? []) {
      const i = Math.floor((turn.ts - out[0].t) / DAY);
      if (i >= 0 && i < 7) out[i].cost += turn.costUSD;
    }
    return out;
  }, [turns]);

  if (!turns) return <div className="bw-empty">{L.board.loading}</div>;
  const max = Math.max(...days.map((d) => d.cost), 0.0001);
  const total = days.reduce((s, d) => s + d.cost, 0);
  return (
    <div className="bw-cost">
      <div className="bw-cost-head">
        <span className="bw-big">{fmtCost(total)}</span>
        <span className="bw-dim">{L.board.last7}</span>
      </div>
      <div className="bw-bars" role="img" aria-label={L.board.last7}>
        {days.map((d, i) => (
          <span key={d.t} className="bw-bar" title={`${new Date(d.t).toLocaleDateString(dateLocale)} · ${fmtCost(d.cost)}`}>
            <span className={i === 6 ? 'today' : ''} style={{ height: `${Math.max(3, (d.cost / max) * 100)}%` }} />
            <em>{new Date(d.t).toLocaleDateString(dateLocale, { weekday: 'narrow' })}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ son mesajlar
export function ActivityWidget({ agents, transcripts, tasks, permissions, loadTranscript }: WidgetData) {
  // Akış bütün ajanların dökümüne bakar: hepsi yüklenmeli (ChatShell ile aynı).
  useEffect(() => {
    for (const a of agents) if (!transcripts[a.config.id]) void loadTranscript(a.config.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length]);
  const items = useMemo(
    () => buildFeed({ agents, transcripts, tasks, permissions }).slice(-6).reverse(),
    [agents, transcripts, tasks, permissions]
  );
  if (!items.length) return <div className="bw-empty">{L.board.noActivity}</div>;
  const who = (id: string) => nameOf(agents, id);
  return (
    <ol className="bw-list">
      {items.map((it) => (
        <li key={it.id} className="bw-row bw-row-plain">
          <span className="bw-row-main">
            <span className="bw-row-text">{previewOf(it, who)}</span>
          </span>
          <time className="bw-row-time">
            {new Date(it.ts).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
          </time>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ hızlı eylemler
export function ActionsWidget({ agents, refreshAgents, onOpenSettings }: WidgetData) {
  const [busy, setBusy] = useState(false);
  const offline = agents.filter((a) => a.status === 'offline');
  const online = agents.filter((a) => a.status !== 'offline');
  const allAuto = agents.length > 0 && agents.every((a) => a.config.autoApprove);
  async function run(f: () => Promise<unknown>) {
    setBusy(true);
    try {
      await f();
      await refreshAgents();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bw-actions">
      <button disabled={busy || !offline.length} onClick={() => void run(() => Promise.all(offline.map((a) => api.startAgent(a.config.id))))}>
        ▶ {L.board.startAll(offline.length)}
      </button>
      <button disabled={busy || !online.length} onClick={() => void run(() => Promise.all(online.map((a) => api.stopAgent(a.config.id))))}>
        ■ {L.board.stopAll(online.length)}
      </button>
      <button
        className={allAuto ? 'bw-on' : ''}
        disabled={busy || !agents.length}
        aria-pressed={allAuto}
        title={L.board.autoTitle}
        onClick={() => void run(() => Promise.all(agents.map((a) => api.updateAgent(a.config.id, { autoApprove: !allAuto }))))}
      >
        {allAuto ? L.board.autoOff : L.board.autoOn}
      </button>
      <button onClick={onOpenSettings}>{L.board.settings}</button>
    </div>
  );
}

// ------------------------------------------------------------ ajan başına token
export function TokensWidget({ agents }: WidgetData) {
  const rows = agents
    .map((a) => ({ a, n: totalTokens(a.usage), cost: a.usage.costUSD }))
    .filter((r) => r.n > 0)
    .sort((x, y) => y.n - x.n);
  if (!rows.length) return <div className="bw-empty">{L.board.noData}</div>;
  const max = rows[0].n;
  return (
    <ul className="bw-hbars">
      {rows.map(({ a, n, cost }) => (
        <li key={a.config.id} title={`${fmtNum(n)} tok · ${fmtCost(cost)}`}>
          <span className="bw-hbar-name">{a.config.name}</span>
          <span className="bw-hbar-track">
            <span style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
          </span>
          <span className="bw-hbar-v">{fmtNum(n)}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------ plan kotası
interface RateWindow {
  utilization?: number;
  resets_at?: string;
}
export function QuotaWidget(_: WidgetData) {
  const d = usePoll(() => api.usageDetail(), 30_000);
  if (d === undefined) return <div className="bw-empty">{L.board.loading}</div>;
  const plan = (d?.plan ?? null) as { rate_limits?: Record<string, RateWindow | null> } | null;
  const windows = Object.entries(plan?.rate_limits ?? {}).filter(
    (e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number'
  );
  if (!windows.length) return <div className="bw-empty">{L.board.noQuota}</div>;
  return (
    <div className="bw-quota">
      {windows.map(([k, w]) => {
        const pct = Math.min(100, Math.max(0, w.utilization!));
        return (
          <div key={k} className="bw-quota-row">
            <span className="bw-quota-head">
              <span>{L.survey.window[k] ?? k}</span>
              <b>{L.extra.pct(Math.round(pct))}</b>
            </span>
            <span className={`bw-gauge${pct >= 90 ? ' crit' : pct >= 70 ? ' warn' : ''}`}>
              <span style={{ width: `${pct}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ son değişiklikler
const CHANGE_MARK: Record<string, string> = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R', untracked: '?' };
export function ChangesWidget({ agents }: WidgetData) {
  const d = usePoll<ChangesResponse>(() => api.changes(), 15_000);
  if (d === undefined) return <div className="bw-empty">{L.board.loading}</div>;
  if (!d || !d.files.length) return <div className="bw-empty">{L.board.noChanges}</div>;
  return (
    <div className="bw-changes">
      <span className="bw-dim">{L.board.changedFiles(d.files.length)}</span>
      <ul className="bw-list">
        {d.files.slice(0, 8).map((f) => (
          <li key={f.path} className="bw-change">
            <span className={`bw-mark c-${f.status}`}>{CHANGE_MARK[f.status] ?? '·'}</span>
            <span className="bw-change-path" title={f.path}>{f.path}</span>
            <span className="bw-dim">{f.touches[0] ? nameOf(agents, f.touches[0].agentId) : L.board.byYou}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ sistem
function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}
export function SystemWidget(_: WidgetData) {
  const sys = usePoll<SystemInfo>(() => api.system(), 20_000);
  if (sys === undefined) return <div className="bw-empty">{L.board.loading}</div>;
  if (!sys) return <div className="bw-empty">{L.board.noData}</div>;
  const used = sys.host.memTotal - sys.host.memFree;
  const pct = (used / sys.host.memTotal) * 100;
  return (
    <div className="bw-system">
      <div className="bw-quota-row">
        <span className="bw-quota-head">
          <span>{L.survey.memory}</span>
          <b>{fmtBytes(used)} / {fmtBytes(sys.host.memTotal)}</b>
        </span>
        <span className={`bw-gauge${pct >= 90 ? ' crit' : pct >= 75 ? ' warn' : ''}`}>
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
      <dl className="bw-kv">
        <dt>{L.survey.name}</dt>
        <dd>{sys.project.name}</dd>
        <dt>{L.survey.branch}</dt>
        <dd>{sys.project.gitBranch ?? '—'}</dd>
        <dt>{L.survey.files}</dt>
        <dd>{fmtNum(sys.project.fileCount)}{sys.project.truncated ? '+' : ''}</dd>
        <dt>{L.survey.cpu}</dt>
        <dd>{L.survey.cores(sys.host.cpuCount)}</dd>
        <dt>Node</dt>
        <dd>{sys.host.nodeVersion}</dd>
      </dl>
    </div>
  );
}

// ------------------------------------------------------------ not defteri
const NOTES_KEY = 'claudiva.board.notes';
export function NotesWidget(_: WidgetData) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(NOTES_KEY) ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(NOTES_KEY, text);
      } catch {
        /* gizli sekme */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <textarea
      className="bw-input bw-notes"
      value={text}
      placeholder={L.board.notesPlaceholder}
      onChange={(e) => setText(e.target.value)}
    />
  );
}

// ------------------------------------------------------------ Cam'dan gelen üçlü
// Genel Durum'daki (GlassOverview) bileşenlerin AYNISI, `bare` kipte: kart
// çerçevesi ve başlık Pano'nun. Veri ve kurallar tek yerde kalır.
export function HeatmapWidget({ agents }: WidgetData) {
  const hist = useUsageHistory();
  return <Heatmap bare agents={agents} turns={hist?.turns ?? null} since={hist?.since ?? null} />;
}

export function DialWidget({ budget, onOpenSettings }: WidgetData) {
  return <BudgetDial bare budget={budget} onOpenSettings={onOpenSettings} />;
}

export function NetworkWidget({ agents, tasks, onOpenAgent }: WidgetData) {
  return <DelegationNet bare agents={agents} tasks={tasks} lead={findLead(agents)} onOpenAgent={onOpenAgent ?? (() => {})} />;
}

export const WIDGETS = {
  compose: ComposeWidget,
  flow: FlowWidget,
  approvals: ApprovalsWidget,
  activity: ActivityWidget,
  actions: ActionsWidget,
  agents: AgentsWidget,
  tokens: TokensWidget,
  stats: StatsWidget,
  budget: BudgetWidget,
  cost: CostWidget,
  quota: QuotaWidget,
  changes: ChangesWidget,
  system: SystemWidget,
  notes: NotesWidget,
  heatmap: HeatmapWidget,
  dial: DialWidget,
  network: NetworkWidget,
} as const;
