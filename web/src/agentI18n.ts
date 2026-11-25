import { locale } from './i18n';
import type { AgentConfig, AgentSnapshot } from './types';

/**
 * Paket ajanlarının adını/açıklamasını arayüz diline çevirir.
 *
 * Store'a girerken BİR KEZ uygulanır (`useStore.refreshAgents`); panelin 75
 * gösterim yeri `config.name` okumaya devam eder. Kural: alan paketin `tr`
 * değerine hâlâ eşitse (kullanıcı değiştirmediyse) ve hedef dilde karşılığı
 * varsa o gösterilir. Kullanıcının kendi verdiği ad her dilde aynı kalır.
 *
 * Disk hep `tr` değerini taşır: form kaydederken `delocalize` gösterilen
 * çeviriyi paket değerine geri çevirir. Yoksa İngilizce arayüzde formu açıp
 * kapatmak adı diske İngilizce yazar, Türkçeye dönünce çeviri bir daha
 * tutmazdı (ad artık `tr` değerine eşit değil).
 */
type Key = 'name' | 'description';

function translated(cfg: AgentConfig, key: Key): string | undefined {
  const t = cfg.i18n;
  if (!t || locale === 'tr') return undefined;
  if (cfg[key] !== t.tr?.[key]) return undefined;
  return t[locale]?.[key];
}

export function localizeAgent(a: AgentSnapshot): AgentSnapshot {
  const name = translated(a.config, 'name');
  const description = translated(a.config, 'description');
  if (name === undefined && description === undefined) return a;
  return {
    ...a,
    config: { ...a.config, ...(name !== undefined && { name }), ...(description !== undefined && { description }) },
  };
}

/** Formdan gelen değer gösterilen çeviriyse paketin `tr` değerine döner. */
export function delocalize(cfg: AgentConfig, key: Key, value: string): string {
  const t = cfg.i18n;
  if (!t || locale === 'tr') return value;
  const shown = t[locale]?.[key];
  return shown !== undefined && value === shown && t.tr?.[key] !== undefined ? t.tr[key]! : value;
}
