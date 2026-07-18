/**
 * Ofisin çalışma-zamanı durumu (pixel-agents OfficeState'in sadeleştirilmiş portu):
 * tile haritası, koltuklar, mobilya örnekleri, karakter FSM güncellemesi,
 * baloncuklar, PC auto-on ve delegasyon ziyareti.
 */
import type { AgentRole } from '../types';
import type { GeneratedOffice } from './autoLayout';
import {
  createCharacter,
  randomRange,
  snapToSeat,
  tileCenter,
  updateCharacter,
} from './characters';
import {
  AUTO_ON_FACING_DEPTH,
  AUTO_ON_SIDE_DEPTH,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
  CHARACTER_SITTING_OFFSET_PX,
  FURNITURE_ANIM_INTERVAL_SEC,
  HUE_SHIFT_MIN_DEG,
  HUE_SHIFT_RANGE_DEG,
  INACTIVE_SEAT_TIMER_MIN_SEC,
  INACTIVE_SEAT_TIMER_RANGE_SEC,
  MATRIX_EFFECT_DURATION_SEC,
  TASK_BUBBLE_DURATION_SEC,
  WAITING_BUBBLE_DURATION_SEC,
} from './constants';
import { buildFurnitureInstances, getBlockedTiles, getCatalogEntry } from './furnitureCatalog';
import { matrixEffectSeeds } from './matrixEffect';
import { findPath, getWalkableTiles, isWalkable } from './tileMap';
import type {
  Character,
  FurnitureInstance,
  OfficeLayout,
  PlacedFurniture,
  Seat,
  TileType as TileTypeVal,
} from './types';
import { CharacterState, Direction } from './types';

const CHARACTER_COUNT = 6;
/** Ziyaret yürüyüşü bu süreyi aşarsa baloncuk aşamasına zorlanır */
const VISIT_GO_TIMEOUT_SEC = 10;

function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = [];
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = [];
    for (let c = 0; c < layout.cols; c++) row.push(layout.tiles[r * layout.cols + c]);
    map.push(row);
  }
  return map;
}

export class OfficeState {
  layout: OfficeLayout;
  tileMap: TileTypeVal[][];
  seats: Map<string, Seat>;
  seatByAgent: Map<string, string>;
  blockedTiles: Set<string>;
  furniture: FurnitureInstance[];
  walkableTiles: Array<{ col: number; row: number }>;
  characters: Map<string, Character> = new Map();
  furnitureAnimTimer = 0;
  hoveredAgentId: string | null = null;

