/**
 * Yerleşim eylemleri.
 *
 * `workspace.ts` yerleşimin ŞEKLİNİ tanımlar, burası onu DEĞİŞTİREN tek yer.
 * Her eylem yeni bir Layout üretir ve diske yazar; bileşenler yerleşimi asla
 * doğrudan kurcalamaz — bir paneli taşımanın "listeden çıkar + öbürüne ekle +
 * eski yuvanın aktifini tazele" üç adımı tek yerde durmazsa er geç bir çağıran
 * üçüncüsünü unutur ve boş bir yuva bırakır.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampWidth,
  dockOf,
  insertAt,
  loadLayout,
  moveWithin,
  saveLayout,
  tileKey,
  type DockId,
  type DockState,
  type Layout,
  type PanelId,
  type Tile,
} from './workspace';

/** Bir yuvadan paneli çıkarır ve aktifi tazeler. */
function without(d: DockState, id: PanelId): DockState {
  const panels = d.panels.filter((p) => p !== id);
  return { ...d, panels, active: d.active === id ? panels[0] ?? null : d.active };
}

/** Bir yuvaya paneli ekler (zaten varsa yalnızca öne getirir) ve yuvayı açar. */
function with_(d: DockState, id: PanelId, index?: number): DockState {
  const panels = d.panels.includes(id) ? d.panels : insertAt(d.panels, id, index);
  return { ...d, panels, active: id, open: true };
}

export interface LayoutApi {
  layout: Layout;
  /**
   * Paneli hedef yuvaya taşır; hangi yuvada olduğunu bilmek gerekmez.
   * `index` verilirse o konuma sokulur (sürükleyip iki sekme arasına
   * bırakmak); verilmezse sona eklenir.
   */
  movePanel: (id: PanelId, to: DockId, index?: number) => void;
  /** Çalışma alanındaki bir gözü yeni sıraya taşır (döşeme düzeni). */
  moveTile: (key: string, toIndex: number) => void;
  /** Paneli yerleşimden tamamen çıkarır. */
  closePanel: (id: PanelId) => void;
  /** Panel kapalıysa açar, açıksa o yuvada öne getirir. */
  showPanel: (id: PanelId) => void;
  setActive: (dock: 'left' | 'right', id: PanelId) => void;
  toggleDock: (dock: 'left' | 'right') => void;
  setDockWidth: (dock: 'left' | 'right', w: number) => void;
  /** Ajanın terminalini orta yuvada açar (açıksa yalnızca odaklar). */
  openTerminal: (agentId: string) => void;
  closeTile: (key: string) => void;
  toggleMaximize: (key: string) => void;
  reset: () => void;
}

