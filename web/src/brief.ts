/**
 * Lidere giden ekip talimatı ("brif").
 *
 * Kullanıcının cümlesi AYNEN korunur ve en başta durur; altındaki çerçeve
 * yalnızca "kim var, nasıl dağıt" bilgisidir. Kullanıcı metnini yeniden
 * yazmak (özetlemek, çevirmek) niyeti bozardı.
 *
 * Çerçeve `BRIEF_MARKER` satırıyla başlar. Sohbet modu liderin dökümünde bu
 * satırı görünce altını keser (`stripBrief`): kullanıcı kendi yazdığını görür,
 * ajana giden talimat bloğunu değil. İşaret değişirse eski dökümler kesilmez —
 * bu yüzden sabit ve sıradan bir metinde rastlanmayacak biçimde.
 */
import type { AgentSnapshot } from './types';
import { ROLE_LABEL } from './format';
import { canDelegate } from './teams';
import { L } from './i18n';

export const BRIEF_MARKER = '⟪claudiva:ekip-talimatı⟫';

export interface BriefOptions {
  /**
   * `approve`: lider önce planı yazar ve onay bekler; dağıtım ancak kullanıcı
   * "onaylıyorum" dedikten sonra. Yeni bir araç gerektirmez — onay sohbetteki
   * bir sonraki mesajdır.
   */
  plan?: 'auto' | 'approve';
  /** Soru kipi: görev dağıtılmaz, lider yalnız cevap verir. */
  ask?: boolean;
}

export function buildBrief(
  request: string,
  lead: AgentSnapshot,
  pool: AgentSnapshot[],
  opts: BriefOptions = {}
): string {
  if (opts.ask) {
    return [
      request,
      '',
      BRIEF_MARKER,
      L.brief.question,
    ].join('\n');
  }

  // Dağıtamayan bir lidere dağıtım talimatı vermek onu var olmayan bir araca
  // yollar; o zaman istek olduğu gibi, çerçevesiz gider.
  if (!canDelegate(lead)) return request;

  const roster = pool
    .filter((a) => a.config.id !== lead.config.id)
    .map((a) => {
      const role = ROLE_LABEL[a.config.role] ?? a.config.role;
      const desc = a.config.description?.trim();
      return `- ${a.config.id} · ${a.config.name} (${role})${desc ? ` — ${desc}` : ''}`;
    });

  const steps = [
    L.brief.howTo,
    L.brief.step1,
    L.brief.step2,
  ];
  if (opts.plan === 'approve') {
    steps.push(
      L.brief.approve3,
      L.brief.approve4,
      L.brief.step5
    );
  } else {
    steps.push(
      L.brief.auto3,
      L.brief.auto4,
      L.brief.step5
    );
  }

  return [
    request,
    '',
    BRIEF_MARKER,
    '',
    L.brief.teamWork,
    '',
    roster.length ? L.brief.roster(roster.join('\n')) : L.brief.alone,
    '',
    roster.length ? steps.join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Brifin kullanıcıya ait kısmı. Eski dökümlerdeki brifler işaretsizdi
 * (`\n---\n` + "Bu bir EKİP İŞİDİR") — onlar da tanınıp kesilir.
 */
export function stripBrief(text: string): { text: string; briefed: boolean } {
  const i = text.indexOf(BRIEF_MARKER);
  if (i !== -1) return { text: text.slice(0, i).trimEnd(), briefed: true };
  const legacy = text.indexOf('\n---\n\nBu bir EKİP İŞİDİR.');
  if (legacy !== -1) return { text: text.slice(0, legacy).trimEnd(), briefed: true };
  return { text, briefed: false };
}
