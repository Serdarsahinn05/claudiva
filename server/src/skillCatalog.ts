/**
 * Skill katalogu — kurulabilecek skill'leri ARAMAK için.
 *
 * `skills.ts` diskte NE VAR sorusunu yanıtlıyor; bu dosya "daha ne olabilirdi"
 * sorusunu. İkisi ayrı kalıyor çünkü biri dosya sistemi, diğeri ağ: birinin
 * hatası (GitHub erişilemiyor) diğerini çalışmaz hâle getirmemeli.
 *
 * ── Nasıl indeksleniyor (ölçülerek seçildi) ──────────────────────────────
 *
 * Contents API ile dizin dizin gezmek akla ilk gelen yol ve YANLIŞ: her dizin
 * bir istek, kimlik doğrulamasız sınır ise saatte 60. Üç depoluk bir katalog
 * bile sınırı ilk taramada bitirirdi.
 *
 * Bunun yerine depo başına TEK istek: `git/trees/HEAD?recursive=1` bütün dosya
 * listesini bir kerede veriyor, `SKILL.md` ile biten yollar oradan süzülüyor.
 * Ölçüldü: anthropics/skills 18, obra/superpowers 14, wshobson/agents 180
 * skill — üçü toplam 3 istek.
 *
 * Açıklamalar `raw.githubusercontent.com`dan geliyor ve orası API kotasına
 * yazılmıyor. Üstelik HTTP Range destekliyor (ölçüldü: 206 dönüyor), yani her
 * dosyanın yalnızca BAŞI çekiliyor — frontmatter zaten orada. 180 skill'in
 * tamamı için ~700KB yerine ~700KB'ın onda biri.
 *
 * Sonuç diske yazılıyor; panel her açılışta ağa çıkmıyor.
 */
import { S } from './i18n.js';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';
import { installFromGitHub, listSkills, parseFrontmatter, type SkillInfo, type SkillScope } from './skills.js';

const CATALOG_FILE = path.join(DATA_DIR, 'skill-catalog.json');
const SOURCES_FILE = path.join(DATA_DIR, 'skill-sources.json');

/** Frontmatter için çekilen baş parça. Uzun açıklamalar da sığsın diye 4KB. */
const HEAD_BYTES = 4096;
/** Aynı anda kaç ham dosya çekilsin — GitHub'ı da makineyi de yormayan bir sayı. */
const CONCURRENCY = 8;
/** Tek depodan alınacak en fazla skill; kaçak bir depo katalogu boğmasın. */
const MAX_PER_REPO = 400;

export interface CatalogSource {
  /** "sahip/depo" */
  repo: string;
  label: string;
  /** Yerleşik kaynaklar silinemez, yalnızca gizlenebilir. */
  builtin: boolean;
  /** Son taramada bu depodan kaç skill okundu. */
  count?: number;
  /** Son taramada hata olduysa metni; yoksa tanımsız. */
  error?: string;
}

export interface CatalogSkill {
  /** "repo:yol" — katalog içinde tekil. */
  id: string;
  name: string;
  description: string;
  repo: string;
  /** Depo içindeki dizin ("skills/pdf"). */
  skillPath: string;
  /** Kurulunca oluşacak dizin adı; "kurulu mu" bunun üzerinden bulunuyor. */
  folder: string;
}

interface CatalogFile {
  version: number;
  fetchedAt: number;
  sources: CatalogSource[];
  skills: CatalogSkill[];
}

/**
 * Yerleşik kaynaklar.
 *
 * Üçü de canlı olarak sınandı (`git/trees` yanıt verdi ve `SKILL.md` içeriyor).
 * Liste kısa tutuldu: katalog "internetteki her şey" değil, güvenilir bir
 * başlangıç noktası olmalı. Kullanıcı kendi deposunu ekleyebiliyor.
 */
const BUILTIN_SOURCES: CatalogSource[] = [
  { repo: 'anthropics/skills', label: 'Anthropic — resmî skill’ler', builtin: true },
  { repo: 'obra/superpowers', label: 'Superpowers', builtin: true },
  { repo: 'wshobson/agents', label: 'wshobson — large collection', builtin: true },
];

// ------------------------------------------------------------------ kaynaklar

