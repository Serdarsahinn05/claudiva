/**
 * Tasarım stili: renkten AYRI eksen (bkz. styles.css).
 *
 *  · `observatory` — Gözlemevi, gök plakası (varsayılan; index.css'in kendisi).
 *  · `studio`      — Stüdyo, sade SaaS yüzeyi.
 *  · `phosphor`    — Fosfor, gece yarısı ürün sayfası (limon ışık).
 *
 * `data-style` <html>'e yazılır. İlk boyamadan önce `index.html`'deki satır
 * içi betik uygular (tema ile aynı sebep: React'e bırakılırsa bir kare eski
 * stil görünür). Buradaki DEFAULT_STYLE ile o betikteki yedek ad AYNI olmalı.
 *
 * Stil ve palet TEK yerden seçilir: Görünüm menüsü (ThemePicker). Önce
 * Ayarlar'da ayrı bir stil seçicisi vardı ve iki menü birbirinin üstüne
 * yazıyordu (Stüdyo + Obsidyen gibi yarım karışımlar). Artık her stilin kendi
 * palet grupları var (`STYLE_GROUPS`); Görünüm yalnız onları gösterir, stil
 * değişince ya da açılışta uyumsuz bir kayıt bulunursa palet stilin
 * varsayılanına çekilir. Aynı kural `index.html`deki satır içi betikte de var
 * (ilk karede yanlış palet görünmesin).
 */
import { useSyncExternalStore } from 'react';
import { L } from './i18n';
import { DEFAULT_THEME, getTheme, setTheme } from './themes';

export type AppStyle = 'observatory' | 'studio' | 'phosphor';

export const APP_STYLES: { id: AppStyle; label: string; desc: string }[] = [
  { id: 'observatory', label: L.appStyle.observatory, desc: L.appStyle.observatoryDesc },
  { id: 'studio', label: L.appStyle.studio, desc: L.appStyle.studioDesc },
  { id: 'phosphor', label: L.appStyle.phosphor, desc: L.appStyle.phosphorDesc },
];

const STORAGE_KEY = 'claudiva.style';
export const DEFAULT_STYLE: AppStyle = 'observatory';

function isKnown(v: string | null): v is AppStyle {
  return v === 'observatory' || v === 'studio' || v === 'phosphor';
}

function load(): AppStyle {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isKnown(saved)) return saved;
  } catch {
    // Gizli sekmede localStorage kapalı olabilir; varsayılan yeterli.
  }
  return DEFAULT_STYLE;
}

let current: AppStyle = load();
const listeners = new Set<() => void>();

export function getAppStyle(): AppStyle {
  return current;
}

/** Stilin TEK paleti. index.html'deki satır içi betikle AYNI olmalı. */
export const STYLE_DEFAULT_THEME: Record<AppStyle, string> = {
  observatory: DEFAULT_THEME,
  studio: 'paper',
  phosphor: 'phosphor',
};

/** Palet stilden türer: stilin paleti değilse ona çekilir. */
function syncPalette(style: AppStyle): void {
  if (getTheme() !== STYLE_DEFAULT_THEME[style]) setTheme(STYLE_DEFAULT_THEME[style]);
}

// Açılışta: eski bir palet kaydı (ör. Karbon) kalmışsa stilin paletine çek.
syncPalette(current);

export function setAppStyle(style: AppStyle): void {
  if (!isKnown(style) || style === current) return;
  current = style;
  document.documentElement.dataset.style = style;
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    /* yukarıdaki gerekçe */
  }

  syncPalette(style);

  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppStyle(): AppStyle {
  return useSyncExternalStore(subscribe, getAppStyle);
}
