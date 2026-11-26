/**
 * aitmpl.com (Claude Code Templates) katalogu — skill'ler.
 *
 * Ayrıntı ve kararlar: `docs/AITMPL-ENTEGRASYON.md`. Kısaca:
 *
 * - Yalnız kararlı uçlar okunur (`/api/v1/version.json`, `/api/v1/catalog/skills.json`);
 *   `components.json` gibi dosyalar haber vermeden değişebilir.
 * - **İki adres, aynı dosya.** Önce aitmpl.com, olmazsa GitHub deposundaki
 *   kaynak (`dashboard/public/api/v1/`). Ölçüldü (2026-11-26): aitmpl.com
 *   Türkiye'den DNS düzeyinde açılmıyor (yerel DNS 213.14.227.50 veriyor,
 *   bağlantı zaman aşımı), GitHub kopyası açılıyor ve içerik aynı.
 * - `version.json`daki `sha256` değişmediyse katalog yeniden indirilmez
 *   (site bunu istiyor; 1.3 MB'ı her "Yenile"de çekmek boşa).
 * - User-Agent iletişim adresi taşır (sitenin isteği, kullanıcı onayı
 *   2026-11-26): `claudiva/<sürüm> (+…/issues)`. Sürüm paketten okunur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { INSTALL_ROOT } from './paths.js';

export const AITMPL_KEY = 'aitmpl.com';
/** Depo içi skill'lerin yaşadığı depo ve kök. */
const TEMPLATES_REPO = 'davila7/claude-code-templates';
const IN_REPO_ROOT = 'cli-tool/components/skills';

const BASES = [
  'https://www.aitmpl.com/api/v1/',
  `https://raw.githubusercontent.com/${TEMPLATES_REPO}/HEAD/dashboard/public/api/v1/`,
];
/** aitmpl.com engelliyse ilk yenileme bu kadar bekler; kısa tutuldu. */
const TIMEOUT_MS = 6000;
/** Son çalışan adres önce denenir: engelli ağda her "Yenile" 6 sn beklemesin.
 *  Süreç ömrü boyunca tutulur; sunucu yeniden açılınca yine aitmpl.com önce. */
let preferred = 0;

let ua: string | null = null;
export function userAgent(): string {
  if (ua) return ua;
  let version = '0';
  try {
    version = (JSON.parse(fs.readFileSync(path.join(INSTALL_ROOT, 'package.json'), 'utf-8')) as { version?: string }).version ?? '0';
  } catch {
    // sürüm okunamazsa da istek gitsin
  }
  ua = `claudiva/${version} (+https://github.com/Serdarsahinn05/claudiva/issues)`;
  return ua;
}

export type ScanSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Katalogdaki bir aitmpl skill'inin Claudiva'ya taşınan alanları. */
export interface AitmplSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Kurulacak depo: depo içi skill'de şablon deposu, dış skill'de kendi deposu. */
  repo: string;
  skillPath: string;
  /** Dış skill'de taranan commit; kurulum bu commit'ten yapılır (main değil). */
  ref?: string;
  license: string | null;
  downloads: number;
  scan: { severity: ScanSeverity; score: number } | null;
  page: string | null;
}

interface RawComponent {
  id: string;
  name: string;
  category?: string;
  path: string;
  description?: string;
  license?: string | null;
  downloads?: number;
  urls?: { page?: string };
  scan?: { severity?: string; score?: number } | null;
  source?: { repo: string; path: string; commit?: string; license?: string | null } | null;
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
    signal: AbortSignal.timeout(url.includes('aitmpl.com') ? TIMEOUT_MS : 30000),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res;
}

const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function convert(c: RawComponent): AitmplSkill | null {
  if (!c.id || !c.path || !c.name) return null;
  const src = c.source;
  const sev = String(c.scan?.severity ?? '').toUpperCase();
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? '',
    category: c.category ?? '',
    repo: src ? src.repo : TEMPLATES_REPO,
    skillPath: src ? src.path : `${IN_REPO_ROOT}/${c.path}`,
    ref: src?.commit || undefined,
    license: c.license ?? src?.license ?? null,
    downloads: typeof c.downloads === 'number' ? c.downloads : 0,
    scan: SEVERITIES.has(sev) ? { severity: sev as ScanSeverity, score: Number(c.scan?.score ?? 0) } : null,
    page: c.urls?.page ?? null,
  };
}

export interface AitmplResult {
  sha: string;
  /** null = sha değişmedi, önbellektekini kullan. */
  skills: AitmplSkill[] | null;
  /** Hangi adresten okundu (panelde "kaynak" olarak yazılmaz, tanı için). */
  via: string;
}

/**
 * Katalogu okur. `prevSha` önbellekteki katalogun sürümü; aynıysa skill
 * listesi indirilmez. Adreslerden hiçbiri çalışmazsa son hata fırlatılır.
 */
export async function fetchAitmplSkills(prevSha?: string): Promise<AitmplResult> {
  let lastErr: Error = new Error('aitmpl');
  const order = [BASES[preferred], ...BASES.filter((_, i) => i !== preferred)];
  for (const base of order) {
    try {
      const version = (await (await get(base + 'version.json')).json()) as { sha256?: string };
      const sha = version.sha256 ?? '';
      const host = new URL(base).host;
      preferred = BASES.indexOf(base);
      if (sha && sha === prevSha) return { sha, skills: null, via: host };
      const cat = (await (await get(base + 'catalog/skills.json')).json()) as { components?: RawComponent[] };
      if (!Array.isArray(cat.components)) throw new Error(`${host}: catalog`);
      const skills = cat.components.map(convert).filter((s): s is AitmplSkill => s !== null);
      return { sha, skills, via: host };
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}
