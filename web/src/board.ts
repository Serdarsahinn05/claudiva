/**
 * Pano modu yerleşimi (saf modül, React yok).
 *
 * Pano 12 sütunlu, SABİT satır yükseklikli bir ızgaradır (`ROW_PX`). Her
 * widget bir TÜR, bir GENİŞLİK (`w`, 2-12 sütun) ve bir YÜKSEKLİK (`h`, satır)
 * taşır. Sabit satır sayesinde kartlar ızgaraya oturur ve aynı sırada eşit
 * boyda durur; ilk sürümde yükseklik içerikten geliyordu ve kartlar arasında
 * düzensiz boşluklar kalıyordu (kullanıcı "hizalamak çok zor" dedi). Kartın
 * sağ alt köşesinden sürükleyerek iki ölçü birlikte değişir, ızgaraya yapışır.
 *
 * Her tür panoda EN FAZLA BİR kez bulunur: aynı akışın iki kopyası yer
 * kaplamaktan başka bir şey yapmaz. Galeri panoda olanları "panoda" gösterir.
 *
 * Kayıt `claudiva.board.v2`. v1 (yükseklik yoktu) TAŞINMAZ: türün varsayılan
 * yüksekliğiyle çevrilince satırlar düzensiz kaldı ve kartlar arasında boşluk
 * açıldı; v1 yalnız bir oturum yaşadı, varsayılan dizilim daha iyi. Şekli
 * tutmayan kayıt BÜTÜNÜYLE reddedilir: yarı geçerli bir pano bilinmeyen türde
 * boş kart çizerdi.
 */
export type WidgetType =
  | 'compose'
  | 'flow'
  | 'approvals'
  | 'activity'
  | 'actions'
  | 'agents'
  | 'tokens'
  | 'stats'
  | 'budget'
  | 'cost'
  | 'quota'
  | 'changes'
  | 'system'
  | 'notes'
  // 2026-11-25: Cam'ın Genel Durum'undan (GlassOverview.tsx) gelen üçlü.
  | 'heatmap'
  | 'dial'
  | 'network';

export interface Widget {
  id: string;
  type: WidgetType;
  /** Sütun (2-12). */
  w: number;
  /** Satır (2-12), bkz. ROW_PX. */
  h: number;
}

/** Galeri grupları; sıra galerideki sıradır. */
export const WIDGET_GROUPS: { key: 'work' | 'team' | 'cost' | 'project'; types: WidgetType[] }[] = [
  { key: 'work', types: ['compose', 'flow', 'approvals', 'activity', 'actions'] },
  { key: 'team', types: ['agents', 'network', 'heatmap', 'tokens', 'stats'] },
  { key: 'cost', types: ['budget', 'dial', 'cost', 'quota'] },
  { key: 'project', types: ['changes', 'system', 'notes'] },
];
export const WIDGET_TYPES: WidgetType[] = WIDGET_GROUPS.flatMap((g) => g.types);

/** Galeriden eklenince alınan ölçü. */
export const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  compose: { w: 6, h: 4 },
  flow: { w: 6, h: 5 },
  approvals: { w: 4, h: 3 },
  activity: { w: 6, h: 5 },
  actions: { w: 4, h: 3 },
  agents: { w: 8, h: 4 },
  tokens: { w: 4, h: 4 },
  stats: { w: 4, h: 2 },
  budget: { w: 4, h: 3 },
  cost: { w: 4, h: 4 },
  quota: { w: 4, h: 3 },
  changes: { w: 6, h: 4 },
  system: { w: 4, h: 4 },
  notes: { w: 4, h: 4 },
  heatmap: { w: 6, h: 4 },
  dial: { w: 4, h: 4 },
  network: { w: 6, h: 5 },
};

export const ROW_PX = 56;
export const GAP_PX = 16;
export const MIN_W = 2;
export const MIN_H = 2;
export const MAX_W = 12;
export const MAX_H = 12;

const at = (type: WidgetType, w?: number, h?: number): Widget => ({
  id: type,
  type,
  w: w ?? DEFAULT_SIZE[type].w,
  h: h ?? DEFAULT_SIZE[type].h,
});

export const DEFAULT_BOARD: Widget[] = [
  at('compose', 6, 4),
  at('flow', 6, 4),
  at('stats', 4, 2),
  at('budget', 4, 2),
  at('approvals', 4, 2),
  at('agents', 8, 4),
  at('cost', 4, 4),
  // Satırı tam doldurur (6 + 6): kartlar arasında boşluk kalmasın.
  at('network', 6, 5),
  at('heatmap', 6, 5),
];

const KEY = 'claudiva.board.v2';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

function isWidget(v: unknown): v is Widget {
  if (!v || typeof v !== 'object') return false;
  const x = v as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    WIDGET_TYPES.includes(x.type as WidgetType) &&
    typeof x.w === 'number' &&
    typeof x.h === 'number'
  );
}

function valid(list: unknown): Widget[] | null {
  if (!Array.isArray(list) || !list.every(isWidget)) return null;
  const types = list.map((x) => x.type);
  if (new Set(types).size !== types.length) return null;
  return list.map((x) => ({ ...x, w: clamp(x.w, MIN_W, MAX_W), h: clamp(x.h, MIN_H, MAX_H) }));
}

export function loadBoard(): Widget[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return valid(JSON.parse(raw)) ?? DEFAULT_BOARD;
  } catch {
    /* bozuk kayıt: varsayılan */
  }
  return DEFAULT_BOARD;
}

export function saveBoard(board: Widget[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
  } catch {
    /* gizli sekme: pano yalnız bu oturumda yaşar */
  }
}

export function resized(x: Widget, w: number, h: number): Widget {
  return { ...x, w: clamp(w, MIN_W, MAX_W), h: clamp(h, MIN_H, MAX_H) };
}

/** `id`yi `targetId`nin önüne (`after` ise arkasına) taşır. */
export function moveWidget(board: Widget[], id: string, targetId: string, after: boolean): Widget[] {
  if (id === targetId) return board;
  const w = board.find((x) => x.id === id);
  if (!w) return board;
  const rest = board.filter((x) => x.id !== id);
  const i = rest.findIndex((x) => x.id === targetId);
  if (i < 0) return board;
  const at = after ? i + 1 : i;
  return [...rest.slice(0, at), w, ...rest.slice(at)];
}

export function sameOrder(a: Widget[], b: Widget[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id);
}

export function newWidget(type: WidgetType): Widget {
  return { id: `${type}-${Date.now().toString(36)}`, type, ...DEFAULT_SIZE[type] };
}
