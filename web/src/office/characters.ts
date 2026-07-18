/**
 * Karakter durum makinesi (pixel-agents portu):
 * TYPE (masada çalışır) / WALK (BFS yolunda) / IDLE (gezinme-dinlenme döngüsü).
 * Ek durumlar: offline (masasında hareketsiz), visitPhase (delegasyon ziyareti).
 */
import type { AgentRole } from '../types';
import {
  READING_TOOLS,
  SEAT_REST_MAX_SEC,
  SEAT_REST_MIN_SEC,
  TYPE_FRAME_DURATION_SEC,
  WALK_FRAME_DURATION_SEC,
  WALK_SPEED_PX_PER_SEC,
  WANDER_MOVES_BEFORE_REST_MAX,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_PAUSE_MAX_SEC,
  WANDER_PAUSE_MIN_SEC,
} from './constants';
import { findPath } from './tileMap';
import type { Character, Seat, TileType as TileTypeVal } from './types';
import { CharacterState, Direction, TILE_SIZE } from './types';

export function isReadingTool(tool: string | null): boolean {
  return tool !== null && READING_TOOLS.has(tool);
}

export function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

function directionBetween(fromCol: number, fromRow: number, toCol: number, toRow: number): Direction {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  if (dc > 0) return Direction.RIGHT;
  if (dc < 0) return Direction.LEFT;
  if (dr > 0) return Direction.DOWN;
  return Direction.UP;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function createCharacter(
  id: string,
  name: string,
  role: AgentRole,
  charIndex: number,
  hueShift: number,
  seatId: string | null,
  seat: Seat | null,
): Character {
  const col = seat ? seat.seatCol : 1;
  const row = seat ? seat.seatRow : 1;
  const center = tileCenter(col, row);
  return {
    id,
    name,
    role,
    state: CharacterState.TYPE,
    dir: seat ? seat.facingDir : Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    currentTool: null,
    charIndex,
    hueShift,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX),
    isActive: false,
    offline: false,
    seatId,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    visitTargetId: null,
    visitPhase: null,
    visitTimer: 0,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    contextTokens: 0,
  };
}

/** Karakteri koltuğuna ışınla ve oturt (offline / düzen değişimi için) */
export function snapToSeat(ch: Character, seat: Seat): void {
  ch.tileCol = seat.seatCol;
  ch.tileRow = seat.seatRow;
  const c = tileCenter(seat.seatCol, seat.seatRow);
  ch.x = c.x;
  ch.y = c.y;
  ch.dir = seat.facingDir;
  ch.state = CharacterState.TYPE;
  ch.path = [];
  ch.moveProgress = 0;
  ch.frame = 0;
  ch.frameTimer = 0;
}

