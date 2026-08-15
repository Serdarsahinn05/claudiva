/**
 * Skill keşfi ve yönetimi.
 *
 * Bir skill = bir dizin + içinde `SKILL.md` (YAML frontmatter: name, description).
 * Üç kapsam var ve üçü FARKLI şeyler:
 *
 *   · **global** (`~/.claude/skills`) — kullanıcının bütün projelerinde geçerli.
 *     Buradan silmek başka projeleri de etkiler; panel bunu söylemek zorunda.
 *   · **proje** (`<proje>/.claude/skills`) — yalnız bu depo.
 *   · **ajan** (`~/.claude-manager/agents/<id>/skills`) — yalnız o ajan. Ajan
 *     dizini aynı zamanda yerel bir Claude Code plugin'i (bkz. manager.ts).
 *
 * ETKİNLİK MEKANİZMASI ÖLÇÜLDÜ, UYDURULMADI: `settings.json` içinde skill'i
 * kapatan bir anahtar YOK (anahtarlar: model, hooks, extraKnownMarketplaces,
 * effortLevel, autoUpdatesChannel, theme, switchModelsOnFlag). Yükleyici
 * `<dizin>/SKILL.md` arıyor; dolayısıyla devre dışı bırakmanın geri alınabilir
 * ve gerçek tek yolu o dosyayı yeniden adlandırmak: `SKILL.md.disabled`.
 * Dizin adına dokunulmuyor — dizini gizlemek referans dosyalarını da
 * kaybettirirdi ve geri alma kırılgan olurdu.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AGENTS_DIR, CLAUDE_USER_DIR, PROJECT_DIR } from './paths.js';

const DISABLED_SUFFIX = '.disabled';

export type SkillScope = 'global' | 'project' | 'agent';

export interface SkillInfo {
  /** Kapsam + dizin adı; panelin kimliği (aynı ad iki kapsamda olabilir). */
  id: string;
  /** Frontmatter'daki `name`, yoksa dizin adı. */
  name: string;
  description: string;
  scope: SkillScope;
  /** Yalnız ajan kapsamında dolu. */
  agentId?: string;
  /** Skill dizininin mutlak yolu. */
  dir: string;
  enabled: boolean;
  /** SKILL.md bayt boyutu — bağlam maliyetinin kaba göstergesi. */
  size: number;
  /** Dizindeki ek dosyalar (references/, scripts/…). */
  extras: string[];
}

function skillsRootFor(scope: SkillScope, agentId?: string): string {
  if (scope === 'global') return path.join(CLAUDE_USER_DIR, 'skills');
  if (scope === 'project') return path.join(PROJECT_DIR, '.claude', 'skills');
  return path.join(AGENTS_DIR, agentId ?? '', 'skills');
}

/**
 * Frontmatter'dan `name` ve `description`.
 *
 * Tam bir YAML çözümleyici bilerek yok: gereken iki alan ve ikisi de tek
 * satırlık skaler. Bağımlılık eklemek bu iş için orantısız olurdu. Değer
 * tırnaklı ya da tırnaksız gelebiliyor (ölçüldü: global skill'ler tırnaklı,
 * ajan skill'leri tırnaksız yazıyor).
 */