export function useLayout(): LayoutApi {
  const [layout, setLayout] = useState<Layout>(loadLayout);

  // Yazma her tuş vuruşunda değil, oturum boyunca değişimlerde olur; yine de
  // sürükleyerek boyutlandırma saniyede onlarca güncelleme üretir, o yüzden
  // diske yazım bir sonraki boş kareye ertelenir.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => saveLayout(layout), 250);
    return () => window.clearTimeout(timer.current);
  }, [layout]);

  const movePanel = useCallback((id: PanelId, to: DockId, index?: number) => {
    setLayout((l) => {
      const from = dockOf(l, id);

      // Aynı yuva içinde SIRALAMA. Erken dönüş burada olamaz: sürükleyip
      // aynı yuvadaki başka bir sekmenin yanına bırakmak geçerli bir istek
      // ve eskiden sessizce yok sayılıyordu.
      if (from === to && index !== undefined) {
        if (to === 'center') {
          const cur = l.center.tiles.findIndex((t) => t.kind === 'panel' && t.id === id);
          return { ...l, center: { ...l.center, tiles: moveWithin(l.center.tiles, cur, index) } };
        }
        const d = l[to];
        return { ...l, [to]: { ...d, panels: moveWithin(d.panels, d.panels.indexOf(id), index) } };
      }
      if (from === to) return l;

      const next: Layout = {
        left: without(l.left, id),
        right: without(l.right, id),
        center: {
          ...l.center,
          tiles: l.center.tiles.filter((t) => !(t.kind === 'panel' && t.id === id)),
        },
      };
      if (to === 'center') next.center.tiles = insertAt(next.center.tiles, { kind: 'panel', id }, index);
      else next[to] = with_(next[to], id, index);
      // Taşınan panel büyütülmüş gözse büyütme anlamını yitirir.
      if (next.center.maximized === `p:${id}`) next.center.maximized = null;
      return next;
    });
  }, []);

  const moveTile = useCallback((key: string, toIndex: number) => {
    setLayout((l) => {
      const from = l.center.tiles.findIndex((t) => tileKey(t) === key);
      if (from === -1) return l;
      return { ...l, center: { ...l.center, tiles: moveWithin(l.center.tiles, from, toIndex) } };
    });
  }, []);

  const closePanel = useCallback((id: PanelId) => {
    setLayout((l) => ({
      left: without(l.left, id),
      right: without(l.right, id),
      center: {
        tiles: l.center.tiles.filter((t) => !(t.kind === 'panel' && t.id === id)),
        maximized: l.center.maximized === `p:${id}` ? null : l.center.maximized,
      },
    }));
  }, []);

  const showPanel = useCallback((id: PanelId) => {
    setLayout((l) => {
      const at = dockOf(l, id);
      if (at === 'center') return { ...l, center: { ...l.center, maximized: null } };
      if (at) return { ...l, [at]: with_(l[at], id) };
      // Hiç yerleşimde değilse: kendi doğal yuvasına değil, SAĞA gider —
      // sol yuva bağlam panelleriyle dolu ve geri getirilen bir panel
      // orayı sessizce ele geçirmemeli.
      return { ...l, right: with_(l.right, id) };
    });
  }, []);

  const setActive = useCallback((dock: 'left' | 'right', id: PanelId) => {
    setLayout((l) => ({ ...l, [dock]: { ...l[dock], active: id, open: true } }));
  }, []);

  const toggleDock = useCallback((dock: 'left' | 'right') => {
    setLayout((l) => ({ ...l, [dock]: { ...l[dock], open: !l[dock].open } }));
  }, []);

  const setDockWidth = useCallback((dock: 'left' | 'right', w: number) => {
    setLayout((l) => ({ ...l, [dock]: { ...l[dock], width: clampWidth(w) } }));
  }, []);

  const openTerminal = useCallback((agentId: string) => {
    setLayout((l) => {
      const key = `t:${agentId}`;
      const exists = l.center.tiles.some((t) => tileKey(t) === key);
      return {
        ...l,
        center: {
          tiles: exists ? l.center.tiles : [...l.center.tiles, { kind: 'terminal', agentId }],
          // Başka bir göz tam ekransa yeni terminal görünmez kalırdı.
          maximized: l.center.maximized && l.center.maximized !== key ? null : l.center.maximized,
        },
      };
    });
  }, []);

  const closeTile = useCallback((key: string) => {
    setLayout((l) => ({
      ...l,
      center: {
        tiles: l.center.tiles.filter((t) => tileKey(t) !== key),
        maximized: l.center.maximized === key ? null : l.center.maximized,
      },
    }));
  }, []);

  const toggleMaximize = useCallback((key: string) => {
    setLayout((l) => ({
      ...l,
      center: { ...l.center, maximized: l.center.maximized === key ? null : key },
    }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('claudiva.layout.v1');
    setLayout(loadLayout());
  }, []);

  return {
    layout,
    movePanel,
    moveTile,
    closePanel,
    showPanel,
    setActive,
    toggleDock,
    setDockWidth,
    openTerminal,
    closeTile,
    toggleMaximize,
    reset,
  };
}

export type { Tile };
