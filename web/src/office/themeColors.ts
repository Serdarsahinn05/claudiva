/**
 * Tuval için tema renkleri.
 *
 * Canvas 2D bağlamı CSS değişkeni okuyamaz — `ctx.fillStyle = 'var(--fg)'`
 * sessizce yok sayılır. Bu yüzden kök öğeden hesaplanmış değerleri bir kez
 * okuyup gerçek renk dizesine çeviriyoruz.
 *
 * Ofisin piksel sanatı (duvar, mobilya, karakter) temadan bağımsız kalır;
 * yalnızca ANLAM taşıyan renkler — durum etiketleri, isim, zemin boşluğu —
 * temayı takip eder. Genel ton zaten CSS'teki `--cam-filter` ile veriliyor.
 */

export interface OfficeThemeColors {
  working: string;
  waiting: string;
  idle: string;
  offline: string;
  /** Döşeme dışında kalan boşluk. */
  void: string;
  /** Karakter ismi ve onun kontur rengi. */
  name: string;
  nameOutline: string;
}

/** data-theme okunamazsa kullanılan uzay aracı değerleri. */
const FALLBACK: OfficeThemeColors = {
  working: 'rgb(45 212 191)',
  waiting: 'rgb(240 169 43)',
  idle: 'rgb(63 214 127)',
  offline: 'rgb(70 86 106)',
  void: 'rgb(5 8 12)',
  name: 'rgb(219 228 238)',
  nameOutline: 'rgb(7 10 15)',
};

let cached: OfficeThemeColors = FALLBACK;
let cachedFor: string | null = null;

/** "45 212 191" → "rgb(45 212 191)". Boşsa yedeğe düşer. */
function channel(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const raw = style.getPropertyValue(name).trim();
  return raw ? `rgb(${raw})` : fallback;
}

/**
 * Aktif temanın tuval renkleri. Sonuç tema kimliğine göre önbelleklenir,
 * böylece her karede getComputedStyle çağrılmaz.
 */
export function officeThemeColors(): OfficeThemeColors {
  if (typeof document === 'undefined') return FALLBACK;
  const theme = document.documentElement.dataset.theme ?? 'spaceship';
  if (theme === cachedFor) return cached;

  const s = getComputedStyle(document.documentElement);
  cached = {
    working: channel(s, '--accent-rgb', FALLBACK.working),
    waiting: channel(s, '--warn-rgb', FALLBACK.waiting),
    idle: channel(s, '--ok-rgb', FALLBACK.idle),
    offline: channel(s, '--inert-rgb', FALLBACK.offline),
    void: channel(s, '--void-rgb', FALLBACK.void),
    name: channel(s, '--fg-rgb', FALLBACK.name),
    nameOutline: channel(s, '--bg-rgb', FALLBACK.nameOutline),
  };
  cachedFor = theme;
  return cached;
}
