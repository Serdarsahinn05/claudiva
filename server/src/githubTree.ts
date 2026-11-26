/**
 * Bir GitHub deposunun dosya ağacı — kotayı en az harcayan tek okuma yolu.
 *
 * Kimlik doğrulamasız GitHub API sınırı saatte 60 istek ve IP BAŞINA
 * (her Claudiva kendi makinesinden ister; ortak bir havuz yok). Sorun ortak
 * IP'de çıkar: aynı ofis ağı ya da mobil operatörün ortak IP'si (CGNAT)
 * arkasındaki herkes aynı 60'ı paylaşır. Bu yüzden:
 *
 * - Ağaç `git/trees/<ref>?recursive=1` ile TEK istekte okunur.
 * - **Taze önbellek hiç sorulmaz** (`FRESH_MS`, 10 dk): tarama → kurulum ve
 *   art arda "Yenile" aynı ağacı ister. Sabit commit'e (40 haneli sha) bağlı
 *   ağaç değişemez, süresiz kullanılır.
 * - **ETag TEK BAŞINA KOTA KURTARMAZ** (ölçüldü 2026-11-26): kimlik
 *   doğrulamasız istekte 304 yanıtı da kotadan düşüyor (22 → 21 → 20).
 *   GitHub'ın "304 sayılmaz" kuralı yalnız token'lı istek için. ETag yine
 *   gönderilir (gövde inmez, bant genişliği), ama asıl kazanç süre.
 * - Dosyaların kendisi `raw.githubusercontent.com`dan iner (kotasız); kurulum
 *   bu sayede API'ye dizin başına istek atmaz (bkz. `installFromGitHub`).
 *
 * Önbellek bellekte + diskte (`DATA_DIR/cache/gh-trees`): sunucu yeniden
 * açılınca da koşullu istek yapılabilsin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';
import { S } from './i18n.js';

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | string;
  size?: number;
}

export interface RepoTree {
  entries: TreeEntry[];
  /** GitHub çok büyük ağaçları kesiyor; liste eksik demektir. */
  truncated: boolean;
}

interface Cached extends RepoTree {
  etag: string;
  /** Son doğrulama (200 ya da 304) zamanı. */
  checkedAt: number;
}

/** Bu süre içinde okunmuş ağaç yeniden SORULMAZ (kota). */
const FRESH_MS = 10 * 60 * 1000;
const isCommit = (ref: string) => /^[0-9a-f]{40}$/i.test(ref);

const CACHE_DIR = path.join(DATA_DIR, 'cache', 'gh-trees');
const memory = new Map<string, Cached>();

const keyOf = (repo: string, ref: string) => `${repo}@${ref}`;
const fileOf = (key: string) => path.join(CACHE_DIR, key.replace(/[^\w.@-]+/g, '__') + '.json');

function readDisk(key: string): Cached | null {
  try {
    const raw = JSON.parse(fs.readFileSync(fileOf(key), 'utf-8')) as Cached;
    if (raw && typeof raw.etag === 'string' && Array.isArray(raw.entries)) return raw;
  } catch {
    // yok ya da bozuk
  }
  return null;
}

function writeDisk(key: string, c: Cached): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(fileOf(key), JSON.stringify(c), 'utf-8');
  } catch {
    // önbellek yazılamazsa da ağaç döner; yalnız sonraki istek koşullu olmaz
  }
}

export async function repoTree(repo: string, ref = 'HEAD'): Promise<RepoTree> {
  const key = keyOf(repo, ref);
  const cached = memory.get(key) ?? readDisk(key);
  if (cached && (isCommit(ref) || Date.now() - (cached.checkedAt ?? 0) < FRESH_MS)) {
    memory.set(key, cached);
    return cached;
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'claudiva',
        ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
      },
    },
  );

  if (res.status === 304 && cached) {
    cached.checkedAt = Date.now();
    memory.set(key, cached);
    writeDisk(key, cached);
    return cached;
  }
  if (res.status === 403 || res.status === 429) {
    // Kota dolu ama elde eski ağaç varsa onu kullan: çoğu depo saatler içinde
    // değişmez, "biraz bekle" demekten iyidir.
    if (cached) return cached;
    throw new Error(S.githubRateLimit);
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}`);

  const body = (await res.json()) as { tree?: TreeEntry[]; truncated?: boolean };
  const fresh: Cached = {
    etag: res.headers.get('etag') ?? '',
    entries: (body.tree ?? []).map((e) => ({ path: e.path, type: e.type, size: e.size })),
    truncated: Boolean(body.truncated),
    checkedAt: Date.now(),
  };
  memory.set(key, fresh);
  writeDisk(key, fresh);
  return fresh;
}

/** Kotasız ham dosya adresi. */
export function rawUrl(repo: string, ref: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${filePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
