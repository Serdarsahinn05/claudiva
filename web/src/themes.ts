import { L } from './i18n';
/**
 * Palet kayıt defteri. 2026-11-25 akşamından beri her stilin bir AÇIK, bir
 * KOYU paleti var; palet stil + moddan türer (appStyle.ts STYLE_PALETTES).
 *
 * Kullanıcı kararı: yalnız renk değiştiren paletler (Gece, Gündüz, Karbon,
 * Aurora, Grafit, Kırmızı Fener) kaldırıldı; "yeni tema" yeni STİL demektir
 * (styles.css + appStyle.ts). Palet stilden türer, ayrıca seçilmez:
 *   Gözlemevi → obsidian · Stüdyo → paper · Fosfor → phosphor
 * Kayıtlı eski bir palet açılışta stilin paletine düşer (index.html betiği +
 * appStyle.ts syncPalette, ikisi AYNI kural). Renkler themes.css'te; kontrast
 * scripts/contrast.mjs ile ÖLÇÜLÜR.
 */

export type ThemeGroup = 'Premium' | 'Stüdyo' | 'Fosfor' | 'Cam';

export interface ThemeDef {
  id: string;
  name: string;
  /** Seçici kartında tek satırlık karakter tarifi. */
  desc: string;
  group: ThemeGroup;
}

export const THEMES: ThemeDef[] = [

  // --- Premium baskılar: işlenmiş yüzey, soğuk vurgu (bkz. themes.css) ---
  {
    id: 'obsidian',
    name: L.themes.obsidian.name,
    desc: L.themes.obsidian.desc,
    group: 'Premium',
  },

  // --- Stüdyo paletleri: nötr ürün yüzeyi (bkz. themes.css, styles.css) ---
  {
    id: 'paper',
    name: L.themes.paper.name,
    desc: L.themes.paper.desc,
    group: 'Stüdyo',
  },

  // --- Fosfor paleti: grafit-siyah + limon (bkz. styles.css "FOSFOR") ---
  {
    id: 'phosphor',
    name: L.themes.phosphor.name,
    desc: L.themes.phosphor.desc,
    group: 'Fosfor',
  },

  // --- Açık/koyu mod paletleri (2026-11-25; stil × mod, bkz. appStyle.ts) ---
  { id: 'tide', name: L.themes.tide.name, desc: L.themes.tide.desc, group: 'Premium' },
  { id: 'graphite', name: L.themes.graphite.name, desc: L.themes.graphite.desc, group: 'Stüdyo' },
  { id: 'lumen', name: L.themes.lumen.name, desc: L.themes.lumen.desc, group: 'Fosfor' },
  { id: 'mist', name: L.themes.mist.name, desc: L.themes.mist.desc, group: 'Cam' },
  { id: 'grove', name: L.themes.grove.name, desc: L.themes.grove.desc, group: 'Cam' },
];

/** Grup sırası — seçicide bu düzende listelenir. */
export const THEME_GROUPS: ThemeGroup[] = ['Cam', 'Premium', 'Stüdyo', 'Fosfor'];

/** Varsayılan stil Cam, doğal modu açık → mist. index.html betiğiyle AYNI. */
export const DEFAULT_THEME = 'mist';
const STORAGE_KEY = 'claudiva.theme';

function isKnown(id: string | null): id is string {
  return !!id && THEMES.some((t) => t.id === id);
}

export function getTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isKnown(saved)) return saved;
  } catch {
    // localStorage kapalı olabilir (gizli sekme, sıkı gizlilik ayarı) —
    // plaka kaybı önemli değil, uygulama çalışmaya devam etmeli.
  }
  return DEFAULT_THEME;
}

/** index.css'teki --t-theme ile aynı olmalı. */
const SHIFT_MS = 320;
let shiftTimer: number | undefined;

export function setTheme(id: string): void {
  const theme = isKnown(id) ? id : DEFAULT_THEME;
  const root = document.documentElement;

  // Renkler normalde anında sıçrar. `theme-shifting` geçici olarak her
  // yüzeye bir renk geçişi verir, böylece plaka yumuşak soluyarak değişir.
  // Kalıcı bırakılamaz: o zaman her hover da gecikmeli hissedilirdi.
  root.classList.add('theme-shifting');
  window.clearTimeout(shiftTimer);
  shiftTimer = window.setTimeout(() => root.classList.remove('theme-shifting'), SHIFT_MS);

  root.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* yukarıdaki gerekçe */
  }
}
