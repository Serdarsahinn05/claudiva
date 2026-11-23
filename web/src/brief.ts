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
      'Bu bir SORU. Görev dağıtma, dosya değiştirme; bildiklerinle ya da okuyarak kısaca cevap ver.',
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
    'Nasıl yapacaksın:',
    '1. İsteği BİRBİRİNDEN BAĞIMSIZ parçalara böl (her parça tek bir ajanın tek başına bitirebileceği bir iş olsun).',
    '2. Her parçayı uzmanlığına en uygun ajana eşle.',
  ];
  if (opts.plan === 'approve') {
    steps.push(
      '3. HENÜZ DAĞITMA. Planı (parça → ajan → teslim kriteri) kısa bir liste olarak yaz ve onayımı bekle.',
      '4. Onay verdiğimde `delegate_tasks` aracını TEK ÇAĞRIDA, tüm parçaların dizisiyle çağır.',
      '5. Sonuçlar gelince hepsini tek bir özet halinde birleştir ve bana ne yapıldığını söyle.'
    );
  } else {
    steps.push(
      '3. `delegate_tasks` aracını TEK ÇAĞRIDA, tüm parçaların dizisiyle çağır — parça başına ayrı ayrı `delegate_task` ÇAĞIRMA, o zaman ekip seri çalışır ve süre parçaların toplamı olur.',
      '4. Yalnızca bir parça gerçekten bir öncekinin çıktısına bağlıysa onu `delegate_task after_task_id` ile zincirle.',
      '5. Sonuçlar gelince hepsini tek bir özet halinde birleştir ve bana ne yapıldığını söyle.'
    );
  }

  return [
    request,
    '',
    BRIEF_MARKER,
    '',
    `Bu bir EKİP İŞİDİR. Sen takımın liderisin; işi kendin baştan sona yapma, böl ve dağıt.`,
    '',
    roster.length ? `Emrindeki ajanlar:\n${roster.join('\n')}` : 'Emrinde başka ajan yok — işi kendin yap.',
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
