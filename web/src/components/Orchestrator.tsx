/**
 * Orkestratör komut çubuğu.
 *
 * Ekranın dibinde duran tek satır: yüksek seviyeli bir istek yazılır
 * ("landing page'i yenile, ekibe dağıt"), takımın LİDER ajanı işi böler ve
 * `delegate_tasks` ile hepsini AYNI ANDA dağıtır.
 *
 * Neden çoğul araç: `delegate_task` (tekil) çağıran turu `waitFor` ile
 * bloklar, yani lider tek tek çağırınca ekip zorunlu olarak seri çalışır —
 * delege et, bekle, oku, sıradakini delege et. Çoğulu hepsini senkron
 * dispatch edip `Promise.all` ile bekler; duvar saati en uzun görev kadardır.
 * Bu yüzden çubuğun ürettiği talimat tek bir şeyi ısrarla söyler: TEK
 * ÇAĞRIDA hepsini ver.
 *
 * Kim olduğu belli olmayan bir "orkestratör servisi" YOK — iş gerçek bir
 * ajana, onun kendi terminaline gider. Kullanıcı böleni de bölünüşü de
 * dökümde görür; sihirli bir kutu değil, izlenebilir bir tur.
 */
import { useState } from 'react';
import { api } from '../api';
import type { AgentSnapshot } from '../types';
import { ROLE_LABEL } from '../format';
import { canDelegate, leadOf } from '../teams';

interface Props {
  /** Seçili takımın ajanları — dağıtım havuzu budur. */
  teamAgents: AgentSnapshot[];
  teamLabel: string;
  /** Komut gönderilince liderin terminalini aç. */
  onOpenTerminal: (agentId: string) => void;
}

/**
 * Lidere giden talimat. Kullanıcının cümlesi AYNEN korunur ve en başta
 * durur; altındaki çerçeve yalnızca "kim var, nasıl dağıt" bilgisidir.
 * Kullanıcı metnini yeniden yazmak (özetlemek, İngilizceye çevirmek)
 * niyeti bozardı.
 */
function buildBrief(request: string, lead: AgentSnapshot, pool: AgentSnapshot[]): string {
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

  return [
    request,
    '',
    '---',
    '',
    `Bu bir EKİP İŞİDİR. Sen takımın liderisin; işi kendin baştan sona yapma, böl ve dağıt.`,
    '',
    roster.length ? `Emrindeki ajanlar:\n${roster.join('\n')}` : 'Emrinde başka ajan yok — işi kendin yap.',
    '',
    roster.length
      ? [
          'Nasıl yapacaksın:',
          '1. İsteği BİRBİRİNDEN BAĞIMSIZ parçalara böl (her parça tek bir ajanın tek başına bitirebileceği bir iş olsun).',
          '2. Her parçayı uzmanlığına en uygun ajana eşle.',
          '3. `delegate_tasks` aracını TEK ÇAĞRIDA, tüm parçaların dizisiyle çağır — parça başına ayrı ayrı `delegate_task` ÇAĞIRMA, o zaman ekip seri çalışır ve süre parçaların toplamı olur.',
          '4. Yalnızca bir parça gerçekten bir öncekinin çıktısına bağlıysa onu `delegate_task after_task_id` ile zincirle.',
          '5. Sonuçlar gelince hepsini tek bir özet halinde birleştir ve bana ne yapıldığını söyle.',
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function Orchestrator({ teamAgents, teamLabel, onOpenTerminal }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lead = leadOf(teamAgents);
  const workers = teamAgents.filter((a) => a.config.id !== lead?.config.id).length;
  // Lider dağıtamıyorsa çubuk bir ORKESTRATÖR değil, doğrudan bir mesaj
  // kutusudur; "ekibe dağıt" demek yalan olurdu.
  const delegates = !!lead && canDelegate(lead);

  async function dispatch() {
    const request = text.trim();
    if (!request || !lead || busy) return;
    setBusy(true);
    setError('');
    try {
      // send() ölü oturumu kendiliğinden yeniden başlatır — liderin kapalı
      // olması ayrı bir "önce başlat" adımı gerektirmiyor.
      await api.sendMessage(lead.config.id, buildBrief(request, lead, teamAgents));
      setText('');
      onOpenTerminal(lead.config.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`orch${error ? ' has-error' : ''}`}>
      <div className="orch-lead">
        <span className="orch-scope">{teamLabel}</span>
        {lead ? (
          <>
            <span className={`led led-${lead.status}`} />
            <span className="orch-lead-name" title={`${lead.config.name} işi bölüp dağıtacak`}>
              {lead.config.name}
            </span>
            <span className="orch-lead-sub">
              {!delegates
                ? 'dağıtamaz — doğrudan bu ajana gider'
                : workers > 0
                  ? `+${workers} ajan`
                  : 'tek başına'}
            </span>
          </>
        ) : (
          <span className="orch-lead-sub">ajan yok</span>
        )}
      </div>

      <input
        className="orch-input"
        value={text}
        disabled={!lead}
        placeholder={
          !lead
            ? 'Bu takımda ajan yok.'
            : delegates
              ? `${teamLabel} takımına yüksek seviyeli bir iş ver — ${lead.config.name} bölüp dağıtsın…`
              : `${lead.config.name} ajanına doğrudan iş ver (bu takımda dağıtacak lider yok)…`
        }
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void dispatch();
          }
        }}
      />

      <button className="orch-go primary" disabled={!lead || !text.trim() || busy} onClick={() => void dispatch()}>
        {busy ? 'Gönderiliyor…' : delegates ? 'Ekibe dağıt' : 'Gönder'}
      </button>

      {error && <div className="orch-error">{error}</div>}
    </div>
  );
}
