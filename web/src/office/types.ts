import type { AgentRole } from '../types';

export const TILE_SIZE = 16;

export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  VOID: 255,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

export const CharacterState = {
  IDLE: 'idle',
  WALK: 'walk',
  TYPE: 'type',
} as const;
export type CharacterState = (typeof CharacterState)[keyof typeof CharacterState];

export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export interface Seat {
  uid: string;
  seatCol: number;
  seatRow: number;
  /** Otururken bakılan yön (bitişik masaya doğru) */
  facingDir: Direction;
  assigned: boolean;
  /** autoLayout bu koltuğu hangi role ayırdı (boss halısı vs worker adası) */
  forRole?: AgentRole;
}

export interface PlacedFurniture {
  uid: string;
  /** furnitureCatalog anahtarı (ör. DESK_FRONT, PC_FRONT_OFF) */
  type: string;
  col: number;
  row: number;
}

export interface FurnitureInstance {
  type: string;
  /** Piksel sol-üst */
  x: number;
  y: number;
  /** Derinlik sıralaması için Y (genelde alt kenar) */
  zY: number;
  mirrored?: boolean;
}

export interface OfficeLayout {
  cols: number;
  rows: number;
  /** row-major düz dizi */
  tiles: TileType[];
  furniture: PlacedFurniture[];
}

export type BubbleType = 'permission' | 'waiting' | 'task' | null;

/** Ziyaret (delegasyon) yürüyüşü aşaması */
export type VisitPhase = 'go' | 'bubble' | 'return' | null;

export interface Character {
  /** Ajan id'si (bizde string) */
  id: string;
  name: string;
  role: AgentRole;
  state: CharacterState;
  dir: Direction;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  path: Array<{ col: number; row: number }>;
  moveProgress: number;
  /** Aktif araç adı (okuma/yazma animasyonu seçimi) */
  currentTool: string | null;
  /** char_N.png indeksi */
  charIndex: number;
  /** Palet tekrarında uygulanan hue kayması (derece) */
  hueShift: number;
  frame: number;
  frameTimer: number;
  wanderTimer: number;
  wanderCount: number;
  wanderLimit: number;
  isActive: boolean;
  offline: boolean;
  seatId: string | null;
  bubbleType: BubbleType;
  bubbleTimer: number;
  seatTimer: number;
  /** Delegasyon ziyareti */
  visitTargetId: string | null;
  visitPhase: VisitPhase;
  /** Ziyaret aşaması güvenlik sayacı (takılırsa aşamayı ilerletir) */
  visitTimer: number;
  /** Matrix doğma/yok olma efekti */
  matrixEffect: 'spawn' | 'despawn' | null;
  matrixEffectTimer: number;
  matrixEffectSeeds: number[];
  /** Bağlam doluluğu (token) — yakıt göstergesi */
  contextTokens: number;
}
