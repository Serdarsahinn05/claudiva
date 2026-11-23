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
import { canDelegate, leadOf } from '../teams';
import { buildBrief } from '../brief';
import { L } from '../i18n';

interface Props {
  /** Seçili takımın ajanları — dağıtım havuzu budur. */
  teamAgents: AgentSnapshot[];
  teamLabel: string;
  /** Komut gönderilince liderin terminalini aç. */
  onOpenTerminal: (agentId: string) => void;
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
            <span className="orch-lead-name" title={L.orch.leadTitle(lead.config.name)}>
              {lead.config.name}
            </span>
            <span className="orch-lead-sub">
              {!delegates
                ? L.orch.cannotDelegate
                : workers > 0
                  ? L.orch.plusAgents(workers)
                  : L.orch.alone}
            </span>
          </>
        ) : (
          <span className="orch-lead-sub">{L.orch.noAgents}</span>
        )}
      </div>

      <input
        className="orch-input"
        value={text}
        disabled={!lead}
        placeholder={
          !lead
            ? L.orch.teamEmpty
            : delegates
              ? L.orch.placeholderTeam(teamLabel, lead.config.name)
              : L.orch.placeholderDirect(lead.config.name)
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
        {busy ? L.common.sending : delegates ? L.orch.dispatch : L.common.send}
      </button>

      {error && <div className="orch-error">{error}</div>}
    </div>
  );
}
