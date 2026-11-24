/**
 * Pano modu: özelleştirilebilir widget ızgarası (üçüncü arayüz modu).
 *
 * Paneller ve Sohbet gibi yalnız GÖRÜNÜMDÜR (uiMode.ts): aynı store'u okur,
 * sunucuya yeni uç eklemez. Kartlar buzlu cam: arkadaki ışık lekelerini
 * bulanıklaştırır; renkleri tema token'larından gelir, Fosfor'da limon.
 *
 * Yerleşim (ilk sürümde "hizalamak ve yer değiştirmek çok zor" bulundu):
 *  · Ayrı bir düzenleme kipi YOK. Başlıktaki tutamaktan (⠿) sürüklenir;
 *    sürüklerken kartlar CANLI yer değiştirir (imlecin girdiği kartın
 *    soluna/sağına), bırakmadan sonucu görürsün.
 *  · Sağ alt köşeden sürüklemek genişliği ve yüksekliği birlikte değiştirir,
 *    ızgaraya yapışır (board.ts: 12 sütun, sabit satır).
 *  · Klavye: tutamak odaklıyken ← → taşır, Shift + oklar boyutlandırır.
 *
 * Tuzaklar (ölçüldü): kartın sınıfı `w-<tür>`, `bw-<tür>` DEĞİL — `bw-stats`
 * gibi adlar widget'ın İÇİNDEKİ ızgaralar, kart onları miras alınca ikiye
 * bölündü. Başlık `div`, `header` değil: genel header kuralı karta bant çekti.
 * Sürükleme HTML5 sürükle-bırak DEĞİL, işaretçi (pointer) olaylarıyla: HTML5
 * yolu sentetik fare olaylarıyla tetiklenmedi (sıra hiç değişmedi) ve
 * dokunmatikte hiç çalışmaz. Hedef, imlecin altındaki kart
 * (`elementsFromPoint`, sürüklenen kart hariç).
 */
import { useEffect, useRef, useState } from 'react';
import type { AgentSnapshot, BudgetState, PermissionRequestInfo, Task, TranscriptEvent } from '../../types';
import {
  DEFAULT_BOARD,
  GAP_PX,
  ROW_PX,
  loadBoard,
  moveWidget,
  newWidget,
  resized,
  sameOrder,
  saveBoard,
  type Widget,
  type WidgetType,
} from '../../board';
import { WIDGETS } from './widgets';
import { WidgetGallery } from './WidgetGallery';
import { L } from '../../i18n';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  budget: BudgetState | null;
  transcripts: Record<string, TranscriptEvent[]>;
  permissions: PermissionRequestInfo[];
  teamLabel: string;
  onOpenSettings: () => void;
  refreshAgents: () => Promise<void>;
  loadTranscript: (id: string) => Promise<void>;
}

