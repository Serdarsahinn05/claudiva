/**
 * Ofis sahnesi çizimi: zemin → z-sıralı (duvar + mobilya + karakter) →
 * baloncuklar, isim/durum etiketleri ve yakıt göstergesi.
 */
import type { AgentStatus } from '../types';
import { charFrameRect, getCharacterSheet, getFloorTile, getWallSheet, type OfficeAssets } from './assets';
import { getCharacterFrame } from './characters';
import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHARACTER_SITTING_OFFSET_PX,
  BUBBLE_FADE_DURATION_SEC,
  FLOOR_ZONE_COLORS,
  FUEL_COLOR_CRITICAL,
  FUEL_COLOR_DANGER,
  FUEL_COLOR_OK,
  FUEL_COLOR_WARN,
  FUEL_GAUGE_BG,
  MAX_CONTEXT_TOKENS,
  TOKEN_CRITICAL_THRESHOLD,
  TOKEN_DANGER_THRESHOLD,
  TOKEN_WARN_THRESHOLD,
  WALL_GRID_COLS,
  WALL_PIECE_H,
  WALL_PIECE_W,
} from './constants';
import { getCatalogEntry } from './furnitureCatalog';
import { officeThemeColors, type OfficeThemeColors } from './themeColors';
import { renderMatrixEffect } from './matrixEffect';
import type { OfficeState } from './officeState';
import type { Character } from './types';
import { CharacterState, TILE_SIZE, TileType } from './types';

// ── Baloncuk piksel verileri (pixel-agents bubble-*.json) ────
type BubblePixels = string[];

const BUBBLE_W = 11;
const BUBBLE_H = 13;

/** '.'=şeffaf, B=çerçeve, F=dolgu, A=amber, G=yeşil, T=mavi */
const BUBBLE_COLORS: Record<string, string> = {
  B: '#555566',
  F: '#EEEEFF',
  A: '#CCA700',
  G: '#44BB66',
  T: '#4C8DD6',
};

const BUBBLE_PERMISSION: BubblePixels = [
  'BBBBBBBBBBB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  'BFFAFAFAFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  'BBBBBBBBBBB',
  '....BBB....',
  '.....B.....',
  '...........',
];

const BUBBLE_WAITING: BubblePixels = [
  '.BBBBBBBBB.',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFGFB',
  'BFFFFFFGFFB',
  'BFFGFFGFFFB',
  'BFFFGGFFFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  '.BBBBBBBBB.',
  '....BBB....',
  '.....B.....',
  '...........',
];

/** Görev teslimi: pano/kâğıt ikonu */
const BUBBLE_TASK: BubblePixels = [
  '.BBBBBBBBB.',
  'BFFFFFFFFFB',
  'BFFTTTTTFFB',
  'BFFFFFFFFFB',
  'BFFTTTTTFFB',
  'BFFFFFFFFFB',
  'BFFTTTFFFFB',
  'BFFFFFFFFFB',
  'BFFFFFFFFFB',
  '.BBBBBBBBB.',
  '....BBB....',
  '.....B.....',
  '...........',
];

const bubbleCache = new Map<string, HTMLCanvasElement>();

