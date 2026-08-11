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
    id: 'phosphor',
    name: 'Fosfor CRT',
    desc: 'Yeşil tüp, tarama çizgisi, taşan bloom',
    group: 'Özel',
  },
  {
    id: 'blueprint',
    name: 'Teknik Çizim',
    desc: 'Ozalit mavisi, iç içe ızgara, keskin köşe',
    group: 'Özel',
  },
  {
    id: 'synthwave',
    name: 'Sinyal',
    desc: 'Menekşe ufuk, neon pembe-camgöbeği, ızgara',
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
  {
    id: 'geist',
    name: 'Geist',
    desc: 'Vercel; saf siyah, kıl payı kenar, efekt yok',
    group: 'Sitelerden',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    desc: 'Açık tema; indigo yıkama, geniş yumuşak gölge',
    group: 'Sitelerden',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    desc: 'Kömür siyahı, asit yeşili, çok yuvarlak köşe',
    group: 'Sitelerden',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    desc: 'Grayscale gövde, kehribar durum, keskin köşe',
    group: 'Sitelerden',
  },
  {
    id: 'grok',
    name: 'Grok',
    desc: 'Kehribar vurgu, nokta-matris doku, yuvarlak köşe',
    group: 'Sitelerden',
  },
  { id: 'tokyo-night', name: 'Tokyo Night', desc: 'Gece mavisi, yumuşak indigo', group: 'Geliştirici paletleri' },
  { id: 'catppuccin', name: 'Catppuccin', desc: 'Mocha; pastel lavanta ve şeftali', group: 'Geliştirici paletleri' },
  { id: 'gruvbox', name: 'Gruvbox', desc: 'Retro toprak tonları, hardal sarısı', group: 'Geliştirici paletleri' },
  { id: 'nord', name: 'Nord', desc: 'Kuzey buzulu; soğuk gri-mavi', group: 'Geliştirici paletleri' },
  { id: 'dracula', name: 'Dracula', desc: 'Mor ve pembe ikilisi, gece mavisi zemin', group: 'Geliştirici paletleri' },
  { id: 'solarized', name: 'Solarized Dark', desc: 'Camgöbeği zemin, ölçülmüş düşük kontrast', group: 'Geliştirici paletleri' },
  { id: 'everforest', name: 'Everforest', desc: 'Sakin orman yeşili, sıcak kum metin', group: 'Geliştirici paletleri' },
  { id: 'monokai', name: 'Monokai', desc: 'Limon yeşili ve macenta, yüksek kontrast', group: 'Geliştirici paletleri' },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', desc: 'Açık tema; yumuşak gül ve çam', group: 'Geliştirici paletleri' },
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

/** index.css'teki --t-theme ile aynı olmalı. */
const SHIFT_MS = 300;
let shiftTimer: number | undefined;

export function setTheme(id: string): void {
  const theme = isKnown(id) ? id : DEFAULT_THEME;
  const root = document.documentElement;

  // Renkler normalde anında sıçrar. `theme-shifting` geçici olarak her
  // yüzeye bir renk geçişi verir, böylece tema yumuşak soluyarak değişir.
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
