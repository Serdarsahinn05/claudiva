/**
 * Çalışma alanı kabuğu: panel çerçevesi, yan yuvalar, döşeli orta yuva.
 *
 * Buradaki hiçbir bileşen ne gösterdiğini BİLMEZ — içeriği `children` olarak
 * alır. Yerleşim ile içerik ayrı durmazsa "Görevler paneli sağdadır" bilgisi
 * TaskBoard'un içine sızar ve paneli sola taşımak imkânsızlaşır.
 *
 * TAŞIMA BİRİNCİL OLARAK SÜRÜKLEMEDİR. Panel sekmesi ya da başlık çubuğu
 * tutulup üç yuvanın herhangi birine bırakılır; yuvalar sürükleme sürerken
 * kendilerini hedef olarak gösterir. Çerçevedeki küçük yerleştirme düğmeleri
 * KALDIRILMADI ama artık ikincil: sürükleme klavyeyle yapılamıyor, o yüzden
 * erişilebilir yol olarak duruyorlar ve yalnızca panelin ŞU AN BULUNMADIĞI
 * yuvalar için çiziliyorlar (bulunduğu yuva için devre dışı bir düğme
 * göstermek üç özdeş ikonu ayırt edilemez yapıyordu).
 */
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  DND_PANEL,
  DND_TERMINAL,
  gridCols,
  PANELS,
  type DockId,
  type DockState,
  type PanelId,
} from '../workspace';
import { L } from '../i18n';

/* ─────────────────────────────────────────────────────────── ikonlar
   Panel çerçevesindeki eylemler. 13px, tek renk, 1.6px çizgi — başlık
   çubuğundaki metinle aynı optik ağırlıkta dursunlar. */
