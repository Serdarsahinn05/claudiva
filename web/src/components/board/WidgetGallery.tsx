/**
 * Widget galerisi: her widget küçük bir şematik önizlemeyle seçilir.
 *
 * Önizleme gerçek widget'ı çizmez (veri yüklemesi, ağ isteği, ölçü sorunu);
 * widget'ın biçimini taklit eden token renkli ilkellerdir: satır, çubuk,
 * büyük sayı, giriş kutusu, nokta. Renkler o anki temadan gelir, bu yüzden
 * galeri panoda göreceğin renkle aynıdır.
 */
import { Modal } from '../Modal';
import { WIDGET_GROUPS, type Widget, type WidgetType } from '../../board';
import { L } from '../../i18n';

function Thumb({ type }: { type: WidgetType }) {
  const rows = (n: number, dot = false) =>
    Array.from({ length: n }, (_, i) => (
      <span key={i} className="wt-row">
        {dot && <i className={i === 0 ? 'live' : ''} />}
        <b style={{ width: `${70 - i * 9}%` }} />
      </span>
    ));
  switch (type) {
    case 'compose':
      return (
        <>
          <span className="wt-box" />
          <span className="wt-btn" />
        </>
      );
    case 'flow':
    case 'activity':
      return <>{rows(4, type === 'flow')}</>;
    case 'approvals':
      return (
        <>
          {[0, 1].map((i) => (
            <span key={i} className="wt-row">
              <b style={{ width: '48%' }} />
              <span className="wt-btn sm" />
              <span className="wt-btn sm ghost" />
            </span>
          ))}
        </>
      );
    case 'actions':
      return (
        <span className="wt-grid2">
          <span className="wt-btn ghost" />
          <span className="wt-btn ghost" />
          <span className="wt-btn" />
          <span className="wt-btn ghost" />
        </span>
      );
    case 'agents':
      return (
        <span className="wt-grid2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="wt-card">
              <i className={i === 1 ? 'live' : ''} />
              <b />
            </span>
          ))}
        </span>
      );
    case 'tokens':
      return (
        <>
          {[92, 64, 40, 22].map((w) => (
            <span key={w} className="wt-hbar">
              <b style={{ width: `${w}%` }} />
            </span>
          ))}
        </>
      );
    case 'stats':
      return (
        <span className="wt-nums">
          <em>3</em>
          <em className="aux">1</em>
          <em>0</em>
          <em className="ok">4</em>
        </span>
      );
    case 'budget':
      return (
        <>
          <em className="wt-big">$1.20</em>
          <span className="wt-gauge">
            <b style={{ width: '38%' }} />
          </span>
        </>
      );
    case 'cost':
      return (
        <span className="wt-bars">
          {[30, 55, 20, 70, 45, 85, 60].map((h, i) => (
            <b key={i} className={i === 6 ? 'today' : ''} style={{ height: `${h}%` }} />
          ))}
        </span>
      );
    case 'quota':
      return (
        <>
          {[42, 71].map((w) => (
            <span key={w} className="wt-gauge">
              <b style={{ width: `${w}%` }} />
            </span>
          ))}
        </>
      );
    case 'changes':
      return (
        <>
          {['M', 'A', 'M'].map((m, i) => (
            <span key={i} className="wt-row">
              <span className="wt-mark">{m}</span>
              <b style={{ width: `${60 - i * 12}%` }} />
            </span>
          ))}
        </>
      );
    case 'system':
      return (
        <>
          <span className="wt-gauge">
            <b style={{ width: '62%' }} />
          </span>
          {rows(2)}
        </>
      );
    case 'notes':
      return <span className="wt-box tall">{rows(3)}</span>;
    case 'heatmap':
      return (
        <span className="wt-heat">
          {[0, 1, 2, 3, 1, 0, 2, 4, 3, 2, 0, 1, 3, 4, 1, 2, 1, 0, 2, 3, 4].map((l, i) => (
            <b key={i} className={`l${l}`} />
          ))}
        </span>
      );
    case 'dial':
      return (
        <span className="wt-dial">
          <b />
        </span>
      );
    case 'network':
      return (
        <span className="wt-net">
          <i className="live" />
          <span>
            <i />
            <i className="live" />
            <i />
          </span>
        </span>
      );
  }
}

interface Props {
  board: Widget[];
  onAdd: (type: WidgetType) => void;
  onClose: () => void;
}

export function WidgetGallery({ board, onAdd, onClose }: Props) {
  const have = new Set(board.map((w) => w.type));
  return (
    <Modal onClose={onClose} wide>
      <div className="modal-head">
        <h2>{L.board.gallery}</h2>
        <span className="modal-sub">{L.board.gallerySub}</span>
      </div>
      <div className="modal-pane">
        {WIDGET_GROUPS.map((g) => (
          <div key={g.key}>
            <div className="theme-group-label">{L.board.groups[g.key]}</div>
            <div className="wg-grid">
              {g.types.map((t) => {
                const on = have.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`wg-card${on ? ' on' : ''}`}
                    disabled={on}
                    onClick={() => onAdd(t)}
                  >
                    <span className={`wt wt-${t}`} aria-hidden="true">
                      <Thumb type={t} />
                    </span>
                    <span className="wg-name">
                      {L.board.w[t].title}
                      <span className={`wg-state${on ? ' on' : ''}`}>{on ? L.board.onBoard : `+ ${L.board.add}`}</span>
                    </span>
                    <span className="wg-desc">{L.board.w[t].desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button onClick={onClose}>{L.common.close}</button>
      </div>
    </Modal>
  );
}
