/**
 * Tasarım stili ve renk modu.
 *
 *  · `glass`       — Cam (varsayılan, 2026-11-25): buzlu kartlar, ayrık paneller.
 *  · `observatory` — Gözlemevi, gök plakası (index.css'in kendisi).
 *  · `studio`      — Stüdyo, sade SaaS yüzeyi.
 *  · `phosphor`    — Fosfor, gece yarısı ürün sayfası (limon ışık).
 *
 * Her stilin bir AÇIK, bir KOYU paleti var (`STYLE_PALETTES`). Kullanıcı stili
 * ve modu seçer; palet ikisinden türer, ayrıca seçilmez. Mod stil BAŞINA
 * hatırlanır (`claudiva.mode` = { stil: mod }): Gözlemevi'ni koyu, Cam'ı açık
 * kullanan biri stil değiştirince ikisi de kendi modunda açılır. Kayıt yoksa
 * stilin doğal modu (`NATURAL_MODE`).
 *
 * `data-style` ve `data-theme` <html>'e yazılır. İlk boyamadan önce
 * `index.html`'deki satır içi betik uygular (React'e bırakılırsa bir kare
 * eski görünüm çizilir). Buradaki tablolar ile o betikteki tablolar AYNI
 * olmalı: DEFAULT_STYLE, STYLE_PALETTES, NATURAL_MODE.
 */
import { useSyncExternalStore } from 'react';
import { L } from './i18n';
import { getTheme, setTheme } from './themes';

export type AppStyle = 'glass' | 'observatory' | 'studio' | 'phosphor';
export type ColorMode = 'light' | 'dark';

export const APP_STYLES: { id: AppStyle; label: string; desc: string }[] = [
  { id: 'glass', label: L.appStyle.glass, desc: L.appStyle.glassDesc },
  { id: 'observatory', label: L.appStyle.observatory, desc: L.appStyle.observatoryDesc },
  { id: 'studio', label: L.appStyle.studio, desc: L.appStyle.studioDesc },
  { id: 'phosphor', label: L.appStyle.phosphor, desc: L.appStyle.phosphorDesc },
];

/** Stil × mod → palet. index.html'deki satır içi betikle AYNI olmalı. */
export const STYLE_PALETTES: Record<AppStyle, Record<ColorMode, string>> = {
  glass: { light: 'mist', dark: 'grove' },
  observatory: { light: 'tide', dark: 'obsidian' },
  studio: { light: 'paper', dark: 'graphite' },
  phosphor: { light: 'lumen', dark: 'phosphor' },
};

/** Kayıt yokken stilin açıldığı mod. index.html'deki betikle AYNI olmalı. */
export const NATURAL_MODE: Record<AppStyle, ColorMode> = {
  glass: 'light',
  observatory: 'dark',
  studio: 'light',
  phosphor: 'dark',
};

const STYLE_KEY = 'claudiva.style';
const MODE_KEY = 'claudiva.mode';
export const DEFAULT_STYLE: AppStyle = 'glass';

function isKnown(v: string | null): v is AppStyle {
  return v === 'glass' || v === 'observatory' || v === 'studio' || v === 'phosphor';
}

function loadStyle(): AppStyle {
  try {
    const saved = localStorage.getItem(STYLE_KEY);
    if (isKnown(saved)) return saved;
  } catch {
    // Gizli sekmede localStorage kapalı olabilir; varsayılan yeterli.
  }
  return DEFAULT_STYLE;
}

function loadModes(): Partial<Record<AppStyle, ColorMode>> {
  try {
    const raw = JSON.parse(localStorage.getItem(MODE_KEY) || '{}');
    const out: Partial<Record<AppStyle, ColorMode>> = {};
    for (const s of APP_STYLES) {
      const m = raw?.[s.id];
      if (m === 'light' || m === 'dark') out[s.id] = m;
    }
    return out;
  } catch {
    return {};
  }
}

let current: AppStyle = loadStyle();
let modes = loadModes();
const listeners = new Set<() => void>();

export function getAppStyle(): AppStyle {
  return current;
}

export function modeFor(style: AppStyle): ColorMode {
  return modes[style] ?? NATURAL_MODE[style];
}

export function getColorMode(): ColorMode {
  return modeFor(current);
}

export function paletteFor(style: AppStyle, mode: ColorMode = modeFor(style)): string {
  return STYLE_PALETTES[style][mode];
}

/** Palet stil + moddan türer; uymuyorsa ona çekilir. */
function syncPalette(): void {
  const want = paletteFor(current);
  if (getTheme() !== want) setTheme(want);
}

// Açılışta: eski bir palet kaydı (ör. Karbon) kalmışsa stil + modun paletine çek.
syncPalette();

function emit(): void {
  for (const l of listeners) l();
}

export function setAppStyle(style: AppStyle): void {
  if (!isKnown(style) || style === current) return;
  current = style;
  document.documentElement.dataset.style = style;
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    /* yukarıdaki gerekçe */
  }
  syncPalette();
  emit();
}

export function setColorMode(mode: ColorMode): void {
  if (mode !== 'light' && mode !== 'dark') return;
  if (modeFor(current) === mode) return;
  modes = { ...modes, [current]: mode };
  try {
    localStorage.setItem(MODE_KEY, JSON.stringify(modes));
  } catch {
    /* yukarıdaki gerekçe */
  }
  syncPalette();
  emit();
}

export function toggleColorMode(): void {
  setColorMode(getColorMode() === 'light' ? 'dark' : 'light');
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppStyle(): AppStyle {
  return useSyncExternalStore(subscribe, getAppStyle);
}

export function useColorMode(): ColorMode {
  return useSyncExternalStore(subscribe, getColorMode);
}
