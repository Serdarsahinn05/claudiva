/**
 * Proje dosyalarını okuma — Kod panelinin veri kaynağı.
 *
 * `changes.ts` "ne değişti"yi, `git.ts` "nasıl değişti"yi biliyor; bu modül
 * üçüncü soruyu yanıtlıyor: **dosya şu an ne durumda**. Ajanlar dosyaları
 * değiştirip commit'lediğinde fark listesinden düşüyorlar ama kod duruyor;
 * ayrıca ajanın okuyup değiştirmediği dosyalar hiçbir listede görünmüyordu.
 *
 * GÜVENLİK: her yol `safeResolve` ile PROJECT_DIR'a hapsedilir (git.ts ile aynı
 * kapı). Panel yalnızca OKUR — yazma ucu bilerek yok; dosyayı değiştiren tek
 * özne ajanın kendisi ve o da izin kapısından geçiyor.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_DIR } from './paths.js';
import { safeResolve } from './git.js';
import { iconFor } from './fileIcons.js';

/** Ağaçta hiç gösterilmeyen dizinler: gürültü ya da devasa. */
const HIDDEN_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
]);

/**
 * Okunabilir kabul edilen üst sınır. Daha büyüğü panelde zaten okunmaz ve
 * tarayıcıyı kilitler; kırpmak yerine reddedip boyutu söylemek dürüst.
 */
const MAX_FILE_BYTES = 1_000_000;

/** İlk bu kadar baytta NUL varsa ikili sayılır. */
const SNIFF_BYTES = 8000;

export interface TreeEntry {
  /** Proje köküne göreli, ileri eğik çizgili. */
  path: string;
  name: string;
  kind: 'dir' | 'file';
  /** Yalnızca dosyalarda. */
  size?: number;
  /**
   * Çözülmüş ikon adı (`react_ts`, `rust`, `folder-src`). Ağaç yanıtına
   * burada iliştiriliyor çünkü eşleme tablosu 450 KB ve sunucuda kalmalı
   * (bkz. fileIcons.ts); panel adı alıp `/api/file-icon/<ad>.svg` istiyor.
   * Paket kurulu değilse tanımsız — panel ikonsuz çizer.
   */
  icon?: string;
  /** Klasörün AÇIK hâlinin ikonu; panel dalı açınca buna geçer. */
  iconOpen?: string;
}

/**
 * Tek bir dizinin içeriği. Ağaç TEMBEL: alt dizinler açıldıkça istenir.
 * Bütün ağacı bir kerede yollamak büyük depolarda hem yavaş hem gereksiz —
 * kullanıcı aynı anda tek bir dalı okuyor.
 */
export async function listDir(relPath: string): Promise<TreeEntry[]> {
  const abs = safeResolve(relPath || '.');
  if (!abs) throw new Error('Yol proje dizininin dışında.');

  const entries = await fs.readdir(abs, { withFileTypes: true });
  const out: TreeEntry[] = [];

  for (const e of entries) {
    if (e.isDirectory() && HIDDEN_DIRS.has(e.name)) continue;
    // Nokta dosyaları gösterilir (.claudiva, .env.example okunmak istenir),
    // yalnızca yukarıdaki devasa/gürültülü dizinler elenir.
    const rel = path
      .relative(path.resolve(PROJECT_DIR), path.join(abs, e.name))
      .replace(/\\/g, '/');

    if (e.isDirectory()) {
      out.push({
        path: rel,
        name: e.name,
        kind: 'dir',
        icon: iconFor(e.name, 'dir'),
        iconOpen: iconFor(e.name, 'dir', true),
      });
    } else if (e.isFile()) {
      let size: number | undefined;
      try {
        size = (await fs.stat(path.join(abs, e.name))).size;
      } catch {
        // yarışta silinmiş olabilir; boyutsuz göster
      }
      out.push({ path: rel, name: e.name, kind: 'file', size, icon: iconFor(e.name, 'file') });
    }
  }

  // Dizinler önce, sonra ada göre (yerelleştirilmiş sıralama Türkçe için).
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'tr');
  });
  return out;
}

export interface FileContent {
  path: string;
  size: number;
  /** İkili dosyada boş; `binary` true olur. */
  text: string;
  binary: boolean;
  /** Boyut sınırını aştıysa içerik gelmez. */
  tooLarge: boolean;
  lines: number;
}

export async function readFile(relPath: string): Promise<FileContent> {
  const abs = safeResolve(relPath);
  if (!abs) throw new Error('Yol proje dizininin dışında.');

  const st = await fs.stat(abs);
  if (!st.isFile()) throw new Error('Bu bir dosya değil.');

  const base: FileContent = {
    path: relPath.replace(/\\/g, '/'),
    size: st.size,
    text: '',
    binary: false,
    tooLarge: false,
    lines: 0,
  };

  if (st.size > MAX_FILE_BYTES) return { ...base, tooLarge: true };

  const buf = await fs.readFile(abs);
  // İkili tespiti: metin dosyasında NUL bulunmaz. Uzantıya bakmak yanıltıcı
  // (uzantısız betikler metin, .dat bazen metin) — içeriğe bakmak kesin.
  if (buf.subarray(0, SNIFF_BYTES).includes(0)) return { ...base, binary: true };

  const text = buf.toString('utf-8');
  return { ...base, text, lines: text.length ? text.split('\n').length : 0 };
}
