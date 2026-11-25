import { L } from './i18n';
/**
 * Plaka kayıt defteri.
 *
 * Renkler burada DURMAZ — onlar themes.css'te token olarak yaşar. Burası
 * yalnızca "hangi plakalar var, nasıl adlandırılır" sorusunu yanıtlar.
 *
 * İki aile var ve ikisi farklı bir şeyi taklit eder.
 *
 * PLAKALAR — bir gözlem koşulu. Kağıt, mürekkep, tane:
 *   · Gece          — karanlık odada saatlerce açık duran plaka
 *   · Gündüz        — aydınlık odada okunan basılı plaka
 *
 * PREMIUM — işlenmiş bir yüzey. Cam ve anodize metal, mürekkep değil ışık:
 *   · Obsidyen — mürekkep siyahı, cyan (varsayılan)
 *   · Karbon   — anodize grafit, buz cyanı
 *   · Aurora   — menekşeli siyah, cyan vurgu
 *
 * Varsayılan Obsidyen'dir. Kırmızı Fener (`redlight`) 2026-11-25'te kullanıcı
 * isteğiyle kaldırıldı; kayıtlı seçimi olan Obsidyen'e düşer (`isKnown` +
 * index.html satır içi betiği).
 *
 * Yeni plaka: themes.css'e bir blok + buraya bir satır + scripts/contrast.mjs
 * içindeki `plates` dizisine bir satır. Kontrast ÖLÇÜLÜR:
 * fg ≥7, muted ≥4.5, dim/accent/err/ok/warn/aux ≥3.
 */

export type ThemeGroup = 'Plakalar' | 'Premium' | 'Stüdyo' | 'Fosfor';

export interface ThemeDef {
  id: string;
  name: string;
  /** Seçici kartında tek satırlık karakter tarifi. */
  desc: string;
  group: ThemeGroup;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'night',
    name: L.themes.night.name,
    desc: L.themes.night.desc,
    group: 'Plakalar',
  },
  {
    id: 'day',
    name: L.themes.day.name,
    desc: L.themes.day.desc,
    group: 'Plakalar',
  },

  // --- Premium baskılar: işlenmiş yüzey, soğuk vurgu (bkz. themes.css) ---
  {
    id: 'obsidian',
    name: L.themes.obsidian.name,
    desc: L.themes.obsidian.desc,
    group: 'Premium',
  },
  {
    id: 'carbon',
    name: L.themes.carbon.name,
    desc: L.themes.carbon.desc,
    group: 'Premium',
  },
  {
    id: 'aurora',
    name: L.themes.aurora.name,
    desc: L.themes.aurora.desc,
    group: 'Premium',
  },

  // --- Stüdyo paletleri: nötr ürün yüzeyi (bkz. themes.css, styles.css) ---
  {
    id: 'paper',
    name: L.themes.paper.name,
    desc: L.themes.paper.desc,
    group: 'Stüdyo',
  },
  {
    id: 'graphite',
    name: L.themes.graphite.name,
    desc: L.themes.graphite.desc,
    group: 'Stüdyo',
  },

  // --- Fosfor paleti: grafit-siyah + limon (bkz. styles.css "FOSFOR") ---
  {
    id: 'phosphor',
    name: L.themes.phosphor.name,
    desc: L.themes.phosphor.desc,
    group: 'Fosfor',
  },
];

/** Grup sırası — seçicide bu düzende listelenir. */
export const THEME_GROUPS: ThemeGroup[] = ['Premium', 'Plakalar', 'Stüdyo', 'Fosfor'];

export const DEFAULT_THEME = 'obsidian';
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
