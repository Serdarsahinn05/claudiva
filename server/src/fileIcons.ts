/**
 * Dosya/klasör ikonları — Material Icon Theme, SUNUCUDAN servis edilir.
 *
 * ── Neden pakete gömülmüyor (ölçülerek karar verildi) ────────────────────
 *
 * Bu panel genel amaçlı: yarın bambaşka bir projede açılacak ve orada Rust,
 * Elixir, Terraform, ne varsa çıkacak. Dolayısıyla "bu depoda hangi uzantılar
 * var" diye seçilmiş dar bir set yanlış çözüm.
 *
 * Tam set ölçüldü: 1250 ikon, ortalama 824 B, medyan 500 B, toplam ~1 MB.
 * Tarayıcı paketine koymak 1 MB demekti (uygulamanın tamamı 129 KB gzip).
 * Oysa ekranda aynı anda 30-60 satır duruyor ve çoğu aynı ikonu paylaşıyor.
 *
 * Bu yüzden ikonlar STATİK VARLIK gibi davranıyor: sunucu `node_modules`'tan
 * okuyup servis ediyor, tarayıcı yalnızca gördüklerini indiriyor ve ikon
 * adına göre önbelleğe alıyor (57 tane `.tsx` tek bir indirme).
 * **Tarayıcı paketine etkisi: 0 bayt.**
 *
 * ── Eşleme neden sunucuda ────────────────────────────────────────────────
 *
 * `material-icons.json` 450 KB (1378 uzantı + 2131 dosya adı + 4654 klasör
 * adı + 200 dil). Bunu tarayıcıya yollamak, kaçındığımız şişkinliği arka
 * kapıdan geri getirirdi. Sunucu bir kez okuyor ve çözülmüş ikon adını ağaç
 * yanıtına iliştiriyor — fazladan gidiş-dönüş de yok.
 *
 * Lisans: MIT (Material Extensions).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

interface IconMap {
  /** Uzantı → ikon adı ("tsx" → "react_ts"). Noktasız, küçük harf. */
  fileExtensions?: Record<string, string>;
  /** Tam dosya adı → ikon adı ("dockerfile" → "docker"). */
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  /** Açık renk temalar için ezmeler; aynı şeklin koyu çizgili sürümü. */
  light?: Omit<IconMap, 'light'>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
}

interface Loaded {
  map: IconMap;
  iconsDir: string;
}

let loaded: Loaded | null | undefined;

/**
 * Paketi TEMBEL ve HATAYA DAYANIKLI yükler.
 *
 * Paket kurulu değilse (ya da bir sonraki sürümde dosya düzeni değişirse)
 * sunucu ayakta kalır ve panel yalnızca ikonsuz çizer. Bir süs katmanı
 * yüzünden Kod panelinin tamamının çalışmaması kabul edilemez.
 */
function load(): Loaded | null {
  if (loaded !== undefined) return loaded;
  try {
    const jsonPath = require_.resolve('material-icon-theme/dist/material-icons.json');
    const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as IconMap;
    // dist/material-icons.json → ../icons
    const iconsDir = path.resolve(path.dirname(jsonPath), '..', 'icons');
    loaded = fs.existsSync(iconsDir) ? { map, iconsDir } : null;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Panel ikon gösterebilir mi? */
export function iconsAvailable(): boolean {
  return load() !== null;
}

/**
 * Bir girdi için ikon adını çözer.
 *
 * Sıra ÖNEMLİ ve VS Code'un kendi sırası: önce tam dosya adı, sonra uzantı.
 * `package.json` bu sayede jenerik "json" değil kendi ikonunu alıyor.
 * Uzantı ararken en uzun eşleşme denenir (`component.test.tsx` →
 * `test-tsx` varsa o, yoksa `tsx`).
 */
export function iconFor(name: string, kind: 'dir' | 'file', expanded = false): string | undefined {
  const l = load();
  if (!l) return undefined;
  const m = l.map;
  const lower = name.toLocaleLowerCase('en');

  if (kind === 'dir') {
    const table = expanded ? m.folderNamesExpanded : m.folderNames;
    return table?.[lower] ?? (expanded ? m.folderExpanded : m.folder) ?? 'folder';
  }

  const byName = m.fileNames?.[lower];
  if (byName) return byName;

  // "a.b.c" → "b.c" denenir, sonra "c": en uzun uzantı kazanır.
  const parts = lower.split('.');
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join('.');
    const hit = m.fileExtensions?.[ext];
    if (hit) return hit;
  }

  return m.file ?? 'file';
}

/** Yalnız bu desene uyan ad diskten okunabilir (yol kaçışına kapalı). */
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * İkon SVG'sini okur.
 *
 * Ad doğrudan dosya yoluna giriyor, o yüzden desen dar tutuldu ve ayraç
 * taşıyan hiçbir ad kabul edilmiyor — `..%2f` gibi denemeler daha eşleşmeden
 * düşüyor. Ayrıca çözülen yolun ikon dizininin altında kaldığı ikinci kez
 * doğrulanıyor (tek kapıya güvenmemek, `files.ts`/`git.ts` ile aynı ilke).
 */
export function readIcon(name: string, light = false): string | null {
  const l = load();
  if (!l || !SAFE_NAME.test(name)) return null;

  // Açık temada `_light` sürümü varsa o tercih edilir; yoksa normali.
  const candidates = light ? [`${name}_light.svg`, `${name}.svg`] : [`${name}.svg`];
  for (const file of candidates) {
    const abs = path.resolve(l.iconsDir, file);
    if (!abs.startsWith(l.iconsDir + path.sep)) continue;
    try {
      return fs.readFileSync(abs, 'utf-8');
    } catch {
      // sıradaki adaya geç
    }
  }
  return null;
}
