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
 *   · Kırmızı Fener — gece görüşünü bozmayan kırmızı monokrom
 *   · Gündüz        — aydınlık odada okunan basılı plaka
 *
 * PREMIUM — işlenmiş bir yüzey. Cam ve anodize metal, mürekkep değil ışık:
 *   · Obsidyen — mürekkep siyahı, cyan (varsayılan)
 *   · Karbon   — anodize grafit, buz cyanı
 *   · Aurora   — menekşeli siyah, cyan vurgu
 *
 * Varsayılan Obsidyen'dir. Plakalar kaldırılmadı ve kaldırılmamalı: gece
 * görüşü (Kırmızı Fener) ve aydınlık oda (Gündüz) hâlâ karşılanması gereken
 * gerçek koşullar, premium aile ikisini de karşılamıyor.
 *
 * Yeni plaka: themes.css'e bir blok + buraya bir satır + scripts/contrast.mjs
 * içindeki `plates` dizisine bir satır. Kontrast ÖLÇÜLÜR:
 * fg ≥7, muted ≥4.5, dim/accent/err/ok/warn/aux ≥3.
 */

export type ThemeGroup = 'Plakalar' | 'Premium';

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
    name: 'Gece',
    desc: 'Gece mürekkebi zemin, yıldız tozu metin, vermilyon ek açıklama',
    group: 'Plakalar',
  },
  {
    id: 'redlight',
    name: 'Kırmızı Fener',
    desc: 'Gözlemci feneri: kırmızı monokrom, karanlığa uyumu bozmaz',
    group: 'Plakalar',
  },
  {
    id: 'day',
    name: 'Gündüz',
    desc: 'Basılı plaka: kağıt zemin, siyah mürekkep, aydınlık oda',
    group: 'Plakalar',
  },

  // --- Premium baskılar: işlenmiş yüzey, soğuk vurgu (bkz. themes.css) ---
  {
    id: 'obsidian',
    name: 'Obsidyen',
    desc: 'Mürekkep siyahı obsidyen, tek soğuk kaynak: cyan',
    group: 'Premium',
  },
  {
    id: 'carbon',
    name: 'Karbon',
    desc: 'Anodize grafit gövde, buz cyanı — uzun oturum için nötr',
    group: 'Premium',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    desc: 'Menekşeli siyah, cyan vurgu; düşünme kanalı tonla ayrışır',
    group: 'Premium',
  },
];

/** Grup sırası — seçicide bu düzende listelenir. */
export const THEME_GROUPS: ThemeGroup[] = ['Premium', 'Plakalar'];

export const DEFAULT_THEME = 'obsidian';
const STORAGE_KEY = 'claude-manager.theme';

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
