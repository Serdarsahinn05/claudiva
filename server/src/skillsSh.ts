/**
 * skills.sh arama ucu — katalogda olmayan skill'leri ADIYLA bulmak için.
 *
 * Kararlar ve ölçümler: `docs/AITMPL-ENTEGRASYON.md` → "skills.sh".
 *
 * - Uç `GET https://skills.sh/api/search?q=` (anahtar yok). Vercel'in açık
 *   kaynak `skills` CLI'ı (`npx skills find`) aynı ucu kullanıyor;
 *   BELGELENMİŞ kararlılık sözü yok. Bu yüzden her şey bu dosyada izole ve
 *   hata panelde yalnız o bölümü susturur, Keşfet'in geri kalanı çalışır.
 * - Arama yalnız kullanıcı isteyince (düğme/Enter) yapılır, her tuşta değil:
 *   kullanım sınırı bilinmiyor ve arama kelimesi üçüncü tarafa gidiyor.
 * - Sonuç DİSKE YAZILMAZ (yerleşik liste yok; kullanıcı kararı).
 * - Yanıtta açıklama, depo içi yol, tarama ve lisans YOK. Yol kurulumda depo
 *   ağacından çözülür (`resolveSkillPath`, kotası githubTree'de); tarama
 *   olmadığı için panel "taranmadı" rozeti gösterir ve kurulumda onay ister.
 */
import { userAgent } from './aitmpl.js';
import { S } from './i18n.js';

export interface SkillsShHit {
  /** "sahip/depo/skillId" */
  id: string;
  name: string;
  /** "sahip/depo" */
  repo: string;
  skillId: string;
  installs: number;
}

const MAX_RESULTS = 50;

export async function searchSkillsSh(q: string): Promise<SkillsShHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  let res: Response;
  try {
    res = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    throw new Error(S.skillsShUnreachable((e as Error).message));
  }
  if (!res.ok) throw new Error(S.skillsShUnreachable(`HTTP ${res.status}`));
  const body = (await res.json()) as {
    skills?: { id?: string; name?: string; source?: string; skillId?: string; installs?: number }[];
  };
  const out: SkillsShHit[] = [];
  for (const s of body.skills ?? []) {
    // Biçimi tutmayan satır atlanır: depo adı kurulumda URL'e girecek.
    if (!s.source || !/^[\w.-]+\/[\w.-]+$/.test(s.source)) continue;
    const skillId = String(s.skillId ?? s.name ?? '');
    if (!/^[\w.:-]{1,100}$/.test(skillId)) continue;
    out.push({
      id: String(s.id ?? `${s.source}/${skillId}`),
      name: String(s.name ?? skillId),
      repo: s.source,
      skillId,
      installs: typeof s.installs === 'number' ? s.installs : 0,
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}