interface SourcesFile {
  version: number;
  /** Kullanıcının eklediği depolar. */
  custom: { repo: string; label: string }[];
  /** Gizlenen yerleşik depolar. Silmek yerine gizlemek: geri açılabilsin. */
  hidden: string[];
}

function readSourcesFile(): SourcesFile {
  try {
    const raw = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8')) as SourcesFile;
    if (raw && Array.isArray(raw.custom) && Array.isArray(raw.hidden)) return raw;
  } catch {
    // yok ya da bozuk — varsayılana dön
  }
  return { version: 1, custom: [], hidden: [] };
}

function writeSourcesFile(f: SourcesFile): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(f, null, 2), 'utf-8');
}

export function listSources(): CatalogSource[] {
  const f = readSourcesFile();
  return [
    ...BUILTIN_SOURCES.filter((s) => !f.hidden.includes(s.repo)),
    ...f.custom.map((c) => ({ repo: c.repo, label: c.label, builtin: false })),
  ];
}

function assertRepo(repo: string): void {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(S.repoFormat);
}

export function addSource(repo: string, label?: string): CatalogSource[] {
  assertRepo(repo);
  const f = readSourcesFile();
  // Gizlenmiş bir yerleşik yeniden eklenmek isteniyorsa gizlemeyi kaldır.
  f.hidden = f.hidden.filter((h) => h !== repo);
  if (!BUILTIN_SOURCES.some((b) => b.repo === repo) && !f.custom.some((c) => c.repo === repo)) {
    f.custom.push({ repo, label: label?.trim() || repo });
  }
  writeSourcesFile(f);
  return listSources();
}

export function removeSource(repo: string): CatalogSource[] {
  const f = readSourcesFile();
  if (BUILTIN_SOURCES.some((b) => b.repo === repo)) {
    // Yerleşik SİLİNMEZ, gizlenir: kod değişmeden geri getirilebilsin.
    if (!f.hidden.includes(repo)) f.hidden.push(repo);
  } else {
    f.custom = f.custom.filter((c) => c.repo !== repo);
  }
  writeSourcesFile(f);
  return listSources();
}

// ------------------------------------------------------------------ tarama

interface TreeResponse {
  tree?: { path: string; type: string }[];
  truncated?: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'claudiva' },
  });
  if (res.status === 403 || res.status === 429) {
    // Kota mesajı özel: kullanıcı "bozuk" ile "biraz bekle"yi ayırabilmeli.
    throw new Error(S.githubRateLimit);
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Bir SKILL.md'nin BAŞINI çeker ve frontmatter'ı okur.
 *
 * Range ile kısmi indirme yapılıyor; sunucu Range'i yok sayarsa (200 döner)
 * sorun değil, elimizde tam dosya olur ve yine çalışır. Frontmatter kapanışı
 * çekilen parçada bulunamazsa açıklama boş kalır — bu bir hata değil, yalnızca
 * o skill'in başlığı çok uzun demektir; ad her hâlükârda dizin adından geliyor.
 */
async function readHead(repo: string, filePath: string): Promise<{ name?: string; description?: string }> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${repo}/HEAD/${filePath.split('/').map(encodeURIComponent).join('/')}`,
      { headers: { 'User-Agent': 'claudiva', Range: `bytes=0-${HEAD_BYTES - 1}` } },
    );
    if (!res.ok && res.status !== 206) return {};
    return parseFrontmatter(await res.text());
  } catch {
    return {};
  }
}

/** Görevleri sabit sayıda paralel şeritte yürütür (hepsini birden atmamak için). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(lanes);
  return out;
}

async function scanRepo(src: CatalogSource): Promise<{ skills: CatalogSkill[]; error?: string }> {
  let tree: TreeResponse;
  try {
    tree = await fetchJson<TreeResponse>(
      `https://api.github.com/repos/${src.repo}/git/trees/HEAD?recursive=1`,
    );
  } catch (e) {
    return { skills: [], error: (e as Error).message };
  }

  const paths = (tree.tree ?? [])
    .filter((n) => n.type === 'blob' && /(^|\/)SKILL\.md$/i.test(n.path))
    .map((n) => n.path)
    .slice(0, MAX_PER_REPO);

  const skills = await mapLimit(paths, CONCURRENCY, async (p) => {
    const dir = p.replace(/(^|\/)SKILL\.md$/i, '');
    const folder = dir.split('/').filter(Boolean).pop() ?? dir;
    const fm = await readHead(src.repo, p);
    return {
      id: `${src.repo}:${dir}`,
      name: fm.name || folder,
      description: fm.description || '',
      repo: src.repo,
      skillPath: dir,
      folder,
    } satisfies CatalogSkill;
  });

  return {
    skills,
    // Kesilmiş ağaç sessizce eksik katalog demek olurdu; söylenmesi gerekiyor.
    error: tree.truncated ? S.treeTruncated : undefined,
  };
}

