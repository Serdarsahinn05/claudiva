/**
 * Arayüz dili.
 *
 * Kütüphane YOK, bilerek. Sözlük düz bir nesne: `tr.ts` kaynak; diğer diller
 * `Dict` tipine bağlı, yani eksik ya da fazla anahtar DERLEMEYİ KIRAR (`npm run
 * build` → `tsc -b`). Parametreli metinler fonksiyondur (`L.chat.typing(ad)`);
 * parametre tipleri de denetlenir, `{name}` gibi yer tutucuların yazım hatası
 * çalışma anına kalmaz.
 *
 * Dil değişimi SAYFAYI YENİLER. Bu sayede `L` modül yüklenirken bir kez
 * çözülür ve her yerde düz bir sabit olarak okunur: modül seviyesindeki
 * etiket tabloları (rol, durum, panel adları) ve React dışı yardımcılar da
 * dili izler, her bileşene ayrı abonelik yazmak gerekmez. Dil nadiren
 * değişen bir tercih; tam yenilemenin bedeli buna değer.
 *
 * Ajan dili AYRI bir konudur (ajanlar kullanıcının yazdığı dilde cevap verir);
 * yalnız lidere giden ekip talimatı (`L.brief`) arayüz diliyle gider, yoksa
 * İngilizce isteğin altına Türkçe çerçeve eklenip cevap dili karışırdı.
 */
import { tr, type Dict } from './tr';
import { en } from './en';

export type Locale = 'tr' | 'en';

/** Dil seçicide görünen adlar: her dil KENDİ adıyla yazılır. */
export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' },
];

const DICTS: Record<Locale, Dict> = { tr, en };
const KEY = 'claudiva.locale';

function isLocale(v: unknown): v is Locale {
  return v === 'tr' || v === 'en';
}

/** Kayıtlı seçim; yoksa tarayıcı dili (Türkçe değilse İngilizce). */
function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* gizli sekme: tarayıcı diline düş */
  }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export const locale: Locale = detect();

/** Etkin sözlük. Sayfa ömrü boyunca sabit (bkz. dosya başı). */
export const L: Dict = DICTS[locale];

/** `toLocaleDateString` / `toLocaleTimeString` için dil etiketi. */
export const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-US';

export function setLocale(next: Locale): void {
  if (!isLocale(next) || next === locale) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    return; // kaydedilemiyorsa yenileme aynı dile döner, boşuna yenileme
  }
  location.reload();
}

export type { Dict };