export function updateCharacter(
  ch: Character,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  seats: Map<string, Seat>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): void {
  // Offline: masasında hareketsiz oturur; yürüyüş yarıda kaldıysa koltuğa ışınlanır
  if (ch.offline) {
    const seat = ch.seatId ? seats.get(ch.seatId) : null;
    if (seat && (ch.tileCol !== seat.seatCol || ch.tileRow !== seat.seatRow || ch.state !== CharacterState.TYPE)) {
      snapToSeat(ch, seat);
    }
    ch.frame = 0;
    return;
  }

  ch.frameTimer += dt;

  switch (ch.state) {
    case CharacterState.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 2;
      }
      // Artık aktif değilse: (dinlenme süresi bittiğinde) kalk ve gezin
      if (!ch.isActive) {
        if (ch.seatTimer > 0) {
          ch.seatTimer -= dt;
          break;
        }
        ch.seatTimer = 0;
        ch.state = CharacterState.IDLE;
        ch.frame = 0;
        ch.frameTimer = 0;
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        ch.wanderCount = 0;
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
      }
      break;
    }

    case CharacterState.IDLE: {
      ch.frame = 0;
      if (ch.seatTimer < 0) ch.seatTimer = 0; // tur-sonu sentineli temizle
      // Ziyaret baloncuğu aşamasında bekle — gezinme kararı verme
      if (ch.visitPhase === 'bubble') break;
      // Aktifleşti: koltuğa yol bul
      if (ch.isActive && ch.visitPhase === null) {
        if (!ch.seatId) {
          ch.state = CharacterState.TYPE;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
        const seat = seats.get(ch.seatId);
        if (seat) {
          const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles);
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
          } else {
            ch.state = CharacterState.TYPE;
            ch.dir = seat.facingDir;
            ch.frame = 0;
            ch.frameTimer = 0;
          }
        }
        break;
      }
      // Gezinme sayacı
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        // Yeterince gezindiyse koltuğa dönüp dinlen
        if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
          const seat = seats.get(ch.seatId);
          if (seat) {
            const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles);
            if (path.length > 0) {
              ch.path = path;
              ch.moveProgress = 0;
              ch.state = CharacterState.WALK;
              ch.frame = 0;
              ch.frameTimer = 0;
              break;
            }
          }
        }
        if (walkableTiles.length > 0) {
          const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
          const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row, tileMap, blockedTiles);
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
            ch.wanderCount++;
          }
        }
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case CharacterState.WALK: {
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 4;
      }

      if (ch.path.length === 0) {
        // Yol bitti — tile merkezine hizala ve duruma geç
        const center = tileCenter(ch.tileCol, ch.tileRow);
        ch.x = center.x;
        ch.y = center.y;

        // Ziyaret hedefine varış officeState.update'te ele alınır
        if (ch.visitPhase === 'go') {
          ch.state = CharacterState.IDLE;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }

        if (ch.isActive) {
          if (!ch.seatId) {
            ch.state = CharacterState.TYPE;
          } else {
            const seat = seats.get(ch.seatId);
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE;
              ch.dir = seat.facingDir;
              if (ch.visitPhase === 'return') {
                ch.visitPhase = null;
                ch.visitTargetId = null;
              }
            } else {
              ch.state = CharacterState.IDLE;
            }
          }
        } else {
          // Koltuğa vardıysa otur; seatTimer<0 sentineli "tur yeni bitti" demek
          if (ch.seatId) {
            const seat = seats.get(ch.seatId);
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE;
              ch.dir = seat.facingDir;
              if (ch.visitPhase === 'return') {
                ch.visitPhase = null;
                ch.visitTargetId = null;
              }
              if (ch.seatTimer < 0) {
                ch.seatTimer = 0;
              } else {
                ch.seatTimer = randomRange(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC);
              }
              ch.wanderCount = 0;
              ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
              ch.frame = 0;
              ch.frameTimer = 0;
              break;
            }
          }
          ch.state = CharacterState.IDLE;
          if (ch.visitPhase === 'return') {
            ch.visitPhase = null;
            ch.visitTargetId = null;
          }
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        }
        ch.frame = 0;
        ch.frameTimer = 0;
        break;
      }

      // Yoldaki bir sonraki tile'a ilerle
      const nextTile = ch.path[0];
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row);
      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;

      const fromCenter = tileCenter(ch.tileCol, ch.tileRow);
      const toCenter = tileCenter(nextTile.col, nextTile.row);
      const t = Math.min(ch.moveProgress, 1);
      ch.x = fromCenter.x + (toCenter.x - fromCenter.x) * t;
      ch.y = fromCenter.y + (toCenter.y - fromCenter.y) * t;

      if (ch.moveProgress >= 1) {
        ch.tileCol = nextTile.col;
        ch.tileRow = nextTile.row;
        ch.x = toCenter.x;
        ch.y = toCenter.y;
        ch.path.shift();
        ch.moveProgress = 0;
      }

      // Gezinirken aktifleşti: rotayı koltuğa çevir (ziyaret sırasında hariç)
      if (ch.isActive && ch.seatId && ch.visitPhase === null) {
        const seat = seats.get(ch.seatId);
        if (seat) {
          const lastStep = ch.path[ch.path.length - 1];
          if (!lastStep || lastStep.col !== seat.seatCol || lastStep.row !== seat.seatRow) {
            const newPath = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles);
            if (newPath.length > 0) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }
          }
        }
      }
      break;
    }
  }
}

/** Karakterin mevcut durum+yönü için sprite sayfası satırı ve kare indeksi.
 *  Satır: 0=down, 1=up, 2=right (left = right aynalı). Kareler: 0-2 yürüme, 3-4 yazma, 5-6 okuma. */
export function getCharacterFrame(ch: Character): { rowIndex: number; frameIndex: number; mirrored: boolean } {
  const mirrored = ch.dir === Direction.LEFT;
  const rowIndex = ch.dir === Direction.UP ? 1 : ch.dir === Direction.DOWN ? 0 : 2;

  if (ch.offline) return { rowIndex, frameIndex: 3, mirrored }; // statik oturuş

  switch (ch.state) {
    case CharacterState.TYPE: {
      const base = isReadingTool(ch.currentTool) ? 5 : 3;
      return { rowIndex, frameIndex: base + (ch.frame % 2), mirrored };
    }
    case CharacterState.WALK: {
      const seq = [0, 1, 2, 1];
      return { rowIndex, frameIndex: seq[ch.frame % 4], mirrored };
    }
    default:
      return { rowIndex, frameIndex: 1, mirrored }; // ayakta duruş
  }
}
