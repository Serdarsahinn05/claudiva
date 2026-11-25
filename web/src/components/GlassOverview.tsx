/**
 * Genel Durum'un Cam stili gövdesi (2026-11-25). Önizleme:
 * claude.ai/artifact/WetjE1G2wkAiHFGKFeB3a8 ("Cam'ın Genel Durum ekranı").
 *
 * Kartlar ve kaynakları (hepsi gerçek veri; uydurma metrik yok, DESIGN.md):
 *  - Koyu kahraman kart: Survey'in durum cümlesi + çalışan/harcama/açık görev.
 *  - Lidere sor: soru `buildBrief(..., { ask: true })` ile lidere gider (Pano'nun
 *    "Ekibe yaz"ıyla aynı yol); cevap liderin terminalindedir, burada UYDURULMAZ.
 *  - Günlük bütçe kadranı: `budget`. Limit yoksa boş kadran + ayar bağlantısı.
 *  - Ajan etkinliği: `GET /api/usage/history` turlarından ajan × gün token
 *    toplamı (son 7 gün, yerel gün). Kayıt başlangıcından öncesi bilinemez.
 *  - Son devirler: görevler, en yenisi üstte.
 *  - Delegasyon ağı: görevlerin `assignedBy → assignedTo` kenarları. Süren iş
 *    (running) akar; izin bekleyen ajanın kenarı kehribar.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AgentSnapshot, BudgetState, Task, UsageTurn } from '../types';
import { api } from '../api';
import { buildBrief } from '../brief';
import { fmtCost, fmtNum, totalTokens } from '../format';
import { L, dateLocale } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  budget: BudgetState | null;
  sentence: string;
  onOpenAgent: (id: string) => void;
  onOpenSettings: () => void;
}

const LEAD_ROLES = new Set(['boss', 'manager', 'team-leader']);
const DAYS = 7;
const HEAT_ROWS = 8;
const HANDOFF_ROWS = 5;
const DAY_MS = 86_400_000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2);
  return s.toLocaleUpperCase(dateLocale);
}

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function turnTokens(t: UsageTurn): number {
  return t.inputTokens + t.outputTokens + t.cacheCreationTokens + t.cacheReadTokens;
}

/* ─────────────────────────────────────────────── bütçe kadranı */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** `bare`: Pano widget'ı olarak çizilir (kart çerçevesi ve başlık Pano'nun). */
export function BudgetDial({
  budget,
  onOpenSettings,
  bare = false,
}: {
  budget: BudgetState | null;
  onOpenSettings: () => void;
  bare?: boolean;
}) {
  const limited = !!budget?.limitUSD;
  const pct = limited ? Math.min(100, Math.max(0, budget!.pct ?? 0)) : 0;
  const a1 = Math.PI + Math.PI * (pct / 100);
  const tone = budget?.exceeded ? 'crit' : budget?.warn ? 'warn' : '';
  const ticks = Array.from({ length: 11 }, (_, i) => Math.PI + (Math.PI * i) / 10);
  return (
    <button type="button" className={`${bare ? 'gl-bare' : 'gl-card'} gl-gauge ${tone}`} onClick={onOpenSettings}>
      {!bare && (
        <span className="gl-head">
          <span className="gl-ic" aria-hidden="true">$</span>
          {L.survey.glBudget}
        </span>
      )}
      <svg viewBox="0 0 200 112" className="gl-dial" role="img" aria-label={L.survey.glBudgetAria(Math.round(pct))}>
        <path d={arc(100, 100, 84, Math.PI, 2 * Math.PI - 0.0001)} className="gl-dial-track" />
        {limited && pct > 0 && <path d={arc(100, 100, 84, Math.PI, a1)} className="gl-dial-val" />}
        {ticks.map((a, i) => (
          <circle key={i} cx={100 + 70 * Math.cos(a)} cy={100 + 70 * Math.sin(a)} r="1.4" className="gl-dial-tick" />
        ))}
        {limited && (
          <line x1="100" y1="100" x2={100 + 60 * Math.cos(a1)} y2={100 + 60 * Math.sin(a1)} className="gl-dial-needle" />
        )}
        <circle cx="100" cy="100" r="6" className="gl-dial-hub" />
      </svg>
      <span className="gl-gauge-row">
        <span className="gl-big">{limited ? L.extra.pct(Math.round(pct)) : fmtCost(budget?.spentUSD ?? 0)}</span>
        <span className="gl-chip">
          {limited
            ? `${fmtCost(budget!.spentUSD)} / $${budget!.limitUSD!.toFixed(2)}`
            : L.survey.glNoLimit}
        </span>
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────── lidere sor */
function AskLead({
  lead,
  agents,
  onOpenAgent,
}: {
  lead: AgentSnapshot | undefined;
  agents: AgentSnapshot[];
  onOpenAgent: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text || !lead || state === 'sending') return;
    setState('sending');
    try {
      await api.sendMessage(lead.config.id, buildBrief(text, lead, agents, { ask: true }));
      setQ('');
      setState('sent');
    } catch {
      setState('error');
    }
  }

  const live = lead?.currentActivity;
  return (
    <section className="gl-card gl-dark gl-ask" aria-label={L.survey.glAsk}>
      <span className="gl-head gl-head-c">{L.survey.glAsk}</span>
      <span className="gl-orb" aria-hidden="true" />
      <span className="gl-ask-who">{lead ? lead.config.name : L.survey.noTeam}</span>
      <span className="gl-ask-msg" aria-live="polite">
        {state === 'sent'
          ? L.survey.glAskSent
          : state === 'error'
            ? L.survey.glAskError
            : live || L.survey.glAskIdle}
      </span>
      {state === 'sent' && lead ? (
        <button type="button" className="gl-ask-open" onClick={() => onOpenAgent(lead.config.id)}>
          {L.survey.glOpenTerminal}
        </button>
      ) : null}
      <form className="gl-ask-in" onSubmit={submit}>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (state !== 'idle' && state !== 'sending') setState('idle');
          }}
          placeholder={L.survey.glAskPh}
          aria-label={L.survey.glAsk}
          disabled={!lead}
        />
        <button type="submit" className="primary" disabled={!lead || !q.trim() || state === 'sending'} aria-label={L.common.send}>
          →
        </button>
      </form>
    </section>
  );
}