export function BoardShell(props: Props) {
  const [board, setBoard] = useState<Widget[]>(loadBoard);
  const [gallery, setGallery] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sizing, setSizing] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveBoard(board), [board]);

  const waiting = props.agents.reduce((n, a) => n + a.pendingPermissions.length, 0);
  const online = props.agents.filter((a) => a.status !== 'offline').length;

  function add(type: WidgetType) {
    setBoard((b) => (b.some((x) => x.type === type) ? b : [...b, newWidget(type)]));
    setGallery(false);
  }
  const patch = (id: string, f: (w: Widget) => Widget) => setBoard((b) => b.map((x) => (x.id === id ? f(x) : x)));
  const remove = (id: string) => setBoard((b) => b.filter((x) => x.id !== id));

  /**
   * Tutamaktan sürükleme: imlecin altındaki kartın hangi yarısındaysan
   * sürüklenen kart oraya geçer (canlı). Küçük bir eşik, tıklamayı
   * (klavye odağı) sürüklemeden ayırır.
   */
  function startDrag(e: React.PointerEvent, w: Widget) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* sentetik işaretçi: yakalama yok, olaylar yine gelir */
    }
    const x0 = e.clientX;
    const y0 = e.clientY;
    let active = false;
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        active = true;
        setDragId(w.id);
      }
      const over = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .map((n) => (n as HTMLElement).closest<HTMLElement>('.bw[data-wid]'))
        .find((n) => n && n.dataset.wid !== w.id);
      if (!over) return;
      const r = over.getBoundingClientRect();
      const after = ev.clientX > r.left + r.width / 2;
      const target = over.dataset.wid!;
      setBoard((b) => {
        const next = moveWidget(b, w.id, target, after);
        return sameOrder(next, b) ? b : next;
      });
    };
    const up = (ev: PointerEvent) => {
      // Bırakılan yer de değerlendirilir: hızlı bir hareket son pointermove'u
      // hedefin yarısına varmadan bitirebilir (ölçüldü: kart bir önceki yere düştü).
      if (active && ev.type === 'pointerup') move(ev);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      setDragId(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Köşeden boyutlandırma: imleç farkı ızgara birimine yuvarlanır. */
  function startResize(e: React.PointerEvent, w: Widget) {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const colW = (grid.clientWidth - GAP_PX * 11) / 12 + GAP_PX;
    const rowH = ROW_PX + GAP_PX;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const start = { w: w.w, h: w.h };
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* sentetik işaretçi: yakalama yok, olaylar yine gelir */
    }
    setSizing(w.id);
    const move = (ev: PointerEvent) =>
      patch(w.id, (x) => resized(x, start.w + (ev.clientX - x0) / colW, start.h + (ev.clientY - y0) / rowH));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      setSizing(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Klavye yedeği: ← → taşı, Shift + oklar boyutlandır. */
  function onGripKey(e: React.KeyboardEvent, w: Widget, i: number) {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return;
    e.preventDefault();
    if (e.shiftKey) {
      const dw = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      const dh = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
      patch(w.id, (x) => resized(x, x.w + dw, x.h + dh));
      return;
    }
    const j = k === 'ArrowLeft' || k === 'ArrowUp' ? i - 1 : i + 1;
    if (j < 0 || j >= board.length) return;
    setBoard((b) => moveWidget(b, w.id, b[j].id, j > i));
  }

  const data = {
    agents: props.agents,
    tasks: props.tasks,
    budget: props.budget,
    transcripts: props.transcripts,
    permissions: props.permissions,
    onOpenSettings: props.onOpenSettings,
    refreshAgents: props.refreshAgents,
    loadTranscript: props.loadTranscript,
  };

  return (
    <main className={`board${dragId ? ' dragging' : ''}${sizing ? ' sizing' : ''}`}>
      <div className="board-bar">
        <div className="board-title">
          <h2>{L.board.title}</h2>
          <span className="board-scope">{props.teamLabel}</span>
        </div>
        <span className="board-status">
          <i className={online ? 'on' : ''} aria-hidden="true" />
          {L.board.status(online, props.agents.length)}
          {waiting > 0 && <b className="board-wait">{L.board.waiting(waiting)}</b>}
        </span>
        <div className="board-tools">
          <button onClick={() => setBoard(DEFAULT_BOARD)} title={L.board.resetTitle}>
            {L.board.reset}
          </button>
          <button className="primary" onClick={() => setGallery(true)}>
            + {L.board.addWidget}
          </button>
        </div>
      </div>

      {board.length ? (
        <div className="board-grid" ref={gridRef} style={{ gridAutoRows: `${ROW_PX}px`, gap: `${GAP_PX}px` }}>
          {board.map((w, i) => {
            const Body = WIDGETS[w.type];
            return (
              <section
                key={w.id}
                className={`bw w-${w.type}${dragId === w.id ? ' dragging' : ''}${sizing === w.id ? ' sizing' : ''}`}
                data-wid={w.id}
                style={{ gridColumn: `span ${w.w}`, gridRow: `span ${w.h}` }}
              >
                <div className="bw-head">
                  <button
                    className="bw-grip"
                    title={`${L.board.drag} · ← → · Shift + ←↑↓→`}
                    aria-label={`${L.board.w[w.type].title}: ${L.board.drag}`}
                    onPointerDown={(e) => startDrag(e, w)}
                    onKeyDown={(e) => onGripKey(e, w, i)}
                  >
                    ⠿
                  </button>
                  <span className="bw-title">{L.board.w[w.type].title}</span>
                  {sizing === w.id && (
                    <span className="bw-size">
                      {w.w}×{w.h}
                    </span>
                  )}
                  <button className="bw-close" onClick={() => remove(w.id)} aria-label={L.board.remove} title={L.board.remove}>
                    ×
                  </button>
                </div>
                <div className="bw-body">
                  <Body {...data} />
                </div>
                <span
                  className="bw-resize"
                  title={L.board.resizeHandle}
                  aria-hidden="true"
                  onPointerDown={(e) => startResize(e, w)}
                />
              </section>
            );
          })}
        </div>
      ) : (
        <div className="board-empty">
          <h3>{L.board.emptyTitle}</h3>
          <p>{L.board.emptyBody}</p>
          <button className="primary" onClick={() => setBoard(DEFAULT_BOARD)}>
            {L.board.reset}
          </button>
        </div>
      )}

      {gallery && <WidgetGallery board={board} onAdd={add} onClose={() => setGallery(false)} />}
    </main>
  );
}
