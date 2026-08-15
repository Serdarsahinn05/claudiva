/**
 * Sol kenar şeridi: panel fırlatıcı + ekip listesi.
 *
 * Eskiden burası SEKME İNDEKSİYDİ — bir ad seçince ekranın tamamı değişirdi.
 * Artık öyle değil: bu şerit hiçbir şeyi değiştirmez, GÖSTERİR ve GİZLER.
 * Bir panel adına basmak onu görünür kılar, ikinci basış kapatır; ekranın
 * geri kalanı yerinde durur.
 *
 * Ekip listesi buraya taşındı ve kalıcılaştı. Önceden yalnızca Terminal
 * plakasında görünüyordu, çünkü tek terminal vardı ve "hangi ajan" bir
 * seçimdi. Artık terminaller döşeli: bir ada basmak SEÇMEZ, ORTAYA BİR GÖZ
 * AÇAR — liste bir seçici değil, bir açma aracı. Bu yüzden hep elin altında.
 */
import { fmtNum, totalTokens } from '../format';
import type { AgentSnapshot } from '../types';
import { PANEL_IDS, PANELS, type PanelId } from '../workspace';

interface Props {
  /** Şu an ekranda görünen paneller. */
  visible: Set<PanelId>;
  onTogglePanel: (id: PanelId) => void;
  /** Panel başına rozet (ör. bekleyen izin). */
  panelBadge?: (id: PanelId) => number | undefined;

  agents: AgentSnapshot[];
  /** Terminali orta yuvada açık olan ajanlar. */
  openTerminals: Set<string>;
  onOpenTerminal: (agentId: string) => void;

  /** Sürükleyerek sıralama — sunucuya yazılır. */
  onReorder: (id: string, delta: number) => void;
  dragId: string | null;
  dropIndex: number | null;
  onDragState: (dragId: string | null, dropIndex: number | null) => void;
  onCommitReorder: (toIndex: number) => void;

  foot?: string;
}

export function Rail({
  visible, onTogglePanel, panelBadge,
  agents, openTerminals, onOpenTerminal,
  onReorder, dragId, dropIndex, onDragState, onCommitReorder,
  foot,
}: Props) {
  return (
    <nav className="rail" aria-label="Paneller ve ekip">
      <div className="rail-sec">Paneller</div>
      {PANEL_IDS.map((id) => {
        const on = visible.has(id);
        const badge = panelBadge?.(id);
        return (
          <button
            key={id}
            className={`rail-btn${on ? ' active' : ''}`}
            onClick={() => onTogglePanel(id)}
            title={`${PANELS[id].title} — ${PANELS[id].hint}`}
            aria-pressed={on}
          >
            <span className="rail-label">{PANELS[id].title}</span>
            {badge ? <span className="rail-badge">{badge}</span> : null}
          </button>
        );
      })}

      <div className="rail-sec rail-sec-2">
        Ekip
        <span className="rail-sec-hint">{agents.length}</span>
      </div>

      <div className="agent-list">
        {agents.map((a, i) => {
          const open = openTerminals.has(a.config.id);
          return (
            <div
              key={a.config.id}
              className={
                `agent-row${open ? ' selected' : ''}` +
                (dragId === a.config.id ? ' dragging' : '') +
                (dropIndex === i && dragId && dragId !== a.config.id ? ' drop-target' : '')
              }
              onClick={() => onOpenTerminal(a.config.id)}
              role="button"
              tabIndex={0}
              title={open ? `${a.config.name} terminali açık` : `${a.config.name} terminalini aç`}
              draggable
              onDragStart={(e) => {
                onDragState(a.config.id, null);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                onDragState(dragId, i);
              }}
              onDragEnd={() => onDragState(null, null)}
              onDrop={(e) => {
                e.preventDefault();
                onCommitReorder(i);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenTerminal(a.config.id);
                  return;
                }
                if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                  e.preventDefault();
                  onReorder(a.config.id, e.key === 'ArrowUp' ? -1 : 1);
                }
              }}
            >
              <span className="agent-grip" aria-hidden="true">⋮⋮</span>
              <span className={`led led-${a.status}`} />
              <span className="agent-row-name">{a.config.name}</span>
              {a.pendingPermissions.length > 0 && <span className="badge warn">!</span>}
              <span className="agent-row-tokens">{fmtNum(totalTokens(a.usage))}</span>
            </div>
          );
        })}
        {agents.length === 0 && <div className="muted center rail-empty">Bu takımda ajan yok.</div>}
      </div>

      {foot && (
        <div className="rail-foot" title={foot}>
          {foot.split(/[\\/]/).filter(Boolean).slice(-1)[0] ?? foot}
        </div>
      )}
    </nav>
  );
}

/* --- ikonlar: tek renk, 1.5px çizgi. Yalnızca başlık çubuğunda kullanılır. --- */
const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const ICONS = {
  settings: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>),
  /* baskı plakası: köşeleri registrasyon artılı çerçeve + üç kadir noktası */
  plate: svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="0.5" /><path d="M3.5 8h17M7 4.5v15" /><circle cx="13" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="17" cy="15.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="10" r="0.7" fill="currentColor" stroke="none" /></>),
  /* yerleşimi varsayılana döndür: üç yuvalı ızgara + geri oku */
  layout: svg(<><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M8 4v16M16 4v16" /></>),
};