  constructor(office: GeneratedOffice) {
    this.layout = office.layout;
    this.tileMap = layoutToTileMap(office.layout);
    this.seats = office.seats;
    this.seatByAgent = office.seatByAgent;
    this.blockedTiles = getBlockedTiles(office.layout.furniture);
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);
    this.furniture = buildFurnitureInstances(office.layout.furniture);
  }

  /** Ajan kadrosu değişince yeni üretilmiş düzene geç; mevcut karakterleri taşı. */
  rebuildFromOffice(office: GeneratedOffice): void {
    this.layout = office.layout;
    this.tileMap = layoutToTileMap(office.layout);
    this.seats = office.seats;
    this.seatByAgent = office.seatByAgent;
    this.blockedTiles = getBlockedTiles(office.layout.furniture);
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);

    for (const ch of this.characters.values()) {
      const seatId = office.seatByAgent.get(ch.id) ?? null;
      ch.seatId = seatId;
      ch.visitPhase = null;
      ch.visitTargetId = null;
      ch.path = [];
      ch.moveProgress = 0;
      const seat = seatId ? this.seats.get(seatId) : null;
      if (seat) {
        seat.assigned = true;
        snapToSeat(ch, seat);
        if (!ch.isActive && !ch.offline) {
          ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
        }
      } else if (
        !isWalkable(ch.tileCol, ch.tileRow, this.tileMap, this.blockedTiles) &&
        this.walkableTiles.length > 0
      ) {
        const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
        ch.tileCol = spawn.col;
        ch.tileRow = spawn.row;
        const c = tileCenter(spawn.col, spawn.row);
        ch.x = c.x;
        ch.y = c.y;
      }
    }
    this.rebuildFurnitureInstances();
  }

  /** İlk 6 ajana farklı karakter; sonrası dengeli tekrar + ≥45° hue kayması.
   *  Ajan id'sinden türetilen hash ile deterministik: sayfa yenilenince görünüm değişmez. */
  private pickDiverseCharacter(id: string): { charIndex: number; hueShift: number } {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;

    const counts = new Array<number>(CHARACTER_COUNT).fill(0);
    for (const ch of this.characters.values()) counts[ch.charIndex % CHARACTER_COUNT]++;
    const minCount = Math.min(...counts);
    const available: number[] = [];
    for (let i = 0; i < CHARACTER_COUNT; i++) if (counts[i] === minCount) available.push(i);
    const charIndex = available[hash % available.length];
    const hueShift = minCount > 0 ? HUE_SHIFT_MIN_DEG + (hash % HUE_SHIFT_RANGE_DEG) : 0;
    return { charIndex, hueShift };
  }

  addAgent(id: string, name: string, role: AgentRole, skipSpawnEffect = false): void {
    if (this.characters.has(id)) return;
    const { charIndex, hueShift } = this.pickDiverseCharacter(id);

    const seatId = this.seatByAgent.get(id) ?? null;
    const seat = seatId ? this.seats.get(seatId) ?? null : null;
    if (seat) seat.assigned = true;

    const ch = createCharacter(id, name, role, charIndex, hueShift, seatId, seat);
    if (!seat && this.walkableTiles.length > 0) {
      const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
      ch.tileCol = spawn.col;
      ch.tileRow = spawn.row;
      const c = tileCenter(spawn.col, spawn.row);
      ch.x = c.x;
      ch.y = c.y;
    }
    if (!skipSpawnEffect) {
      ch.matrixEffect = 'spawn';
      ch.matrixEffectTimer = 0;
      ch.matrixEffectSeeds = matrixEffectSeeds();
    }
    this.characters.set(id, ch);
  }

  removeAgent(id: string): void {
    const ch = this.characters.get(id);
    if (!ch || ch.matrixEffect === 'despawn') return;
    if (ch.seatId) {
      const seat = this.seats.get(ch.seatId);
      if (seat) seat.assigned = false;
    }
    ch.matrixEffect = 'despawn';
    ch.matrixEffectTimer = 0;
    ch.matrixEffectSeeds = matrixEffectSeeds();
    ch.bubbleType = null;
  }

  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return null;
    return `${seat.seatCol},${seat.seatRow}`;
  }

  /** Karakterin kendi koltuğunu geçici olarak yürünebilir yap */
  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch);
    if (key) this.blockedTiles.delete(key);
    const result = fn();
    if (key) this.blockedTiles.add(key);
    return result;
  }

  setAgentActive(id: string, active: boolean): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    if (ch.isActive === active) return;
    ch.isActive = active;
    if (!active && ch.visitPhase === null) {
      // -1 sentineli: tur yeni bitti, varışta uzun dinlenme uygulama
      ch.seatTimer = -1;
      ch.path = [];
      ch.moveProgress = 0;
    }
    this.rebuildFurnitureInstances();
  }

  setAgentTool(id: string, tool: string | null): void {
    const ch = this.characters.get(id);
    if (ch) ch.currentTool = tool;
  }

  setAgentOffline(id: string, offline: boolean): void {
    const ch = this.characters.get(id);
    if (!ch || ch.offline === offline) return;
    ch.offline = offline;
    ch.isActive = false;
    if (offline) {
      ch.bubbleType = null;
      ch.visitPhase = null;
      ch.visitTargetId = null;
      const seat = ch.seatId ? this.seats.get(ch.seatId) : null;
      if (seat) snapToSeat(ch, seat);
    } else {
      ch.state = CharacterState.IDLE;
      ch.wanderTimer = randomRange(2, 8);
    }
    this.rebuildFurnitureInstances();
  }

  setAgentTokens(id: string, contextTokens: number): void {
    const ch = this.characters.get(id);
    if (ch) ch.contextTokens = contextTokens;
  }

  showPermissionBubble(id: string): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'permission';
      ch.bubbleTimer = 0; // izin baloncuğu kalıcıdır
    }
  }

  clearPermissionBubble(id: string): void {
    const ch = this.characters.get(id);
    if (ch && ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    }
  }

  showWaitingBubble(id: string): void {
    const ch = this.characters.get(id);
    if (ch && ch.bubbleType !== 'permission') {
      ch.bubbleType = 'waiting';
      ch.bubbleTimer = WAITING_BUBBLE_DURATION_SEC;
    }
  }

  /**
   * Delegasyon ziyareti: `fromId` karakteri `toId`nin masasına yürür,
   * görev baloncuğu gösterir, sonra kendi koltuğuna döner.
   */
  visitAgent(fromId: string, toId: string): void {
    const from = this.characters.get(fromId);
    const to = this.characters.get(toId);
    if (!from || !to || from.offline) return;
    if (from.visitPhase !== null) return; // zaten ziyarette

    // Hedefin yanındaki yürünebilir tile — önce yanlar/üst (alt tile çoğu
    // yerleşimde masanın arka plan satırıdır; oraya durmak masaya çıkmış gösterir)
    const candidates = [
      { col: to.tileCol - 1, row: to.tileRow },
      { col: to.tileCol + 1, row: to.tileRow },
      { col: to.tileCol, row: to.tileRow - 1 },
      { col: to.tileCol, row: to.tileRow + 1 },
    ];
    let path: Array<{ col: number; row: number }> = [];
    this.withOwnSeatUnblocked(from, () => {
      for (const t of candidates) {
        if (!isWalkable(t.col, t.row, this.tileMap, this.blockedTiles)) continue;
        path = findPath(from.tileCol, from.tileRow, t.col, t.row, this.tileMap, this.blockedTiles);
        if (path.length > 0) break;
      }
    });

    from.visitTargetId = toId;
    from.visitTimer = 0;
    if (path.length === 0) {
      // Gidilemiyor — baloncuğu yerinde göster
      from.visitPhase = 'bubble';
      from.bubbleType = 'task';
      from.bubbleTimer = TASK_BUBBLE_DURATION_SEC;
      return;
    }
    from.visitPhase = 'go';
    from.path = path;
    from.moveProgress = 0;
    from.state = CharacterState.WALK;
    from.frame = 0;
    from.frameTimer = 0;
  }

  /** Aktif ajanın baktığı yöndeki elektronikler "açık" varyanta geçer */
  private rebuildFurnitureInstances(): void {
    const autoOnTiles = new Set<string>();
    for (const ch of this.characters.values()) {
      if (!ch.isActive || ch.offline || !ch.seatId) continue;
      const seat = this.seats.get(ch.seatId);
      if (!seat) continue;
      const dCol = seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0;
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0;
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
        autoOnTiles.add(`${seat.seatCol + dCol * d},${seat.seatRow + dRow * d}`);
      }
      for (let d = 1; d <= AUTO_ON_SIDE_DEPTH; d++) {
        const baseCol = seat.seatCol + dCol * d;
        const baseRow = seat.seatRow + dRow * d;
        if (dCol !== 0) {
          autoOnTiles.add(`${baseCol},${baseRow - 1}`);
          autoOnTiles.add(`${baseCol},${baseRow + 1}`);
        } else {
          autoOnTiles.add(`${baseCol - 1},${baseRow}`);
          autoOnTiles.add(`${baseCol + 1},${baseRow}`);
        }
      }
    }

    if (autoOnTiles.size === 0) {
      this.furniture = buildFurnitureInstances(this.layout.furniture);
      return;
    }

    const animFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    const modified: PlacedFurniture[] = this.layout.furniture.map((item) => {
      const entry = getCatalogEntry(item.type);
      if (!entry || !entry.onFrames || entry.onFrames.length === 0) return item;
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          if (autoOnTiles.has(`${item.col + dc},${item.row + dr}`)) {
            const frame = entry.onFrames[animFrame % entry.onFrames.length];
            return { ...item, type: frame };
          }
        }
      }
      return item;
    });
    this.furniture = buildFurnitureInstances(modified);
  }

  update(dt: number): void {
    // Mobilya animasyon karesi (PC ekranı)
    const prevFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    this.furnitureAnimTimer += dt;
    if (Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC) !== prevFrame) {
      this.rebuildFurnitureInstances();
    }

    const toDelete: string[] = [];
    for (const ch of this.characters.values()) {
      // Matrix efekti sırasında FSM durur
      if (ch.matrixEffect) {
        ch.matrixEffectTimer += dt;
        if (ch.matrixEffectTimer >= MATRIX_EFFECT_DURATION_SEC) {
          if (ch.matrixEffect === 'spawn') {
            ch.matrixEffect = null;
            ch.matrixEffectTimer = 0;
            ch.matrixEffectSeeds = [];
          } else {
            toDelete.push(ch.id);
          }
        }
        continue;
      }

      // Ziyaret aşama geçişleri
      if (ch.visitPhase === 'go') {
        ch.visitTimer += dt;
        const arrived = ch.state !== CharacterState.WALK || ch.path.length === 0;
        if (arrived || ch.visitTimer > VISIT_GO_TIMEOUT_SEC) {
          // Hedefe dön ve baloncuğu göster
          const target = ch.visitTargetId ? this.characters.get(ch.visitTargetId) : null;
          if (target) {
            const dc = target.tileCol - ch.tileCol;
            const dr = target.tileRow - ch.tileRow;
            ch.dir =
              Math.abs(dc) >= Math.abs(dr)
                ? dc >= 0
                  ? Direction.RIGHT
                  : Direction.LEFT
                : dr >= 0
                  ? Direction.DOWN
                  : Direction.UP;
          }
          ch.state = CharacterState.IDLE;
          ch.path = [];
          ch.visitPhase = 'bubble';
          ch.bubbleType = 'task';
          ch.bubbleTimer = TASK_BUBBLE_DURATION_SEC;
          ch.visitTimer = 0;
        }
      } else if (ch.visitPhase === 'bubble') {
        ch.bubbleTimer -= dt;
        if (ch.bubbleTimer <= 0) {
          if (ch.bubbleType === 'task') ch.bubbleType = null;
          ch.bubbleTimer = 0;
          ch.visitPhase = 'return';
          const seat = ch.seatId ? this.seats.get(ch.seatId) : null;
          if (seat) {
            const path = this.withOwnSeatUnblocked(ch, () =>
              findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles),
            );
            if (path.length > 0) {
              ch.path = path;
              ch.moveProgress = 0;
              ch.state = CharacterState.WALK;
              ch.frame = 0;
              ch.frameTimer = 0;
            } else {
              snapToSeat(ch, seat);
              ch.visitPhase = null;
              ch.visitTargetId = null;
            }
          } else {
            ch.visitPhase = null;
            ch.visitTargetId = null;
          }
        }
      }

      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, this.walkableTiles, this.seats, this.tileMap, this.blockedTiles),
      );

      // Bekleme baloncuğu sayacı (izin baloncuğu kalıcı, task ziyarette yönetiliyor)
      if (ch.bubbleType === 'waiting') {
        ch.bubbleTimer -= dt;
        if (ch.bubbleTimer <= 0) {
          ch.bubbleType = null;
          ch.bubbleTimer = 0;
        }
      }
    }
    for (const id of toDelete) this.characters.delete(id);
  }

  getCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /** Piksel konumda karakter (tıklama/hover isabet testi) */
  getCharacterAt(worldX: number, worldY: number): string | null {
    const chars = this.getCharacters().sort((a, b) => b.y - a.y);
    for (const ch of chars) {
      if (ch.matrixEffect === 'despawn') continue;
      // Çizimle aynı çapa: alt-orta nokta (ch.x, ch.y) + oturma ofseti
      const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      const anchorY = ch.y + sittingOffset;
      if (
        worldX >= ch.x - CHARACTER_HIT_HALF_WIDTH &&
        worldX <= ch.x + CHARACTER_HIT_HALF_WIDTH &&
        worldY >= anchorY - CHARACTER_HIT_HEIGHT &&
        worldY <= anchorY
      ) {
        return ch.id;
      }
    }
    return null;
  }
}