export function parseFrontmatter(md: string): { name?: string; description?: string } {
  if (!md.startsWith('---')) return {};
  const end = md.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = md.slice(3, end);
  const out: { name?: string; description?: string } = {};

  /**
   * CRLF İKİ AYRI YERDE canını yakıyor, ikisi de ölçüldü:
   *
   *  1. Satır `\r` ile bitiyorsa `/^…(.*)$/` **null** döner — JS'de `.` satır
   *     sonlandırıcı eşlemez ve `\r` de bir satır sonlandırıcıdır, dolayısıyla
   *     `(.*)` `\r`'den önce durur ve `$` ondan sonra gelemez.
   *  2. `\r?\n` ile bölmek YETMEZ: bloğun SON satırındaki `\r`'nin ardından
   *     `\n` gelmiyor (blok kapanış `---`'inden hemen önce kesiliyor), o yüzden
   *     ayraç sayılmaz ve satırda asılı kalır. `name` düzelirken `description`
   *     bozuk kalıyordu — tam olarak bu yüzden.
   *
   * Çözüm ikisini birden kapatıyor: `\r?\n` ile böl VE her satırın sonunu kırp.
   */
  const lines = block.split(/\r?\n/).map((l) => l.trimEnd());

  for (let i = 0; i < lines.length; i++) {
    const m = /^(name|description)\s*:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const key = m[1] as 'name' | 'description';
    let v = m[2].trim();

    /**
     * YAML katlanmış/literal blok (`>`, `|`, `>-`, `|-`): değer satırda değil,
     * ONU İZLEYEN GİRİNTİLİ SATIRLARDA. Bu biçimi atlamak değeri ">" gibi
     * anlamsız bir işarete indiriyordu (ölçüldü: `ponytail`).
     */
    if (/^[>|][-+]?$/.test(v)) {
      const parts: string[] = [];
      while (i + 1 < lines.length && (lines[i + 1] === '' || /^\s+\S/.test(lines[i + 1]))) {
        parts.push(lines[++i].trim());
      }
      v = parts.join(' ').trim();
    } else if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }

    out[key] = v;
  }
  return out;
}

function readOne(dir: string, scope: SkillScope, agentId?: string): SkillInfo | null {
  const active = path.join(dir, 'SKILL.md');
  const off = active + DISABLED_SUFFIX;
  const file = fs.existsSync(active) ? active : fs.existsSync(off) ? off : null;
  if (!file) return null;

  let md = '';
  let size = 0;
  try {
    md = fs.readFileSync(file, 'utf-8');
    size = fs.statSync(file).size;
  } catch {
    return null;
  }

  const fm = parseFrontmatter(md);
  const folder = path.basename(dir);
  let extras: string[] = [];
  try {
    extras = fs
      .readdirSync(dir)
      .filter((e) => e !== 'SKILL.md' && e !== 'SKILL.md' + DISABLED_SUFFIX);
  } catch {
    // dizin okunamazsa ek dosya listesi boş kalır
  }

  return {
    id: `${scope}:${agentId ? `${agentId}:` : ''}${folder}`,
    name: fm.name || folder,
    description: fm.description || '',
    scope,
    agentId,
    dir,
    enabled: file === active,
    size,
    extras,
  };
}

function scanRoot(root: string, scope: SkillScope, agentId?: string): SkillInfo[] {
  if (!fs.existsSync(root)) return [];
  const out: SkillInfo[] = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const info = readOne(path.join(root, e.name), scope, agentId);
    if (info) out.push(info);
  }
  return out;
}

