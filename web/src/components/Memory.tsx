import { useEffect, useMemo, useState } from 'react';
import type { MemoryNode } from '../types';
import { api } from '../api';
import { L } from '../i18n';

/**
 * Ajan hafıza haritası — memory/<ajanId|shared>/*.md düğümleri, `[[link]]`
 * kenarları. Ajana göre kümelenir; ara, ajana tıkla-süz, düğüme tıkla-içerik.
 * graphify'ın düğüm/[[link]] modeliyle aynı; grafik zaten dosyalarda açık
 * olduğundan çalışma anında AI/işlem gerekmez.
 */

const AGENT_COLORS = ['var(--accent)', 'var(--purple)', 'var(--green)', 'var(--yellow)', 'var(--red)', 'var(--cli)', 'var(--aux)'];

interface Positioned extends MemoryNode {
  x: number;
  y: number;
  color: string;
}

const W = 1000;
const H = 680;

function computeLayout(nodes: MemoryNode[]) {
  const cx = W / 2;
  const cy = H / 2;
  const agentIds = [...new Set(nodes.map((n) => n.agentId))];
  const others = agentIds.filter((a) => a !== 'shared');
  const colorOf = (a: string) =>
    a === 'shared' ? 'var(--muted)' : AGENT_COLORS[Math.max(0, others.indexOf(a)) % AGENT_COLORS.length];

  const centers: Record<string, { x: number; y: number }> = {};
  if (agentIds.includes('shared')) centers['shared'] = { x: cx, y: cy };
  const R = Math.min(W, H) * 0.34;
  others.forEach((a, i) => {
    const ang = (i / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
    centers[a] = { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R };
  });

  const byAgent: Record<string, MemoryNode[]> = {};
  for (const n of nodes) (byAgent[n.agentId] ??= []).push(n);

  const positioned: Positioned[] = [];
  for (const [a, list] of Object.entries(byAgent)) {
    const c = centers[a] ?? { x: cx, y: cy };
    const rr = list.length === 1 ? 0 : 34 + list.length * 7;
    list.forEach((n, i) => {
      const ang = (i / list.length) * Math.PI * 2;
      positioned.push({ ...n, x: c.x + Math.cos(ang) * rr, y: c.y + Math.sin(ang) * rr, color: colorOf(a) });
    });
  }

  const bySlug = new Map<string, Positioned>();
  const byName = new Map<string, Positioned>();
  for (const p of positioned) {
    bySlug.set(p.slug.toLowerCase(), p);
    byName.set(p.name.toLowerCase(), p);
  }
  const edges: { from: Positioned; to: Positioned }[] = [];
  for (const p of positioned)
    for (const link of p.links) {
      const t = bySlug.get(link.toLowerCase()) ?? byName.get(link.toLowerCase());
      if (t && t.id !== p.id) edges.push({ from: p, to: t });
    }

  const agents = agentIds
    .map((a) => ({ id: a, count: (byAgent[a] ?? []).length, color: colorOf(a) }))
    .sort((x, y) => y.count - x.count);

  return { positioned, edges, agents };
}

export function Memory() {
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.getMemory();
      setNodes(r.nodes);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const { positioned, edges, agents } = useMemo(() => computeLayout(nodes), [nodes]);
  const selNode = positioned.find((n) => n.id === selected) ?? null;

  const q = query.trim().toLowerCase();
  const matches = (n: Positioned) =>
    !q || n.name.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.type.toLowerCase().includes(q);
  const dimmed = (n: Positioned) =>
    (!!activeAgent && n.agentId !== activeAgent && n.agentId !== 'shared') || !matches(n);

  return (
    <div className="mem">
      <div className="mem-head">
        <div>
          <h2 className="mem-title">{L.memory.title}</h2>
          <span className="mem-sub">
            {L.extra.memorySub(nodes.length, edges.length)}<code>[[link]]</code>{L.extra.memoryEdges}
          </span>
        </div>
        <div className="spacer" />
        <input
          className="mem-search"
          placeholder={L.memory.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="mem-refresh" onClick={() => void load()} disabled={loading} title={L.extra.reload}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />
          </svg>
          Yenile
        </button>
      </div>

      {err && <div className="mem-note err">{L.extra.memoryErr(err)}</div>}

      {!loading && nodes.length === 0 && !err && (
        <div className="mem-empty">
          <h3>{L.memory.emptyTitle}</h3>
          <p>
            {L.memory.emptyA}<code>save-memory</code>{L.memory.emptyB}<strong>{L.memory.refresh}</strong>{L.memory.emptyC}
          </p>
        </div>
      )}

      {nodes.length > 0 && (
        <div className="mem-body">
          <div className="mem-canvas">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={L.memory.graphAria}>
              {edges.map((e, i) => (
                <line
                  key={i}
                  x1={e.from.x}
                  y1={e.from.y}
                  x2={e.to.x}
                  y2={e.to.y}
                  className="mem-edge"
                  opacity={dimmed(e.from) && dimmed(e.to) ? 0.06 : 0.35}
                />
              ))}
              {positioned.map((n) => (
                <g
                  key={n.id}
                  className="mem-node"
                  transform={`translate(${n.x} ${n.y})`}
                  opacity={dimmed(n) ? 0.18 : 1}
                  onClick={() => setSelected(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={selected === n.id ? 9 : 6.5} fill={n.color} className={selected === n.id ? 'sel' : ''} />
                  <text x={0} y={-11} textAnchor="middle" className="mem-node-label">
                    {n.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <aside className="mem-side">
            <div className="mem-legend">
              <div className="mem-legend-title">{L.memory.legend}</div>
              {agents.map((a) => (
                <button
                  key={a.id}
                  className={`mem-legend-row${activeAgent === a.id ? ' active' : ''}`}
                  onClick={() => setActiveAgent(activeAgent === a.id ? null : a.id)}
                >
                  <span className="mem-dot" style={{ background: a.color }} />
                  <span className="mem-legend-name">{a.id}</span>
                  <span className="mem-legend-count">{a.count}</span>
                </button>
              ))}
            </div>

            {selNode ? (
              <div className="mem-detail">
                <div className="mem-detail-head">
                  <span className="mem-dot" style={{ background: selNode.color }} />
                  <strong>{selNode.name}</strong>
                  {/* Çizilmiş ikon — unicode "×" glifi değil; ikon dili her yerde aynı. */}
                  <button className="mem-detail-x" onClick={() => setSelected(null)} title={L.extra.close} aria-label={L.extra.close}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="mem-detail-meta">
                  {selNode.agentId} · {selNode.type}
                </div>
                <pre className="mem-detail-body">{selNode.content}</pre>
              </div>
            ) : (
              <div className="mem-detail muted">{L.memory.pickNode}</div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
