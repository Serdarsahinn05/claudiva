/**
 * Proje dizini üzerinde ince git sarmalayıcıları.
 *
 * Ajanlar doğrudan PROJECT_DIR içinde çalışıyor; bu modül "ne değişti, nasıl
 * değişti, geri al" sorularının tek yanıt yeri.
 *
 * execFile kullanılır, exec DEĞİL: argümanlar dizi olarak geçtiği için kabuk
 * devreye girmez, dolayısıyla boşluklu/özel karakterli dosya adları enjeksiyon
 * riski taşımaz.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { PROJECT_DIR } from './paths.js';

const run = promisify(execFile);

/** Büyük fark çıktısı paneli boğmasın. */
const MAX_DIFF_BYTES = 400_000;

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

export interface ChangedFile {
  /** PROJECT_DIR'a göreli, ileri eğik çizgili yol. */
  path: string;
  status: ChangeStatus;
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await run('git', args, {
    cwd: PROJECT_DIR,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

export async function isRepo(): Promise<boolean> {
  try {
    const out = await git(['rev-parse', '--is-inside-work-tree']);
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

export async function headSha(): Promise<string | null> {
  try {
    return (await git(['rev-parse', '--short', 'HEAD'])).trim();
  } catch {
    // Henüz commit yok (yeni depo) — HEAD çözülemez.
    return null;
  }
}

/** porcelain kodunu okunur bir duruma çevirir. */
function toStatus(code: string): ChangeStatus {
  if (code === '??') return 'untracked';
  // İki karakter: [index][worktree]. Herhangi birinde D varsa silinmiş sayılır.
  if (code.includes('D')) return 'deleted';
  if (code.includes('R')) return 'renamed';
  if (code.includes('A')) return 'added';
  return 'modified';
}

/**
 * Çalışma ağacındaki tüm değişiklikler.
 *
 * `-z` ile NUL ayraçlı okunur: boşluklu ve Türkçe karakterli yollar tırnak
 * kaçışına uğramadan gelir (git aksi hâlde "core.quotePath" ile bozar).
 */
export async function changedFiles(): Promise<ChangedFile[]> {
  const out = await git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const parts = out.split('\0');
  const files: ChangedFile[] = [];

  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (!entry) continue;
    const code = entry.slice(0, 2);
    let file = entry.slice(3);
    // Yeniden adlandırmada hedef ve kaynak iki ayrı NUL parçası olarak gelir.
    if (code.includes('R')) {
      i += 1; // kaynak yolu atla, hedefi gösteriyoruz
    }
    if (!file) continue;
    files.push({ path: file.replace(/\\/g, '/'), status: toStatus(code) });
  }
  return files;
}

/** Verilen yolun PROJECT_DIR içinde kaldığını doğrular; dışarıysa null. */
export function safeResolve(relPath: string): string | null {
  const abs = path.resolve(PROJECT_DIR, relPath);
  const root = path.resolve(PROJECT_DIR);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

/**
 * Tek bir dosyanın son commit'e göre farkı.
 *
 * İzlenmeyen (untracked) dosyanın HEAD'de karşılığı yok; `--no-index` ile boş
 * dosyaya karşı diff alınır, böylece yeni dosya da tamamen "+" satırları olarak
 * görünür.
 */
export async function diffFile(relPath: string): Promise<string> {
  const tracked = await isTracked(relPath);
  let out: string;
  if (tracked) {
    out = await git(['diff', 'HEAD', '--', relPath]);
  } else {
    try {
      out = await git(['diff', '--no-index', '--', devNull(), relPath]);
    } catch (e) {
      // --no-index fark bulunca çıkış kodu 1 verir; stdout yine doludur.
      out = (e as { stdout?: string }).stdout ?? '';
    }
  }
  if (out.length > MAX_DIFF_BYTES) {
    return out.slice(0, MAX_DIFF_BYTES) + '\n… (fark çok uzun, kırpıldı)';
  }
  return out;
}

function devNull(): string {
  return process.platform === 'win32' ? 'NUL' : '/dev/null';
}

async function isTracked(relPath: string): Promise<boolean> {
  try {
    const out = await git(['ls-files', '--error-unmatch', '--', relPath]);
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Dosyayı son commit'teki hâline döndürür.
 *
 * DİKKAT: bu, commit'lenmemiş çalışmayı kalıcı olarak siler. Çağıran taraf
 * kullanıcıdan onay almak zorunda.
 */
export async function revertFile(relPath: string): Promise<void> {
  if (await isTracked(relPath)) {
    await git(['checkout', 'HEAD', '--', relPath]);
    return;
  }
  // İzlenmeyen dosyanın "eski hâli" yok; geri almak = silmek.
  const abs = safeResolve(relPath);
  if (!abs) throw new Error('Yol proje dizininin dışında.');
  const fs = await import('node:fs');
  fs.rmSync(abs, { force: true });
}