function getBubbleCanvas(kind: 'permission' | 'waiting' | 'task', zoom: number): HTMLCanvasElement {
  const key = `${kind}-${zoom}`;
  const cached = bubbleCache.get(key);
  if (cached) return cached;
  const pixels =
    kind === 'permission' ? BUBBLE_PERMISSION : kind === 'waiting' ? BUBBLE_WAITING : BUBBLE_TASK;
  const canvas = document.createElement('canvas');
  canvas.width = BUBBLE_W * zoom;
  canvas.height = BUBBLE_H * zoom;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const c = BUBBLE_COLORS[pixels[y][x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
  }
  bubbleCache.set(key, canvas);
  return canvas;
}

/** Durum etiketinin rengi — tema paletinden. */
function statusColor(theme: OfficeThemeColors, status: string): string {
  switch (status) {
    case 'working': return theme.working;
    case 'waiting': return theme.waiting;
    case 'idle': return theme.idle;
    default: return theme.offline;
  }
}

interface ZDrawable {
  zY: number;
  draw: () => void;
}

export function renderOffice(
  ctx: CanvasRenderingContext2D,
  state: OfficeState,
  assets: OfficeAssets,
  statuses: Map<string, AgentStatus>,
  statusLabels: Record<string, string>,
  zoom: number,
): void {
  const { layout, tileMap } = state;
  ctx.imageSmoothingEnabled = false;

  // ── Zemin ──
  ctx.fillStyle = officeThemeColors().void;
  ctx.fillRect(0, 0, layout.cols * TILE_SIZE * zoom, layout.rows * TILE_SIZE * zoom);
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const t = tileMap[r][c];
      let tile: HTMLCanvasElement | null = null;
      if (t === TileType.FLOOR_1) tile = getFloorTile(assets, 0, FLOOR_ZONE_COLORS.worker);
      else if (t === TileType.FLOOR_2) tile = getFloorTile(assets, 1, FLOOR_ZONE_COLORS.boss);
      else if (t === TileType.FLOOR_3) tile = getFloorTile(assets, 2, FLOOR_ZONE_COLORS.neutral);
      if (tile) {
        ctx.drawImage(tile, c * TILE_SIZE * zoom, r * TILE_SIZE * zoom, TILE_SIZE * zoom, TILE_SIZE * zoom);
      }
    }
  }

  const drawables: ZDrawable[] = [];

  // ── Duvarlar (bitmask auto-tile, alt kenara çapalı 16×32 parçalar) ──
  const wallSheet = getWallSheet(assets);
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      if (tileMap[r][c] !== TileType.WALL) continue;
      let mask = 0;
      if (r > 0 && tileMap[r - 1][c] === TileType.WALL) mask |= 1;
      if (c < layout.cols - 1 && tileMap[r][c + 1] === TileType.WALL) mask |= 2;
      if (r < layout.rows - 1 && tileMap[r + 1][c] === TileType.WALL) mask |= 4;
      if (c > 0 && tileMap[r][c - 1] === TileType.WALL) mask |= 8;
      const sx = (mask % WALL_GRID_COLS) * WALL_PIECE_W;
      const sy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_H;
      const dx = c * TILE_SIZE * zoom;
      const dy = (r * TILE_SIZE + TILE_SIZE - WALL_PIECE_H) * zoom;
      drawables.push({
        zY: (r + 1) * TILE_SIZE,
        draw: () => ctx.drawImage(wallSheet, sx, sy, WALL_PIECE_W, WALL_PIECE_H, dx, dy, WALL_PIECE_W * zoom, WALL_PIECE_H * zoom),
      });
    }
  }

  // ── Mobilya ──
  for (const f of state.furniture) {
    const entry = getCatalogEntry(f.type);
    if (!entry) continue;
    const img = assets.furniture[entry.imageKey];
    if (!img) continue;
    const fx = f.x * zoom;
    const fy = f.y * zoom;
    const fw = entry.width * zoom;
    const fh = entry.height * zoom;
    if (f.mirrored) {
      drawables.push({
        zY: f.zY,
        draw: () => {
          ctx.save();
          ctx.translate(fx + fw, fy);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, fw, fh);
          ctx.restore();
        },
      });
    } else {
      drawables.push({ zY: f.zY, draw: () => ctx.drawImage(img, fx, fy, fw, fh) });
    }
  }

  // ── Karakterler ──
  for (const ch of state.getCharacters()) {
    const sheet = getCharacterSheet(assets, ch.charIndex, ch.hueShift, ch.offline);
    const { rowIndex, frameIndex, mirrored } = getCharacterFrame(ch);
    const rect = charFrameRect(rowIndex, frameIndex);
    const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const drawX = Math.round((ch.x - CHAR_FRAME_W / 2) * zoom);
    const drawY = Math.round((ch.y + sittingOffset - CHAR_FRAME_H) * zoom);
    // Karakter kendi tile'ının alt kenarına göre sıralanır: aynı satırdaki
    // sandalyenin önünde, bir alt satırdaki masanın arkasında kalır.
    const charZY = ch.y + TILE_SIZE / 2 + 0.5;

    if (ch.matrixEffect) {
      drawables.push({
        zY: charZY,
        draw: () => renderMatrixEffect(ctx, ch, sheet, rect, drawX, drawY, zoom, mirrored),
      });
      continue;
    }

    drawables.push({
      zY: charZY,
      draw: () => {
        if (mirrored) {
          ctx.save();
          ctx.translate(drawX + CHAR_FRAME_W * zoom, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(sheet, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw * zoom, rect.sh * zoom);
          ctx.restore();
        } else {
          ctx.drawImage(sheet, rect.sx, rect.sy, rect.sw, rect.sh, drawX, drawY, rect.sw * zoom, rect.sh * zoom);
        }
      },
    });
  }

  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) d.draw();

  // ── Üst katman: baloncuk + etiket + yakıt (z-sırasız, her şeyin üstünde) ──
  for (const ch of state.getCharacters()) {
    if (ch.matrixEffect === 'despawn') continue;
    drawOverlays(ctx, ch, statuses, statusLabels, zoom);
  }
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  statuses: Map<string, AgentStatus>,
  statusLabels: Record<string, string>,
  zoom: number,
): void {
  const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
  const headTopY = ch.y + sittingOffset - CHAR_FRAME_H + 6; // sprite üst boşluğu ~6px

  // Baloncuk
  if (ch.bubbleType) {
    const canvas = getBubbleCanvas(ch.bubbleType, zoom);
    let alpha = 1;
    if (ch.bubbleType !== 'permission' && ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC) {
      alpha = Math.max(0, ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      canvas,
      Math.round((ch.x - BUBBLE_W / 2) * zoom),
      Math.round((headTopY - BUBBLE_H - 1) * zoom),
    );
    ctx.restore();
  }

  // Yakıt göstergesi (bağlam doluluğu) — yalnız veri varken
  if (ch.contextTokens > 0) {
    const frac = Math.min(1, ch.contextTokens / MAX_CONTEXT_TOKENS);
    const color =
      frac >= TOKEN_CRITICAL_THRESHOLD
        ? FUEL_COLOR_CRITICAL
        : frac >= TOKEN_DANGER_THRESHOLD
          ? FUEL_COLOR_DANGER
          : frac >= TOKEN_WARN_THRESHOLD
            ? FUEL_COLOR_WARN
            : FUEL_COLOR_OK;
    const w = 14;
    const x = Math.round((ch.x - w / 2) * zoom);
    const y = Math.round((headTopY - 3) * zoom);
    ctx.fillStyle = FUEL_GAUGE_BG;
    ctx.fillRect(x, y, w * zoom, 2 * zoom);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * frac) * zoom, 2 * zoom);
  }

  // İsim + durum etiketi
  const status = statuses.get(ch.id) ?? (ch.offline ? 'offline' : 'idle');
  const labelY = (ch.y + sittingOffset + 4) * zoom;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${3.6 * zoom}px 'Segoe UI', sans-serif`;
  const theme = officeThemeColors();
  ctx.fillStyle = ch.offline ? theme.offline : theme.name;
  ctx.strokeStyle = theme.nameOutline;
  ctx.lineWidth = zoom;
  ctx.strokeText(ch.name.slice(0, 16), ch.x * zoom, labelY);
  ctx.fillText(ch.name.slice(0, 16), ch.x * zoom, labelY);
  ctx.font = `${3 * zoom}px 'Segoe UI', sans-serif`;
  ctx.fillStyle = statusColor(theme, status);
  const statusText = statusLabels[status] ?? status;
  ctx.strokeText(statusText, ch.x * zoom, labelY + 4.4 * zoom);
  ctx.fillText(statusText, ch.x * zoom, labelY + 4.4 * zoom);
}
