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
import { DATA_DIR, INSTALL_ROOT } from './paths.js';
import { S } from './i18n.js';

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
 * Bir türün katalogunu okur. `prevSha` önbellekteki katalogun sürümü
 * (`version.json` bütün katalog için tek sha taşır); aynıysa liste
 * indirilmez. Adreslerden hiçbiri çalışmazsa son hata fırlatılır.
 */
async function fetchCatalog(
  type: 'skills' | 'agents',
  prevSha?: string,
): Promise<{ sha: string; components: RawComponent[] | null; via: string }> {
  let lastErr: Error = new Error('aitmpl');
  const order = [BASES[preferred], ...BASES.filter((_, i) => i !== preferred)];
  for (const base of order) {
    try {
      const version = (await (await get(base + 'version.json')).json()) as { sha256?: string };
      const sha = version.sha256 ?? '';
      const host = new URL(base).host;
      preferred = BASES.indexOf(base);
      if (sha && sha === prevSha) return { sha, components: null, via: host };
      const cat = (await (await get(base + `catalog/${type}.json`)).json()) as { components?: RawComponent[] };
      if (!Array.isArray(cat.components)) throw new Error(`${host}: catalog`);
      return { sha, components: cat.components, via: host };
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}

export async function fetchAitmplSkills(prevSha?: string): Promise<AitmplResult> {
  const r = await fetchCatalog('skills', prevSha);
  return {
    sha: r.sha,
    via: r.via,
    skills: r.components ? r.components.map(convert).filter((s): s is AitmplSkill => s !== null) : null,
  };
}

// ------------------------------------------------------------------ ajanlar
//
// aitmpl ajanı tek bir `.md` (Claude Code subagent: frontmatter name,
// description, tools, model + sistem istemi). Claudiva ajanı config.json +
// personality.md; doğrudan kopyalanamaz, DÖNÜŞTÜRÜLÜR (`agentDraft`). Taslak
// diske yazılmaz: panel formu doldurur, kullanıcı gözden geçirip oluşturur.

const AGENTS_CACHE = path.join(DATA_DIR, 'aitmpl-agents.json');

export interface AitmplAgent {
  id: string;
  name: string;
  category: string;
  /** `<example>` blokları atılmış kısa açıklama. */
  summary: string;
  /** Depo içi dosya yolu (`cli-tool/components/agents/<kat>/<ad>.md`). */
  file: string;
  downloads: number;
  scan: { severity: ScanSeverity; score: number } | null;
  page: string | null;
}

export interface AitmplAgentsView {
  fetchedAt: number | null;
  error?: string;
  agents: AitmplAgent[];
}

interface AgentsCache {
  sha: string;
  fetchedAt: number;
  agents: AitmplAgent[];
}

/**
 * Açıklamadan ilk cümle. aitmpl ajan açıklamaları uzun ve `<example>`
 * blokları taşıyor; ajan açıklaması (panelde ve ekip listesinde görünen)
 * kısa olmalı. Cümle sonu bulunamazsa 220 karakterde kesilir.
 */
export function firstSentence(text: string): string {
  const plain = text.split(/<example>/i)[0].replace(/\s+/g, ' ').trim();
  const m = plain.match(/^(.{20,}?[.!?])(\s|$)/);
  const out = m ? m[1] : plain;
  return out.length > 220 ? out.slice(0, 217).trimEnd() + '…' : out;
}

function toAgent(c: RawComponent): AitmplAgent | null {
  if (!c.id || !c.path || !c.name) return null;
  const sev = String(c.scan?.severity ?? '').toUpperCase();
  return {
    id: c.id,
    name: c.name,
    category: c.category ?? '',
    summary: firstSentence(c.description ?? ''),
    file: `cli-tool/components/agents/${c.path}`,
    downloads: typeof c.downloads === 'number' ? c.downloads : 0,
    scan: SEVERITIES.has(sev) ? { severity: sev as ScanSeverity, score: Number(c.scan?.score ?? 0) } : null,
    page: c.urls?.page ?? null,
  };
}

function readAgentsCache(): AgentsCache | null {
  try {
    const raw = JSON.parse(fs.readFileSync(AGENTS_CACHE, 'utf-8')) as AgentsCache;
    if (raw && Array.isArray(raw.agents)) return raw;
  } catch {
    // yok ya da bozuk
  }
  return null;
}

/** Önbellekten okur; ağa ÇIKMAZ. */
export function aitmplAgents(): AitmplAgentsView {
  const c = readAgentsCache();
  return { fetchedAt: c?.fetchedAt ?? null, agents: c?.agents ?? [] };
}

/** Katalogu tazeler. Ağ yoksa önbellek korunur, hata yanında döner. */
export async function refreshAitmplAgents(): Promise<AitmplAgentsView> {
  const prev = readAgentsCache();
  try {
    const r = await fetchCatalog('agents', prev?.agents.length ? prev.sha : undefined);
    const agents = r.components
      ? r.components
          .map(toAgent)
          .filter((a): a is AitmplAgent => a !== null)
          .sort((a, b) => a.name.localeCompare(b.name))
      : (prev?.agents ?? []);
    const next: AgentsCache = { sha: r.sha, fetchedAt: Date.now(), agents };
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(AGENTS_CACHE, JSON.stringify(next), 'utf-8');
    } catch {
      // önbellek yazılamazsa liste yine dönsün
    }
    return { fetchedAt: next.fetchedAt, agents };
  } catch (e) {
    return {
      fetchedAt: prev?.fetchedAt ?? null,
      agents: prev?.agents ?? [],
      error: S.aitmplUnreachable((e as Error).message),
    };
  }
}

/** Panelin formu dolduracağı taslak. */
export interface AgentDraft {
  template: string;
  name: string;
  description: string;
  model: 'haiku' | 'sonnet' | 'opus' | null;
  personality: string;
  scan: AitmplAgent['scan'];
}

/** Paket ajanlarındaki kural; aitmpl istemleri İngilizce. */
const LANGUAGE_LINE = 'Reply in the language the user writes in, even though these instructions are in English.';

/** "accessibility-tester" → "Accessibility Tester" */
function humanize(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Ajan dosyasını indirip taslağa çevirir.
 *
 * Yalnız katalogda olan kimlik kabul edilir; dosya yolu istemciden değil
 * katalogdan gelir (keyfi URL indirtilemesin). `tools` listesi bilerek
 * alınmaz: Claudiva'da karşılığı yok ve personality'ye yazmak yanıltırdı.
 */
export async function agentDraft(id: string): Promise<AgentDraft> {
  const entry = readAgentsCache()?.agents.find((a) => a.id === id);
  if (!entry) throw new Error(S.templateNotFound);

  const url = `https://raw.githubusercontent.com/${TEMPLATES_REPO}/HEAD/${entry.file.split('/').map(encodeURIComponent).join('/')}`;
  const text = (await (await get(url)).text()).replace(/\r\n/g, '\n');

  let fm = '';
  let body = text;
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end !== -1) {
      fm = text.slice(4, end);
      body = text.slice(end + 4).replace(/^[^\n]*\n/, '');
    }
  }
  const field = (k: string) =>
    fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');
  const m = (field('model') ?? '').toLowerCase();
  const model = m === 'haiku' || m === 'sonnet' || m === 'opus' ? m : null;

  return {
    template: entry.id,
    name: humanize(field('name') || entry.name),
    description: entry.summary,
    model,
    personality: `${body.trim()}\n\n- ${LANGUAGE_LINE}\n`,
    scan: entry.scan,
  };
}