const mini = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const I = {
  close: mini(<path d="M6 6l12 12M18 6L6 18" />),
  expand: mini(<><path d="M9 3H3v6" /><path d="M15 21h6v-6" /><path d="M3 3l7 7" /><path d="M21 21l-7-7" /></>),
  collapse: mini(<><path d="M3 9h6V3" /><path d="M21 15h-6v6" /><path d="M10 10L3 3" /><path d="M14 14l7 7" /></>),
  dockLeft: mini(<><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M9 4v16" /><rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" opacity="0.55" /></>),
  dockCenter: mini(<><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M8 4v16M16 4v16" /><rect x="8" y="4" width="8" height="16" fill="currentColor" stroke="none" opacity="0.55" /></>),
  dockRight: mini(<><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M15 4v16" /><rect x="15" y="4" width="6" height="16" fill="currentColor" stroke="none" opacity="0.55" /></>),
  chevL: mini(<path d="M15 6l-6 6 6 6" />),
  chevR: mini(<path d="M9 6l6 6-6 6" />),
};

const DOCK_LABEL: Record<DockId, string> = { left: L.dock.left, center: L.dock.center, right: L.dock.right };
const DOCK_ICON: Record<DockId, ReactNode> = { left: I.dockLeft, center: I.dockCenter, right: I.dockRight };

/* ═══════════════════════════════════════════════ sürükleme yardımcıları */

/** Sürüklenen yük bu hedefin kabul ettiği türlerden biri mi. */
function accepts(e: DragEvent, mimes: string[]): boolean {
  // `types` bir DOMStringList benzeri; `includes` her tarayıcıda yok.
  const types = Array.from(e.dataTransfer.types);
  return mimes.some((m) => types.includes(m));
}

/**
 * Bırakma bölgesi.
 *
 * `dragenter`/`dragleave` ÇOCUK öğelerde de tetiklenir: imleç yuvanın içinde
 * bir sekmeden ötekine geçerken "çıktı" olayı gelir ve vurgu titrer. Derinlik
 * sayacı bunu çözer — vurgu ancak sayaç sıfıra inince kalkar. `relatedTarget`
 * ile kontrol de olurdu ama gölge DOM ve metin düğümlerinde güvenilmez.
 */
function useDropZone(mimes: string[], onDrop: (e: DragEvent) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const reset = useCallback(() => {
    depth.current = 0;
    setOver(false);
  }, []);

  return {
    over,
    props: {
      onDragEnter: (e: DragEvent) => {
        if (!accepts(e, mimes)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      },
      onDragOver: (e: DragEvent) => {
        if (!accepts(e, mimes)) return;
        // preventDefault YOKSA tarayıcı bırakmayı reddeder ve imleç
        // "yasak" işareti gösterir — hedef görsel olarak aktif olsa bile.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: (e: DragEvent) => {
        if (!accepts(e, mimes)) return;
        if (--depth.current <= 0) reset();
      },
      onDrop: (e: DragEvent) => {
        if (!accepts(e, mimes)) return;
        e.preventDefault();
        e.stopPropagation();
        reset();
        onDrop(e);
      },
    },
  };
}

/** Sürükleme başlatma: yükü iki MIME'dan uygun olanına yazar. */
function startPanelDrag(e: DragEvent, id: PanelId) {
  e.dataTransfer.setData(DND_PANEL, id);
  e.dataTransfer.effectAllowed = 'move';
}
function startTerminalDrag(e: DragEvent, key: string) {
  e.dataTransfer.setData(DND_TERMINAL, key);
  e.dataTransfer.effectAllowed = 'move';
}

/* ═══════════════════════════════════════════════════ panel çerçevesi */

interface FrameProps {
  title: string;
  hint?: string;
  /** Başlığın sağında duran serbest içerik (rozet, model, sayaç…). */
  badge?: ReactNode;
  /** Paneli başka yuvaya taşır; verilmezse yerleştirme düğmeleri çıkmaz. */
  onDock?: (to: DockId) => void;
  currentDock?: DockId;
  onClose?: () => void;
  onToggleMax?: () => void;
  maximized?: boolean;
  /** Tek gözün odakta olması (orta yuvada kenarlığı vurgulanır). */
  focused?: boolean;
  onFocus?: () => void;
  /** Başlık çubuğundan sürükleme başlatır. */
  onDragStart?: (e: DragEvent) => void;
  /** Başlık çubuğu bir bırakma hedefiyse (orta yuvada sıralama). */
  dropProps?: Record<string, unknown>;
  dropOver?: boolean;
  children: ReactNode;
}

export function PanelFrame({
  title, hint, badge, onDock, currentDock, onClose, onToggleMax, maximized,
  focused, onFocus, onDragStart, dropProps, dropOver, children,
}: FrameProps) {
  const draggable = !!onDragStart;
  return (
    <section className={`pf${focused ? ' focused' : ''}${dropOver ? ' drop-over' : ''}`} onMouseDown={onFocus}>
      <header
        className={`pf-bar${draggable ? ' draggable' : ''}`}
        draggable={draggable}
        onDragStart={onDragStart}
        {...dropProps}
      >
        {draggable && <span className="pf-grip" aria-hidden="true">⋮⋮</span>}
        <span className="pf-title">{title}</span>
        {hint && <span className="pf-hint">{hint}</span>}
        <span className="pf-badge">{badge}</span>
        {/* Eylemler sürüklemeyi başlatmasın: düğmeye basıp hafifçe kaydırmak
            çubuğu sürüklemeye çevirip tıklamayı yutuyordu. */}
        <div className="pf-acts" draggable={false} onDragStart={(e) => e.preventDefault()}>
          {onDock &&
            (['left', 'center', 'right'] as DockId[])
              .filter((d) => d !== currentDock)
              .map((d) => (
                <button
                  key={d}
                  className="pf-act"
                  onClick={() => onDock(d)}
                  title={L.dock.moveTo(DOCK_LABEL[d])}
                  aria-label={L.dock.moveTo(DOCK_LABEL[d])}
                >
                  {DOCK_ICON[d]}
                </button>
              ))}
          {onToggleMax && (
            <button className="pf-act" onClick={onToggleMax} title={maximized ? L.dock.minimize : L.dock.maximize}
                    aria-label={maximized ? L.dock.minimize : L.dock.maximize}>
              {maximized ? I.collapse : I.expand}
            </button>
          )}
          {onClose && (
            <button className="pf-act danger" onClick={onClose} title="Kapat" aria-label="Kapat">
              {I.close}
            </button>
          )}
        </div>
      </header>
      <div className="pf-body">{children}</div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ yan yuva */

interface SideProps {
  side: 'left' | 'right';
  dock: DockState;
  /** Aktif panelin gövdesi. */
  render: (id: PanelId) => ReactNode;
  onActivate: (id: PanelId) => void;
  onToggle: () => void;
  onWidth: (w: number) => void;
  /** `index` verilirse panel o sekme konumuna sokulur. */
  onDock: (id: PanelId, to: DockId, index?: number) => void;
  onClose: (id: PanelId) => void;
  /** Panel başına rozet (ör. bekleyen izin sayısı). */
  badgeOf?: (id: PanelId) => ReactNode;
}

export function SideDock({
  side, dock, render, onActivate, onToggle, onWidth, onDock, onClose, badgeOf,
}: SideProps) {
  const active = dock.active;
  /** Hangi sekme aralığına bırakılacak (görsel çizgi). */
  const [dropAt, setDropAt] = useState<number | null>(null);

  // Yan yuva terminal KABUL ETMEZ: 300px'lik bir sütunda döküm okunmaz.
  const zone = useDropZone([DND_PANEL], (e) => {
    const id = e.dataTransfer.getData(DND_PANEL) as PanelId;
    if (id) onDock(id, side, dropAt ?? undefined);
    setDropAt(null);
  });

  /** Daraltılmış yuva da hedef olmalı — açmak için önce açmak gerekmesin. */
  if (!dock.open || dock.panels.length === 0) {
    return (
      <button
        className={`dock-stub ${side}${zone.over ? ' drop-over' : ''}`}
        onClick={onToggle}
        title={dock.panels.length ? L.dock.open(side === 'left') : L.dock.dragHere}
        {...zone.props}
      >
        {side === 'left' ? I.chevR : I.chevL}
        <span className="dock-stub-label">
          {dock.panels.map((p) => PANELS[p].title).join(' · ') || L.dock.dragHereShort}
        </span>
      </button>
    );
  }

  return (
    <>
      {side === 'right' && <Splitter side={side} width={dock.width} onWidth={onWidth} />}
      <aside
        className={`dock ${side}${zone.over ? ' drop-over' : ''}`}
        style={{ width: dock.width, minWidth: dock.width }}
        {...zone.props}
        onDragLeave={(e) => {
          zone.props.onDragLeave(e);
          setDropAt(null);
        }}
      >
        <nav className="dock-tabs">
          {dock.panels.map((p, i) => (
            <button
              key={p}
              className={`dock-tab${active === p ? ' sel' : ''}${dropAt === i ? ' drop-before' : ''}`}
              onClick={() => onActivate(p)}
              title={L.dock.dragToMove(PANELS[p].hint)}
              draggable
              onDragStart={(e) => startPanelDrag(e, p)}
              onDragOver={(e) => {
                if (!accepts(e, [DND_PANEL])) return;
                e.preventDefault();
                // İmleç sekmenin sol yarısındaysa öne, sağ yarısındaysa arkaya.
                const r = e.currentTarget.getBoundingClientRect();
                setDropAt(e.clientX < r.left + r.width / 2 ? i : i + 1);
              }}
            >
              {PANELS[p].title}
              {badgeOf?.(p)}
            </button>
          ))}
          {/* Sekmelerin sağındaki boşluk: sona bırakma hedefi */}
          <span
            className={`dock-tab-end${dropAt === dock.panels.length ? ' drop-before' : ''}`}
            onDragOver={(e) => {
              if (!accepts(e, [DND_PANEL])) return;
              e.preventDefault();
              setDropAt(dock.panels.length);
            }}
          />
          <button className="dock-collapse" onClick={onToggle} title={L.dock.collapse} aria-label={L.dock.collapse}>
            {side === 'left' ? I.chevL : I.chevR}
          </button>
        </nav>

        {active && (
          <PanelFrame
            title={PANELS[active].title}
            hint={PANELS[active].hint}
            currentDock={side}
            onDock={(to) => onDock(active, to)}
            onClose={() => onClose(active)}
            onDragStart={(e) => startPanelDrag(e, active)}
          >
            {render(active)}
          </PanelFrame>
        )}

        {zone.over && <div className="dock-drop-hint">{side === 'left' ? L.dock.left : L.dock.right}</div>}
      </aside>
      {side === 'left' && <Splitter side={side} width={dock.width} onWidth={onWidth} />}
    </>
  );
}

/**
 * Sürüklenebilir ayırıcı.
 *
 * Fare olayları `window`a bağlanır, tutamağın kendisine DEĞİL: hızlı sürükleyişte
 * imleç tutamağın dışına çıkar ve öğeye bağlı bir dinleyici olayı kaçırır —
 * boyutlandırma sürükleme ortasında donardı. `setPointerCapture` da işi görürdü
 * ama iki yuva için aynı davranışı window üzerinden kurmak daha az özel durum
 * bırakıyor.
 */
function Splitter({ side, width, onWidth }: { side: 'left' | 'right'; width: number; onWidth: (w: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const dx = e.clientX - startX.current;
      onWidth(side === 'left' ? startW.current + dx : startW.current - dx);
    },
    [side, onWidth],
  );

  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', up);
    // Sürükleme sırasında metin seçimi imleci "yasak" işaretine çeviriyordu.
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragging, onMove]);

  return (
    <div
      className={`splitter${dragging ? ' on' : ''}`}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onMouseDown={(e) => {
        startX.current = e.clientX;
        startW.current = width;
        setDragging(true);
      }}
      onKeyDown={(e) => {
        // Klavyeyle de boyutlandırılabilsin: ok tuşları 16px adımla.
        if (e.key === 'ArrowLeft') onWidth(side === 'left' ? width - 16 : width + 16);
        if (e.key === 'ArrowRight') onWidth(side === 'left' ? width + 16 : width - 16);
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════ orta döşeme */

export interface CenterTile {
  key: string;
  title: string;
  hint?: string;
  badge?: ReactNode;
  body: ReactNode;
  /** Panel gözlerinde taşıma menüsü ve panel sürüklemesi var. */
  panelId?: PanelId;
}

interface CenterProps {
  tiles: CenterTile[];
  maximized: string | null;
  focused: string | null;
  onFocus: (key: string) => void;
  onToggleMax: (key: string) => void;
  onClose: (key: string) => void;
  onDock: (id: PanelId, to: DockId, index?: number) => void;
  /** Göz sıralaması (terminal ya da panel gözü). */
  onMoveTile: (key: string, toIndex: number) => void;
  empty: ReactNode;
}

export function CenterGrid({
  tiles, maximized, focused, onFocus, onToggleMax, onClose, onDock, onMoveTile, empty,
}: CenterProps) {
  /** Bir gözün başlığına bırakılırsa o gözün konumuna girer. */
  const [dropKey, setDropKey] = useState<string | null>(null);

  /**
   * Izgaranın boş zemini: sona bırakır. Panel de terminal de kabul edilir —
   * çalışma alanı ikisinin de doğal yeri.
   */
  const zone = useDropZone([DND_PANEL, DND_TERMINAL], (e) => {
    const panel = e.dataTransfer.getData(DND_PANEL) as PanelId;
    const term = e.dataTransfer.getData(DND_TERMINAL);
    if (panel) onDock(panel, 'center');
    else if (term) onMoveTile(term, tiles.length);
    setDropKey(null);
  });

  // Sınıf adı `workarea`, `center` DEĞİL: `center` bu projede eski bir
  // yardımcı sınıf (`text-align: center`) ve orta yuvaya verildiğinde
  // terminal dökümünün tamamını ortalıyordu — miras alınan bir hizalama
  // olduğu için de bileşenlerin hiçbirinde görünmüyordu.
  if (tiles.length === 0) {
    return (
      <main className={`workarea is-empty${zone.over ? ' drop-over' : ''}`} {...zone.props}>
        {empty}
      </main>
    );
  }

  const shown = maximized ? tiles.filter((t) => t.key === maximized) : tiles;
  const cols = gridCols(shown.length);

  /** Bir gözün başlık çubuğuna bırakma: o gözün sırasına yerleş. */
  const tileDrop = (index: number, key: string) => ({
    onDragEnter: (e: DragEvent) => {
      if (!accepts(e, [DND_PANEL, DND_TERMINAL])) return;
      e.preventDefault();
      setDropKey(key);
    },
    onDragOver: (e: DragEvent) => {
      if (!accepts(e, [DND_PANEL, DND_TERMINAL])) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDragLeave: () => setDropKey((k) => (k === key ? null : k)),
    onDrop: (e: DragEvent) => {
      if (!accepts(e, [DND_PANEL, DND_TERMINAL])) return;
      e.preventDefault();
      e.stopPropagation();
      setDropKey(null);
      const panel = e.dataTransfer.getData(DND_PANEL) as PanelId;
      const term = e.dataTransfer.getData(DND_TERMINAL);
      if (panel) onDock(panel, 'center', index);
      else if (term && term !== key) onMoveTile(term, index);
    },
  });

  return (
    <main
      className={`workarea${zone.over ? ' drop-over' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      {...zone.props}
    >
      {shown.map((t, i) => (
        <PanelFrame
          key={t.key}
          title={t.title}
          hint={t.hint}
          badge={t.badge}
          currentDock={t.panelId ? 'center' : undefined}
          onDock={t.panelId ? (to) => onDock(t.panelId!, to) : undefined}
          onDragStart={(e) =>
            t.panelId ? startPanelDrag(e, t.panelId) : startTerminalDrag(e, t.key)
          }
          dropProps={tileDrop(i, t.key)}
          dropOver={dropKey === t.key}
          focused={tiles.length > 1 && focused === t.key}
          onFocus={() => onFocus(t.key)}
          maximized={maximized === t.key}
          onToggleMax={tiles.length > 1 ? () => onToggleMax(t.key) : undefined}
          onClose={() => onClose(t.key)}
        >
          {t.body}
        </PanelFrame>
      ))}
    </main>
  );
}
