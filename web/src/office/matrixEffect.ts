/**
 * Matrix tarzı dijital yağmur doğma/yok olma efekti (pixel-agents portu).
 * Orijinal piksel-piksel çalışır; biz PNG kullandığımızdan sütun dilimleri
 * drawImage ile çizilir, yeşil iz dikdörtgen katmanlarla eklenir.
 */
import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  MATRIX_COLUMN_STAGGER_RANGE,
  MATRIX_EFFECT_DURATION_SEC,
  MATRIX_HEAD_COLOR,
  MATRIX_TRAIL_LENGTH,
  matrixGreenBright,
  matrixGreenDim,
  matrixGreenMid,
} from './constants';
import type { Character } from './types';

const FLICKER_FPS = 30;
const FLICKER_THRESHOLD = 180;

/** Hash tabanlı titreme: ~%70 görünür */
function flickerVisible(col: number, row: number, time: number): boolean {
  const t = Math.floor(time * FLICKER_FPS);
  const hash = (col * 7 + row * 13 + t * 31) & 0xff;
  return hash < FLICKER_THRESHOLD;
}

export function matrixEffectSeeds(): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < CHAR_FRAME_W; i++) seeds.push(Math.random());
  return seeds;
}

/**
 * Efekti çizer. `sheet` karakter sayfası, `rect` sayfadaki kare.
 * (drawX, drawY) cihaz pikselinde sol-üst; zoom = piksel ölçeği.
 */
export function renderMatrixEffect(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  sheet: CanvasImageSource,
  rect: { sx: number; sy: number; sw: number; sh: number },
  drawX: number,
  drawY: number,
  zoom: number,
  mirrored: boolean,
): void {
  const progress = ch.matrixEffectTimer / MATRIX_EFFECT_DURATION_SEC;
  const isSpawn = ch.matrixEffect === 'spawn';
  const time = ch.matrixEffectTimer;
  const rows = CHAR_FRAME_H;
  const totalSweep = rows + MATRIX_TRAIL_LENGTH;

  for (let col = 0; col < CHAR_FRAME_W; col++) {
    const stagger = (ch.matrixEffectSeeds[col] ?? 0) * MATRIX_COLUMN_STAGGER_RANGE;
    const colProgress = Math.max(0, Math.min(1, (progress - stagger) / (1 - MATRIX_COLUMN_STAGGER_RANGE)));
    const headRow = colProgress * totalSweep;
    // Aynalıysa kaynak sütunu ters oku (görsel yatay çevrilmiş gibi)
    const srcCol = mirrored ? CHAR_FRAME_W - 1 - col : col;
    const px = drawX + col * zoom;

    // Karakterin "normal" görünen dilimi:
    // spawn: baş çizgisinin izin üstünde kalan (çoktan taranmış) üst bölüm
    // despawn: başın altında kalan (henüz tüketilmemiş) alt bölüm
    if (isSpawn) {
      const solidEnd = Math.min(rows, Math.floor(headRow - MATRIX_TRAIL_LENGTH));
      if (solidEnd > 0) {
        ctx.drawImage(sheet, rect.sx + srcCol, rect.sy, 1, solidEnd, px, drawY, zoom, solidEnd * zoom);
      }
      // İz bölgesi: karakter pikselleri + sönen yeşil örtü
      const trailStart = Math.max(0, solidEnd);
      const trailEnd = Math.min(rows, Math.ceil(headRow));
      if (trailEnd > trailStart) {
        ctx.drawImage(
          sheet,
          rect.sx + srcCol, rect.sy + trailStart, 1, trailEnd - trailStart,
          px, drawY + trailStart * zoom, zoom, (trailEnd - trailStart) * zoom,
        );
        for (let row = trailStart; row < trailEnd; row++) {
          const distFromHead = headRow - row;
          if (distFromHead < 0) continue;
          if (distFromHead < 1) {
            ctx.fillStyle = MATRIX_HEAD_COLOR;
            ctx.fillRect(px, drawY + row * zoom, zoom, zoom);
          } else if (flickerVisible(col, row, time)) {
            const trailPos = distFromHead / MATRIX_TRAIL_LENGTH;
            const alpha = (1 - trailPos) * 0.55;
            ctx.fillStyle =
              trailPos < 0.33 ? matrixGreenBright(alpha) : trailPos < 0.66 ? matrixGreenMid(alpha) : matrixGreenDim(alpha);
            ctx.fillRect(px, drawY + row * zoom, zoom, zoom);
          }
        }
      }
    } else {
      const solidStart = Math.max(0, Math.ceil(headRow));
      if (solidStart < rows) {
        ctx.drawImage(
          sheet,
          rect.sx + srcCol, rect.sy + solidStart, 1, rows - solidStart,
          px, drawY + solidStart * zoom, zoom, (rows - solidStart) * zoom,
        );
      }
      // Başın üstündeki iz: sadece yeşil yağmur
      const trailStart = Math.max(0, Math.floor(headRow - MATRIX_TRAIL_LENGTH));
      const trailEnd = Math.min(rows, solidStart);
      for (let row = trailStart; row < trailEnd; row++) {
        const distFromHead = headRow - row;
        if (distFromHead < 1) {
          ctx.fillStyle = MATRIX_HEAD_COLOR;
          ctx.fillRect(px, drawY + row * zoom, zoom, zoom);
        } else if (distFromHead < MATRIX_TRAIL_LENGTH && flickerVisible(col, row, time)) {
          const trailPos = distFromHead / MATRIX_TRAIL_LENGTH;
          const alpha = (1 - trailPos) * 0.5;
          ctx.fillStyle =
            trailPos < 0.33 ? matrixGreenBright(alpha) : trailPos < 0.66 ? matrixGreenMid(alpha) : matrixGreenDim(alpha);
          ctx.fillRect(px, drawY + row * zoom, zoom, zoom);
        }
      }
    }
  }
}
