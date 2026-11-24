/**
 * JEV model yönlendiricisi: bir GÖREV ajana gitmeden önce hangi modelde
 * çalışacağına karar verir. (docs/SONRAKI-ISLER.md §2, ölçümler orada.)
 *
 * Neden mesaj değil GÖREV başına: prompt önbelleği modele özgü. Sıcak bir
 * oturumda modeli değiştirmek o modelde bütün öneki yeniden yazar — ölçüldü:
 * Sonnet'e bir turluk geçiş 39.491 token yazma, $0.237 ≈ 400 sınıflandırıcı.
 * Bu yüzden:
 *  · oturum KAPALI ya da SOĞUKSA model serbestçe seçilir (önbellek zaten
 *    yeniden yazılacak);
 *  · oturum SICAKSA yalnız YÜKSELTİLİR (kalite), asla düşürülmez.
 *
 * Karar sırası: kural katmanı (0 token) → emin değilse sınıflandırıcı (haiku,
 * ~$0.0006, ~2.3 sn) → o da yoksa ajanın temel modeli. Bu modül oturuma
 * DOKUNMAZ; kararı döndürür, uygulamayı AgentSession yapar.
 */
import type { TaskRoute } from '../types.js';
import { classifyByRules, type Tier } from './rules.js';
import { classify } from './classifier.js';

/** Son turdan bu kadar sonra önbellek soğumuş sayılır (varsayılan önbellek ömrü 5 dk). */
export const WARM_MS = 5 * 60 * 1000;

export interface RouteState {
  /** Ajanın temel modeli (config.model). */
  base: string;
  /** Oturumun şu anki modeli. */
  current: string;
  /** Oturum açık mı (backend var mı). */
  alive: boolean;
  /** Sürmekte olan bir tur var mı (varsa model değiştirilmez). */
  busy: boolean;
  /** Son turun bitiş zamanı (hiç tur yoksa undefined). */
  lastTurnAt?: number;
}

/** Model gücü sırası; tam model kimlikleri de (claude-sonnet-…) tanınır. */
export function rank(model: string): number {
  const m = model.toLowerCase();
  if (m.includes('haiku')) return 1;
  if (m.includes('opus')) return 3;
  return 2; // sonnet ve bilinmeyenler: orta
}

/**
 * Büyüklük → model. "Büyük" iş temel modelin ALTINA düşmez ama onun üstüne
 * de kendiliğinden çıkmaz: Opus yalnız temel modeli Opus olan ajanda. Ajan
 * iş beklenenden zor çıkarsa yine mcp__self__set_model ile yükselebilir.
 */
function modelFor(tier: Tier, base: string): string {
  if (tier === 'small') return 'haiku';
  if (tier === 'medium') return 'sonnet';
  return rank(base) >= 2 ? base : 'sonnet';
}

export async function routeTask(title: string, prompt: string, s: RouteState): Promise<TaskRoute> {
  const t0 = Date.now();
  // Oturum başka bir turun ortasında: model değişimi o turu yarıda başka
  // modele geçirirdi. Sınıflandırıcı da çağrılmaz (2.3 sn boşa beklenmesin).
  if (s.alive && s.busy) {
    return { model: s.current, by: 'default', why: 'oturum meşgul, model korundu', applied: 'kept', ms: 0 };
  }
  let tier: Tier | undefined;
  let by: TaskRoute['by'] = 'default';
  let why = 'kural emin değil, sınıflandırıcı cevap vermedi: temel model';
  let classifierCostUSD: number | undefined;

  const rule = classifyByRules(title, prompt);
  if (rule) {
    tier = rule.tier;
    by = 'rule';
    why = rule.why;
  } else if (!prompt.trimStart().startsWith('/')) {
    const c = await classify(title, prompt);
    if (c) {
      tier = c.tier;
      by = 'classifier';
      why = 'sınıflandırıcı';
      classifierCostUSD = c.costUSD;
    }
  }

  const target = tier ? modelFor(tier, s.base) : s.base;
  const warm = s.alive && s.lastTurnAt !== undefined && Date.now() - s.lastTurnAt < WARM_MS;

  let model = target;
  let applied: TaskRoute['applied'];
  if (!s.alive) applied = 'opened';
  else if (!warm) applied = target === s.current ? 'kept' : 'switched';
  else if (rank(target) > rank(s.current)) applied = 'escalated';
  else {
    // Sıcak oturumu ucuz modele düşürmek önbelleği çöpe atar: model korunur.
    model = s.current;
    applied = 'kept';
    if (target !== s.current) why += ` (sıcak oturum, ${target} yerine ${s.current} korundu)`;
  }

  return {
    model,
    ...(tier ? { tier } : {}),
    by,
    why,
    applied,
    ...(classifierCostUSD !== undefined ? { classifierCostUSD } : {}),
    ms: Date.now() - t0,
  };
}
