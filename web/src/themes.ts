/**
 * Tema kayıt defteri.
 *
 * Renkler burada DURMAZ — onlar themes.css'te token olarak yaşar. Burası
 * yalnızca "hangi temalar var, nasıl adlandırılır, hangi grupta" sorusunu
 * yanıtlar. Yeni tema: themes.css'e bir blok + buraya bir satır.
 */

export type ThemeGroup = 'Sitelerden' | 'Geliştirici paletleri' | 'Özel';

export interface ThemeDef {
  id: string;
  name: string;
  /** Seçici kartında tek satırlık karakter tarifi. */
  desc: string;
  group: ThemeGroup;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'spaceship',
    name: 'Uzay Aracı',
    desc: 'Pahlı köşe, turkuaz HUD, ızgara doku',
    group: 'Özel',
  },
  {
    id: 'brutal',
    name: 'Neo-brutalism',
    desc: 'Açık zemin, kalın siyah kenar, sert gölge',
    group: 'Özel',
  },
  {
    id: 'claude-cli',
    name: 'Claude CLI',
    desc: 'Kömür zemin, mercan vurgu, baştan sona monospace',
    group: 'Sitelerden',
  },
  {
    id: 'aurora',
    name: 'Aurora Cam',
    desc: 'Buzlu cam yüzeyler, ışık lekeleri, geniş köşeler',
    group: 'Sitelerden',
  },
  {
    id: 'calm',
    name: 'Sade Karanlık',
    desc: 'Efekt yok, nötr vurgu, en sakin okuma',
    group: 'Sitelerden',
  },
  {
    id: 'editorial',
    name: 'Editöryel',
    desc: 'Kalın serif başlık, mor vurgu, dergi hissi',
    group: 'Sitelerden',
  },
  { id: 'tokyo-night', name: 'Tokyo Night', desc: 'Gece mavisi, yumuşak indigo', group: 'Geliştirici paletleri' },
  { id: 'catppuccin', name: 'Catppuccin', desc: 'Mocha; pastel lavanta ve şeftali', group: 'Geliştirici paletleri' },
  { id: 'gruvbox', name: 'Gruvbox', desc: 'Retro toprak tonları, hardal sarısı', group: 'Geliştirici paletleri' },
  { id: 'nord', name: 'Nord', desc: 'Kuzey buzulu; soğuk gri-mavi', group: 'Geliştirici paletleri' },
];

/** Grup sırası — seçicide bu düzende listelenir. */
export const THEME_GROUPS: ThemeGroup[] = ['Sitelerden', 'Geliştirici paletleri', 'Özel'];

export const DEFAULT_THEME = 'spaceship';
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
    // tema kaybı önemli değil, uygulama çalışmaya devam etmeli.
  }
  return DEFAULT_THEME;
}

export function setTheme(id: string): void {
  const theme = isKnown(id) ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* yukarıdaki gerekçe */
  }
}
