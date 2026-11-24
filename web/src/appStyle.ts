/**
 * Tasarım stili: renkten AYRI eksen (bkz. styles.css).
 *
 *  · `observatory` — Gözlemevi, gök plakası (varsayılan; index.css'in kendisi).
 *  · `studio`      — Stüdyo, sade SaaS yüzeyi.
 *
 * `data-style` <html>'e yazılır. İlk boyamadan önce `index.html`'deki satır
 * içi betik uygular (tema ile aynı sebep: React'e bırakılırsa bir kare eski
 * stil görünür). Buradaki DEFAULT_STYLE ile o betikteki yedek ad AYNI olmalı.
 *
 * Stil seçmek ona uyan paleti de uygular: Stüdyo gök plakasının mürekkep
 * renkleriyle yarım kalır, Gözlemevi de nötr paletle düz görünür. Kullanıcı
 * sonra Görünüm'den başka bir palet seçebilir; eşleştirme yalnızca stil
 * DEĞİŞTİĞİ anda ve palet o stile yabancıysa yapılır.
 */
import { useSyncExternalStore } from 'react';
import { L } from './i18n';
import { DEFAULT_THEME, THEMES, getTheme, setTheme } from './themes';

export type AppStyle = 'observatory' | 'studio';

export const APP_STYLES: { id: AppStyle; label: string; desc: string }[] = [
  { id: 'observatory', label: L.appStyle.observatory, desc: L.appStyle.observatoryDesc },
  { id: 'studio', label: L.appStyle.studio, desc: L.appStyle.studioDesc },
];

const STORAGE_KEY = 'claudiva.style';
export const DEFAULT_STYLE: AppStyle = 'observatory';

function isKnown(v: string | null): v is AppStyle {
  return v === 'observatory' || v === 'studio';
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

function isStudioPalette(id: string): boolean {
  return THEMES.find((t) => t.id === id)?.group === 'Stüdyo';
}

export function setAppStyle(style: AppStyle): void {
  if (!isKnown(style) || style === current) return;
  current = style;
  document.documentElement.dataset.style = style;
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    /* yukarıdaki gerekçe */
  }

  const theme = getTheme();
  if (style === 'studio' && !isStudioPalette(theme)) {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'graphite' : 'paper');
  } else if (style === 'observatory' && isStudioPalette(theme)) {
    setTheme(DEFAULT_THEME);
  }

  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppStyle(): AppStyle {
  return useSyncExternalStore(subscribe, getAppStyle);
}
