/**
 * Ajan listesinden deterministik ofis düzeni üretir.
 * Yerleşim birimi ("masa adası"): 3 genişlik × 3 yükseklik —
 *   satır 0: ortada sandalye (FRONT, aşağı bakar)
 *   satır 1-2: DESK_FRONT (üst satırı arka plan) + üstünde PC (+ bazılarında kahve)
 * Boss'lar üstte kendi bölgelerinde (FLOOR_2 halı), diğerleri altta grid.
 */
import type { AgentRole } from '../types';
import type { OfficeLayout, PlacedFurniture, Seat, TileType as TileTypeVal } from './types';
import { Direction, TileType } from './types';

export interface AgentInfo {
  id: string;
  role: AgentRole;
}

export interface GeneratedOffice {
  layout: OfficeLayout;
  seats: Map<string, Seat>;
  /** Deterministik koltuk ataması: agentId → seat uid */
  seatByAgent: Map<string, string>;
}

const UNIT_W = 4; // 3 masa + 1 boşluk
const UNIT_H = 4; // sandalye + 2 masa satırı + yürüme koridoru

function isBossRole(role: AgentRole): boolean {
  return role === 'boss';
}

export function generateOffice(agents: AgentInfo[]): GeneratedOffice {
  // Deterministik sıra: aynı ajan kümesi her zaman aynı düzeni üretir
  const sorted = [...agents].sort((a, b) => a.id.localeCompare(b.id));
  const bosses = sorted.filter((a) => isBossRole(a.role));
  const staff = sorted.filter((a) => !isBossRole(a.role));

  const perRow = Math.min(4, Math.max(2, Math.ceil(staff.length / 2)));
  const staffBlocks = staff.length > 0 ? Math.ceil(staff.length / perRow) : 0;

  // Genişlik hem çalışan grid'ine hem boss sırasına yetmeli
  const innerW = Math.max(perRow * UNIT_W, bosses.length * UNIT_W) + 1;
  const cols = innerW + 2; // + iki yan duvar

  // Satır planı: 0 = VOID (yüksek duvar payı), 1 = üst duvar, 2 = nefes satırı
  const bossZoneTop = 3;
  const bossZoneH = bosses.length > 0 ? UNIT_H : 0;
  const staffTop = bossZoneTop + bossZoneH;
  // Son blok koridoru; hiç çalışan yoksa boss koridoru alt sınırdır
  const contentBottom = staffBlocks > 0 ? staffTop + staffBlocks * UNIT_H - 1 : staffTop - 1;
  const rows = contentBottom + 2; // + alt duvar

  // ── Tile haritası ──
  const tiles: TileTypeVal[] = new Array(cols * rows).fill(TileType.FLOOR_1);
  const setTile = (c: number, r: number, t: TileTypeVal) => {
    tiles[r * cols + c] = t;
  };
  for (let c = 0; c < cols; c++) {
    setTile(c, 0, TileType.VOID);
    setTile(c, 1, TileType.WALL);
    setTile(c, rows - 1, TileType.WALL);
  }
  for (let r = 1; r < rows; r++) {
    setTile(0, r, TileType.WALL);
    setTile(cols - 1, r, TileType.WALL);
  }
  // Boss bölgesi halısı
  if (bosses.length > 0) {
    for (let r = bossZoneTop - 1; r < bossZoneTop + bossZoneH - 1; r++) {
      for (let c = 1; c < cols - 1; c++) setTile(c, r, TileType.FLOOR_2);
    }
  }

  // ── Mobilya + koltuklar ──
  const furniture: PlacedFurniture[] = [];
  const seats = new Map<string, Seat>();
  const seatByAgent = new Map<string, string>();
  let uidCounter = 0;
  const uid = (prefix: string) => `${prefix}-${uidCounter++}`;

  function placeDeskUnit(
    x0: number,
    chairRow: number,
    seatUid: string,
    forRole: AgentRole,
    withCoffee: boolean,
  ): void {
    furniture.push({ uid: uid('desk'), type: 'DESK_FRONT', col: x0, row: chairRow + 1 });
    furniture.push({ uid: seatUid, type: 'CUSHIONED_CHAIR_FRONT', col: x0 + 1, row: chairRow });
    furniture.push({ uid: uid('pc'), type: 'PC_FRONT_OFF', col: x0 + 1, row: chairRow + 1 });
    if (withCoffee) {
      furniture.push({ uid: uid('coffee'), type: 'COFFEE', col: x0 + 2, row: chairRow + 1 });
    }
    seats.set(seatUid, {
      uid: seatUid,
      seatCol: x0 + 1,
      seatRow: chairRow,
      facingDir: Direction.DOWN,
      assigned: false,
      forRole,
    });
  }

  // Boss masaları — bölge içinde ortalanır
  if (bosses.length > 0) {
    const totalW = bosses.length * UNIT_W - 1;
    const start = 1 + Math.max(0, Math.floor((innerW - totalW) / 2));
    bosses.forEach((boss, i) => {
      const seatUid = `seat-boss-${i}`;
      placeDeskUnit(start + i * UNIT_W, bossZoneTop, seatUid, 'boss', true);
      seatByAgent.set(boss.id, seatUid);
    });
  }

  // Çalışan masaları — grid
  staff.forEach((agent, i) => {
    const colIdx = i % perRow;
    const rowIdx = Math.floor(i / perRow);
    const x0 = 2 + colIdx * UNIT_W;
    const chairRow = staffTop + rowIdx * UNIT_H;
    const seatUid = `seat-staff-${i}`;
    placeDeskUnit(x0, chairRow, seatUid, agent.role, i % 3 === 0);
    seatByAgent.set(agent.id, seatUid);
  });

  // ── Dekor ──
  // Üst duvara asılanlar (satır 0-1 duvar yüzeyi)
  furniture.push({ uid: uid('clock'), type: 'CLOCK', col: 2, row: 0 });
  if (cols >= 12) {
    furniture.push({ uid: uid('wb'), type: 'WHITEBOARD', col: Math.floor(cols / 2) - 1, row: 0 });
  }
  furniture.push({ uid: uid('shelf'), type: 'BOOKSHELF', col: cols - 4, row: 1 });
  // Zemin bitkileri — alt köşeler
  furniture.push({ uid: uid('plant'), type: 'LARGE_PLANT', col: 1, row: rows - 4 });
  furniture.push({ uid: uid('plant'), type: 'PLANT', col: cols - 2, row: rows - 3 });

  const layout: OfficeLayout = { cols, rows, tiles, furniture };
  return { layout, seats, seatByAgent };
}
