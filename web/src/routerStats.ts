/**
 * JEV yönlendiricisinin ölçülmüş etkisi (saf modül, React yok).
 *
 * Tasarruf UYDURMA bir yüzde değil, gerçek turlardan hesaplanır: yönlendirilmiş
 * bir görevin turlarının (usage-history, `taskId`) GERÇEK maliyeti alınır ve
 * aynı tokenların ajanın temel modelinde ne tutacağı ölçülmüş fiyat oranıyla
 * bulunur. Oran (server/scripts/measure-router.mjs B, 2026-11-24): aynı önekte
 * token başına Sonnet 6.0e-6 $, Haiku 2.0e-6 $ → 3:1. Opus için ölçüm YOK;
 * Opus'a giden ya da temeli Opus olan görevler tasarrufa katılmaz ve panel
 * bunu açıkça söyler.
 *
 * Yükseltme (temel Haiku → görev Sonnet) eksi tasarruftur, olduğu gibi düşülür.
 * Sınıflandırıcı çağrılarının maliyeti de ayrıca çıkarılır: net = brüt − çağrı.
 */
import type { AgentSnapshot, Task, UsageTurn } from './types';

/** Ölçülmüş göreli fiyat (haiku = 1). Bilinmeyen model → hesap dışı. */
const PRICE: Record<string, number> = { haiku: 1, sonnet: 3 };

function family(model: string): string | null {
  const m = model.toLowerCase();
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  return null;
}

export interface RouterStats {
  routed: number;
  /** Modele göre görev sayısı (route.model ailesi). */
  byModel: Record<string, number>;
  byWho: Record<'rule' | 'classifier' | 'default', number>;
  byApplied: Record<'opened' | 'switched' | 'escalated' | 'kept', number>;
  classifierCalls: number;
  classifierCostUSD: number;
  /** Ölçülmüş oranla hesaplanan brüt tasarruf (eksi olabilir). */
  grossSavingUSD: number;
  netSavingUSD: number;
  /** Tasarrufa katılan görevlerin gerçek maliyeti. */
  measuredCostUSD: number;
  /** Opus vb. ölçülmemiş oran yüzünden hesaba katılmayan görev sayısı. */
  unpriced: number;
  /** Son kararlar (yeniden eskiye). */
  recent: Task[];
}

export function routerStats(tasks: Task[], turns: UsageTurn[], agents: AgentSnapshot[]): RouterStats {
  const base = new Map(agents.map((a) => [a.config.id, a.config.model]));
  const costByTask = new Map<string, number>();
  for (const t of turns) if (t.taskId) costByTask.set(t.taskId, (costByTask.get(t.taskId) ?? 0) + t.costUSD);

  const s: RouterStats = {
    routed: 0,
    byModel: {},
    byWho: { rule: 0, classifier: 0, default: 0 },
    byApplied: { opened: 0, switched: 0, escalated: 0, kept: 0 },
    classifierCalls: 0,
    classifierCostUSD: 0,
    grossSavingUSD: 0,
    netSavingUSD: 0,
    measuredCostUSD: 0,
    unpriced: 0,
    recent: [],
  };

  const routed = tasks.filter((t) => t.route);
  for (const t of routed) {
    const r = t.route!;
    s.routed++;
    const fam = family(r.model) ?? r.model;
    s.byModel[fam] = (s.byModel[fam] ?? 0) + 1;
    s.byWho[r.by]++;
    s.byApplied[r.applied]++;
    if (r.classifierCostUSD !== undefined) {
      s.classifierCalls++;
      s.classifierCostUSD += r.classifierCostUSD;
    }

    const actual = costByTask.get(t.id);
    if (actual === undefined) continue; // turu henüz yok ya da kayıttan önce
    const ran = family(r.model);
    const would = family(base.get(t.assignedTo) ?? '');
    if (!ran || !would) {
      s.unpriced++;
      continue;
    }
    s.measuredCostUSD += actual;
    s.grossSavingUSD += actual * (PRICE[would] / PRICE[ran] - 1);
  }
  s.netSavingUSD = s.grossSavingUSD - s.classifierCostUSD;
  s.recent = routed
    .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
    .slice(0, 6);
  return s;
}