/* ─────────────────────────────────────────────── etkinlik ısı haritası */
export function Heatmap({
  agents,
  turns,
  since,
  bare = false,
}: {
  agents: AgentSnapshot[];
  turns: UsageTurn[] | null;
  since: number | null;
  bare?: boolean;
}) {
  const today = dayStart(Date.now());
  const days = Array.from({ length: DAYS }, (_, i) => today - (DAYS - 1 - i) * DAY_MS);

  const { rows, max } = useMemo(() => {
    const per = new Map<string, number[]>();
    for (const t of turns ?? []) {
      const idx = Math.round((dayStart(t.ts) - days[0]) / DAY_MS);
      if (idx < 0 || idx >= DAYS) continue;
      const arr = per.get(t.agentId) ?? Array(DAYS).fill(0);
      arr[idx] += turnTokens(t);
      per.set(t.agentId, arr);
    }
    const list = [...per.entries()]
      .map(([id, vals]) => ({ id, vals, sum: vals.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, HEAT_ROWS);
    const m = Math.max(1, ...list.flatMap((r) => r.vals));
    return { rows: list, max: m };
    // days[0] gün değişince değişir; today bağımlılığı yeterli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, today]);

  const name = (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id;
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)));
  const dayLabel = (ms: number) => new Date(ms).toLocaleDateString(dateLocale, { weekday: 'short' });
  const partial = since !== null && since > days[0];

  return (
    <section className={`${bare ? 'gl-bare' : 'gl-card'} gl-heat`} aria-label={L.survey.glHeat}>
      <span className="gl-head">
        {!bare && (
          <>
            <span className="gl-ic" aria-hidden="true">▦</span>
            {L.survey.glHeat}
          </>
        )}
        <span className="gl-legend" aria-hidden="true">
          {L.survey.glLess}
          {[1, 2, 3, 4].map((l) => (
            <i key={l} className={`gl-cell l${l}`} />
          ))}
          {L.survey.glMore}
        </span>
      </span>
      {turns === null ? (
        <span className="gl-empty">{L.extra.reading}</span>
      ) : rows.length === 0 ? (
        <span className="gl-empty">{L.survey.glHeatEmpty}</span>
      ) : (
        <div className="gl-heat-grid" style={{ gridTemplateColumns: `minmax(96px, auto) repeat(${DAYS}, 1fr)` }}>
          <span />
          {days.map((d) => (
            <span key={d} className="gl-day">
              {dayLabel(d)}
            </span>
          ))}
          {rows.map((r) => (
            <div key={r.id} className="gl-heat-row" role="row">
              <span className="gl-lab" title={name(r.id)}>
                {name(r.id)}
              </span>
              {r.vals.map((v, i) => (
                <i
                  key={i}
                  className={`gl-cell l${level(v)}`}
                  title={`${name(r.id)} · ${dayLabel(days[i])}: ${fmtNum(v)} tok`}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {partial && <span className="gl-note">{L.survey.glHeatSince(new Date(since!).toLocaleDateString(dateLocale))}</span>}
    </section>
  );
}

/* ─────────────────────────────────────────────── son devirler */
function Handoffs({ agents, tasks }: { agents: AgentSnapshot[]; tasks: Task[] }) {
  const name = (id: string) =>
    id === 'user' ? L.survey.pxYou : (agents.find((a) => a.config.id === id)?.config.name ?? id);
  const recent = [...tasks]
    .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
    .slice(0, HANDOFF_ROWS);
  return (
    <section className="gl-card gl-handoffs" aria-label={L.survey.glHandoffs}>
      <span className="gl-head">
        <span className="gl-ic" aria-hidden="true">✓</span>
        {L.survey.glHandoffs}
      </span>
      {recent.length ? (
        <ol className="gl-rows">
          {recent.map((t) => (
            <li key={t.id} className="gl-row">
              <span className="gl-row-t" title={t.title}>
                {t.title}
              </span>
              <span className="gl-row-s">
                {name(t.assignedBy)} → {name(t.assignedTo)}
              </span>
              <span className={`gl-pill s-${t.status}`}>{L.taskStatus[t.status] ?? t.status}</span>
            </li>
          ))}
        </ol>
      ) : (
        <span className="gl-empty">{L.survey.pxEmpty}</span>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────── delegasyon ağı */
interface NetNode {
  id: string;
  depth: number;
  x: number;
  y: number;
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

export function DelegationNet({
  agents,
  tasks,
  lead,
  onOpenAgent,
  bare = false,
}: {
  agents: AgentSnapshot[];
  tasks: Task[];
  lead: AgentSnapshot | undefined;
  onOpenAgent: (id: string) => void;
  bare?: boolean;
}) {
  const byId = new Map(agents.map((a) => [a.config.id, a]));

  const { nodes, edges, W, H } = useMemo(() => {
    // Kenarlar: kullanıcıdan gelen iş kenar değil (lider zaten kök).
    const em = new Map<string, { from: string; to: string; live: boolean; n: number }>();
    for (const t of tasks) {
      if (t.assignedBy === 'user' || !byId.has(t.assignedBy) || !byId.has(t.assignedTo)) continue;
      if (t.assignedBy === t.assignedTo) continue;
      const k = `${t.assignedBy}>${t.assignedTo}`;
      const e = em.get(k) ?? { from: t.assignedBy, to: t.assignedTo, live: false, n: 0 };
      e.n++;
      if (t.status === 'running') e.live = true;
      em.set(k, e);
    }
    const es = [...em.values()];

    // Derinlik: kökten (gelen kenarı olmayan) en uzun yol, döngüye karşı sınırlı.
    const ids = new Set<string>();
    for (const e of es) {
      ids.add(e.from);
      ids.add(e.to);
    }
    if (lead) ids.add(lead.config.id);
    const depth = new Map<string, number>([...ids].map((id) => [id, 0]));
    for (let pass = 0; pass < ids.size; pass++) {
      let changed = false;
      for (const e of es) {
        const d = (depth.get(e.from) ?? 0) + 1;
        if (d > (depth.get(e.to) ?? 0) && d < 6) {
          depth.set(e.to, d);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const cols = new Map<number, string[]>();
    for (const [id, d] of depth) cols.set(d, [...(cols.get(d) ?? []), id]);
    const maxDepth = Math.max(0, ...cols.keys());
    const tallest = Math.max(1, ...[...cols.values()].map((c) => c.length));
    const w = Math.max(520, 180 + maxDepth * 210);
    const h = Math.max(170, 40 + tallest * 120);
    const ns: NetNode[] = [];
    for (const [d, list] of cols) {
      list.sort((a, b) => (byId.get(a)?.config.name ?? a).localeCompare(byId.get(b)?.config.name ?? b, dateLocale));
      list.forEach((id, i) => {
        const x = maxDepth === 0 ? w / 2 : 70 + (d * (w - 200)) / maxDepth;
        const y = ((i + 1) * h) / (list.length + 1) - 16;
        ns.push({ id, depth: d, x, y });
      });
    }
    return { nodes: ns, edges: es, W: w, H: h };
    // byId her render yeni Map; içerik agents'tan türer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, agents, lead?.config.id]);

  const pos = new Map(nodes.map((n) => [n.id, n]));
  const R = 24;

  return (
    <section className={`${bare ? 'gl-bare' : 'gl-card'} gl-net`} aria-label={L.survey.glNet}>
      {bare ? (
        edges.length > 0 && <span className="gl-note">{L.survey.glNetHint}</span>
      ) : (
      <span className="gl-head">
        <span className="gl-ic" aria-hidden="true">
          {/* Altıgen glifi Sora'da yok (ölçüldü: "O" çiziliyordu); SVG. */}
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4">
            <polygon points="6,0.8 10.6,3.4 10.6,8.6 6,11.2 1.4,8.6 1.4,3.4" />
          </svg>
        </span>
        {L.survey.glNet}
        <span className="gl-sp">{edges.length ? L.survey.glNetHint : ''}</span>
      </span>
      )}
      <div className="gl-net-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.survey.glNet} style={{ minWidth: Math.min(W, 520), maxWidth: W }}>
          {edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const waiting = (byId.get(e.to)?.pendingPermissions.length ?? 0) > 0;
            const sx = a.x + R;
            const ex = b.x - R;
            const mx = (sx + ex) / 2;
            return (
              <path
                key={`${e.from}>${e.to}`}
                className={`gl-edge${e.live ? ' live' : ''}${waiting ? ' wait' : ''}`}
                d={`M${sx} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${ex} ${b.y}`}
              />
            );
          })}
          {nodes.map((n) => {
            const ag = byId.get(n.id);
            if (!ag) return null;
            const st =
              ag.pendingPermissions.length > 0 ? 'wait' : ag.status === 'working' ? 'busy' : ag.status === 'offline' ? 'off' : 'on';
            return (
              <g
                key={n.id}
                className={`gl-node ${st}`}
                role="button"
                tabIndex={0}
                aria-label={`${ag.config.name}: ${L.status[ag.status] ?? ag.status}`}
                onClick={() => onOpenAgent(n.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenAgent(n.id);
                  }
                }}
              >
                <polygon points={hexPoints(n.x, n.y, R)} className="gl-hex" />
                <text x={n.x} y={n.y} className="gl-ini">
                  {initials(ag.config.name)}
                </text>
                <text x={n.x} y={n.y + R + 15} className="gl-nlab">
                  {ag.config.name}
                </text>
                <text x={n.x} y={n.y + R + 29} className="gl-nsub">
                  {L.status[ag.status] ?? ag.status} · {fmtNum(totalTokens(ag.usage))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {!edges.length && <span className="gl-empty">{L.survey.glNetEmpty}</span>}
    </section>
  );
}

/* ─────────────────────────────────────────────── tur geçmişi */
/** `GET /api/usage/history`, 30 sn'de bir. Genel Durum ve Pano ortak kullanır. */
export function useUsageHistory(): { turns: UsageTurn[]; since: number } | null {
  const [hist, setHist] = useState<{ turns: UsageTurn[]; since: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .usageHistory()
        .then((h) => alive && setHist({ turns: h.turns, since: h.since }))
        .catch(() => alive && setHist((p) => p ?? { turns: [], since: Date.now() }));
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return hist;
}

/** Liderin kendisi: boss → manager → takım lideri, yoksa ilk ajan. */
export function findLead(agents: AgentSnapshot[]): AgentSnapshot | undefined {
  return agents.find((a) => LEAD_ROLES.has(a.config.role)) ?? agents[0];
}

/* ─────────────────────────────────────────────── gövde */
export function GlassOverview({ agents, tasks, budget, sentence, onOpenAgent, onOpenSettings }: Props) {
  const hist = useUsageHistory();
  const working = agents.filter((a) => a.status === 'working').length;
  const open = tasks.filter((t) => t.status === 'running' || t.status === 'pending').length;
  const lead = findLead(agents);

  return (
    <div className="gl">
      <section className="gl-card gl-dark gl-hero" aria-label={L.survey.glHeroAria}>
        <h2 className="gl-title">{sentence}</h2>
        <div className="gl-stats">
          <div className="gl-stat">
            <small>{L.survey.glWorking}</small>
            <strong>
              {working}
              <em>/ {agents.length}</em>
            </strong>
          </div>
          <div className="gl-stat">
            <small>{L.survey.glSpent}</small>
            <strong>{budget ? fmtCost(budget.spentUSD) : '—'}</strong>
          </div>
          <div className="gl-stat">
            <small>{L.survey.glOpenTasks}</small>
            <strong>{open}</strong>
          </div>
        </div>
      </section>
      <AskLead lead={lead} agents={agents} onOpenAgent={onOpenAgent} />
      <BudgetDial budget={budget} onOpenSettings={onOpenSettings} />
      <Heatmap agents={agents} turns={hist?.turns ?? null} since={hist?.since ?? null} />
      <Handoffs agents={agents} tasks={tasks} />
      <DelegationNet agents={agents} tasks={tasks} lead={lead} onOpenAgent={onOpenAgent} />
    </div>
  );
}