/** Bütün kaynakları tarar ve sonucu diske yazar. */
export async function refreshCatalog(): Promise<CatalogFile> {
  const sources = listSources();
  const results = await Promise.all(
    sources.map(async (s) => ({ src: s, ...(await scanRepo(s)) })),
  );

  const file: CatalogFile = {
    version: 1,
    fetchedAt: Date.now(),
    sources: results.map((r) => ({ ...r.src, count: r.skills.length, error: r.error })),
    skills: results.flatMap((r) => r.skills).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
  };

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(file, null, 2), 'utf-8');
  } catch {
    // Önbellek yazılamazsa katalog yine dönsün; yalnızca kalıcı olmaz.
  }
  return file;
}

function readCache(): CatalogFile | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8')) as CatalogFile;
    if (raw && Array.isArray(raw.skills)) return raw;
  } catch {
    // yok ya da bozuk
  }
  return null;
}

export interface CatalogView {
  fetchedAt: number | null;
  sources: CatalogSource[];
  skills: (CatalogSkill & { installedScopes: SkillScope[] })[];
}

/**
 * Katalog + "bu zaten kurulu mu" işareti.
 *
 * Eşleşme DİZİN ADI üzerinden, çünkü `installFromGitHub` hedef dizini tam
 * olarak o adla açıyor — yani panelde gördüğün "kurulu" rozetiyle kurulumun
 * çakışma hatası aynı şeye bakıyor. Frontmatter'daki `name` ile eşleştirmek
 * yanıltırdı: iki ayrı skill aynı `name`i taşıyabilir, dizin adı ise kurulum
 * kökünde zaten tekil.
 */
export function catalogView(installed: SkillInfo[] = listSkills()): CatalogView {
  const cache = readCache();
  const byFolder = new Map<string, SkillScope[]>();
  for (const s of installed) {
    const folder = path.basename(s.dir);
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), s.scope]);
  }

  return {
    fetchedAt: cache?.fetchedAt ?? null,
    // Önbellek yoksa da kaynak listesi gösterilebilsin (panel boş açılmasın).
    sources: cache?.sources ?? listSources(),
    skills: (cache?.skills ?? []).map((s) => ({
      ...s,
      installedScopes: byFolder.get(s.folder) ?? [],
    })),
  };
}

// ------------------------------------------------------------------ toplu kurulum

export interface BulkResult {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
}

/**
 * Birden çok skill'i TEK kapsama kurar.
 *
 * Kapsam bir kez soruluyor ve hepsine uygulanıyor — kullanıcının istediği
 * buydu: on skill işaretleyip on kez "nereye?" diye sorulmasın.
 *
 * Tek tek `installFromGitHub` çağrılıyor ve BİR HATA DİĞERLERİNİ DURDURMUYOR:
 * `Promise.all` ya da erken `throw` ile yazılsaydı, sekizinci skill'in adı
 * çakıştığı için ilk yedisi de yarıda kalmış görünürdü. Her satırın kendi
 * sonucu dönüyor, panel hangisinin neden olmadığını gösteriyor.
 *
 * SIRAYLA kuruluyor, paralel değil: hepsi aynı kök dizine yazıyor ve
 * `skills-lock.json` tek dosya — paralel yazım kilidi bozardı.
 */
export async function installMany(
  items: { id: string; repo: string; skillPath: string; name?: string }[],
  scope: SkillScope,
  agentId?: string,
): Promise<BulkResult[]> {
  const out: BulkResult[] = [];
  for (const it of items) {
    const name = it.name || it.skillPath.split('/').pop() || it.skillPath;
    try {
      const info = await installFromGitHub({ repo: it.repo, skillPath: it.skillPath, scope, agentId });
      out.push({ id: it.id, name: info.name, ok: true });
    } catch (e) {
      out.push({ id: it.id, name, ok: false, error: (e as Error).message });
    }
  }
  return out;
}