/** Üç kapsamın tamamı. Ajan kapsamı her ajan için ayrı taranır. */
export function listSkills(): SkillInfo[] {
  const out = [
    ...scanRoot(skillsRootFor('global'), 'global'),
    ...scanRoot(skillsRootFor('project'), 'project'),
  ];

  if (fs.existsSync(AGENTS_DIR)) {
    for (const e of fs.readdirSync(AGENTS_DIR, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      out.push(...scanRoot(skillsRootFor('agent', e.name), 'agent', e.name));
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

/** Kimlikten skill'i bulur; bulunamazsa null (panel yarışta silmiş olabilir). */
function find(id: string): SkillInfo | null {
  return listSkills().find((s) => s.id === id) ?? null;
}

/**
 * Etkin/pasif geçişi. `SKILL.md` ↔ `SKILL.md.disabled` yeniden adlandırması —
 * tersine çevrilebilir ve dizindeki diğer dosyalara dokunmaz.
 */
export function setSkillEnabled(id: string, enabled: boolean): SkillInfo {
  const s = find(id);
  if (!s) throw new Error('Skill bulunamadı.');
  const active = path.join(s.dir, 'SKILL.md');
  const off = active + DISABLED_SUFFIX;

  if (enabled && !s.enabled) fs.renameSync(off, active);
  else if (!enabled && s.enabled) fs.renameSync(active, off);

  const next = readOne(s.dir, s.scope, s.agentId);
  if (!next) throw new Error('Skill durumu okunamadı.');
  return next;
}

/**
 * Skill dizinini tamamen siler. YIKICIDIR ve geri alınamaz; çağıran taraf
 * onay almak zorunda (panel modal ile soruyor). Global kapsamda silmek
 * kullanıcının BÜTÜN projelerini etkiler — panel bunu ayrıca uyarıyor.
 */
export function removeSkill(id: string): void {
  const s = find(id);
  if (!s) throw new Error('Skill bulunamadı.');
  // Güvenlik: yalnızca bilinen üç kökün altındaki bir dizin silinebilir.
  const root = path.resolve(skillsRootFor(s.scope, s.agentId));
  const target = path.resolve(s.dir);
  if (!target.startsWith(root + path.sep)) throw new Error('Skill yolu beklenen kökün dışında.');
  fs.rmSync(target, { recursive: true, force: true });

  /**
   * Kilit kaydını da düşür — yoksa defter diskte olmayan bir şeyi "kurulu"
   * gösterir. Kurulum satır ekliyordu, silme çıkarmıyordu; tek tek çalışırken
   * göze batmıyordu, toplu kurulum bunu görünür yaptı (10 kur / 10 kaldır →
   * 10 ölü kayıt) ve dosya git'te izlendiği için diff gürültüsü üretiyordu.
   *
   * KOŞULLU düşürülüyor ve bu şart: kilit yalnızca DİZİN ADIYLA anahtarlanıyor,
   * kapsam boyutu yok. Aynı skill hem projeye hem genele kurulmuşsa ikisi tek
   * satırı paylaşır; birini silerken kaydı atmak diğeri için HÂLÂ DOĞRU olan
   * bilgiyi silerdi. O yüzden yalnız o addan başka kurulu kalmadıysa düşer.
   */
  const folder = path.basename(s.dir);
  if (!listSkills().some((o) => path.basename(o.dir) === folder)) dropLock(folder);
}

/** Kilitten tek bir kaydı düşürür. Dosya yoksa/bozuksa sessizce geçer:
 *  kilidin kaybı silmeyi geçersiz kılmaz, silme zaten diskte olan bitti. */
function dropLock(name: string): void {
  let lock: LockFile;
  try {
    lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as LockFile;
    if (!lock?.skills || !(name in lock.skills)) return;
  } catch {
    return;
  }
  delete lock.skills[name];
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  } catch {
    // yazılamazsa kayıt bayat kalır; silme yine gerçekleşti
  }
}

// ----------------------------------------------------- GitHub'dan kurulum

const LOCK_FILE = path.join(PROJECT_DIR, 'skills-lock.json');
/** Tek bir skill dosyası için üst sınır — kaçak bir depo diski doldurmasın. */
const MAX_ASSET_BYTES = 2_000_000;
/** SKILL.md yanında indirilecek en fazla dosya (references/, scripts/…). */
const MAX_ASSETS = 40;

interface LockFile {
  version: number;
  skills: Record<
    string,
    { source: string; sourceType: string; skillPath: string; computedHash: string }
  >;
}

interface GhEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}

async function gh<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'claudiva' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url.replace('https://api.github.com', '')}`);
  return (await res.json()) as T;
}

/**
 * Bir skill'i GitHub'dan kurar.
 *
 * ARŞİV DEĞİL, TEK TEK DOSYA indirilir. Tarball açmak bir sıkıştırma
 * bağımlılığı ister ve daha kötüsü, arşivin İÇİNDEKİ yollara güvenmek
 * gerekirdi (`../` taşıyan bir giriş hedef kökün dışına yazabilirdi). Contents
 * API ile gelen her dosyanın adı ayrı ayrı doğrulanıyor ve hedef yol her
 * seferinde köke karşı sınanıyor.
 *
 * `skills-lock.json` biçimi projede zaten vardı; alanlar aynen korunuyor
 * (source, sourceType, skillPath, computedHash) — hash SKILL.md içeriğinin
 * sha256'sı, yani kurulan şeyin ne olduğu sonradan doğrulanabilir.
 */
export async function installFromGitHub(opts: {
  /** "owner/repo" */
  repo: string;
  /** Depo içindeki yol: "skills/futuristic/SKILL.md" ya da "skills/futuristic" */
  skillPath: string;
  scope: SkillScope;
  agentId?: string;
}): Promise<SkillInfo> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(opts.repo)) {
    throw new Error('Depo "sahip/depo" biçiminde olmalı.');
  }
  if (opts.scope === 'agent' && !opts.agentId) throw new Error('Ajan kapsamı için ajan seçilmeli.');

  // Yol SKILL.md'yi gösteriyorsa dizinine çık; kullanıcı ikisini de yazabilir.
  const dirInRepo = opts.skillPath.replace(/\/SKILL\.md$/i, '').replace(/^\/+|\/+$/g, '');
  if (!dirInRepo || dirInRepo.includes('..')) throw new Error('Geçersiz skill yolu.');

  const listing = await gh<GhEntry[] | GhEntry>(
    `https://api.github.com/repos/${opts.repo}/contents/${encodeURI(dirInRepo)}`,
  );
  const entries = Array.isArray(listing) ? listing : [listing];
  if (!entries.some((e) => e.type === 'file' && e.name.toLowerCase() === 'skill.md')) {
    throw new Error(`"${dirInRepo}" altında SKILL.md bulunamadı.`);
  }

  const folder = path.basename(dirInRepo);
  const root = skillsRootFor(opts.scope, opts.agentId);
  const target = path.resolve(root, folder);
  if (!target.startsWith(path.resolve(root) + path.sep)) {
    throw new Error('Hedef yol kapsam kökünün dışına çıkıyor.');
  }
  if (fs.existsSync(target)) throw new Error(`"${folder}" zaten kurulu. Önce kaldır.`);

  /** Depodaki bir dizini özyinelemeli indirir. Dosya sayısı üst sınırlı. */
  let written = 0;
  const pull = async (repoDir: string, destDir: string, list?: GhEntry[]) => {
    const items = list ?? (await gh<GhEntry[]>(
      `https://api.github.com/repos/${opts.repo}/contents/${encodeURI(repoDir)}`,
    ));
    fs.mkdirSync(destDir, { recursive: true });

    for (const e of items) {
      if (written >= MAX_ASSETS) break;
      // Dosya adı doğrulaması: ayraç ya da üst dizin taşıyan bir ad kabul
      // edilmez (contents API normalde vermez, ama güvenmiyoruz).
      if (e.name.includes('/') || e.name.includes('\\') || e.name === '..' || e.name === '.') {
        continue;
      }
      const dest = path.resolve(destDir, e.name);
      if (!dest.startsWith(path.resolve(destDir) + path.sep)) continue;

      if (e.type === 'dir') {
        await pull(e.path, dest);
      } else if (e.type === 'file' && e.download_url) {
        if (e.size > MAX_ASSET_BYTES) continue;
        const res = await fetch(e.download_url, { headers: { 'User-Agent': 'claudiva' } });
        if (!res.ok) throw new Error(`İndirilemedi: ${e.path} (${res.status})`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_ASSET_BYTES) continue;
        fs.writeFileSync(dest, buf);
        written += 1;
      }
    }
  };

  try {
    await pull(dirInRepo, target, entries);
  } catch (err) {
    // Yarım kurulum bırakma: hata olursa hedefi temizle.
    fs.rmSync(target, { recursive: true, force: true });
    throw err;
  }

  const info = readOne(target, opts.scope, opts.agentId);
  if (!info) {
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error('Kurulum sonrası SKILL.md okunamadı.');
  }

  writeLock(folder, {
    source: opts.repo,
    sourceType: 'github',
    skillPath: `${dirInRepo}/SKILL.md`,
    computedHash: crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(target, 'SKILL.md')))
      .digest('hex'),
  });

  return info;
}

/** Kilit dosyasını günceller. Okunamıyorsa sıfırdan yazılır — kilit kaybı
 *  kurulumu geçersiz kılmaz, yalnızca kaynağın kaydını düşürür. */
function writeLock(name: string, entry: LockFile['skills'][string]): void {
  let lock: LockFile = { version: 1, skills: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as LockFile;
    if (raw && typeof raw === 'object' && raw.skills) lock = raw;
  } catch {
    // yok ya da bozuk
  }
  lock.skills[name] = entry;
  try {
    // Sondaki satır sonu bilerek: dosya git'te izleniyor ve satır sonu olmayan
    // bir dosya her yazımda "\ No newline at end of file" diffi üretiyordu.
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  } catch {
    // kilit yazılamazsa kurulum yine geçerli
  }
}
