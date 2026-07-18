/**
 * PNG varlık yükleme ve önbellekli türetme (hue-shift, gri tonlama, zemin boyama).
 * Varlık kaynağı: pixel-agents (MIT) — karakterler JIK-A-4 "MetroCity" paketi tabanlı.
 */
import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHAR_FRAMES_PER_ROW,
  WALL_COLOR,
} from './constants';

export const FURNITURE_IMAGE_KEYS = [
  'DESK_FRONT',
  'DESK_SIDE',
  'CUSHIONED_CHAIR_FRONT',
  'CUSHIONED_CHAIR_BACK',
  'CUSHIONED_CHAIR_SIDE',
  'PC_FRONT_OFF',
  'PC_FRONT_ON_1',
  'PC_FRONT_ON_2',
  'PC_FRONT_ON_3',
  'PLANT',
  'LARGE_PLANT',
  'BOOKSHELF',
  'WHITEBOARD',
  'CLOCK',
  'COFFEE',
] as const;

export interface OfficeAssets {
  /** char_0..5 sayfaları (7 sütun × 3 satır, kare 16×32) */
  characters: HTMLImageElement[];
  /** 16×16 gri tonlamalı zemin desenleri */
  floors: HTMLImageElement[];
  /** 64×128 duvar sayfası (4×4 bitmask parçaları, 16×32) */
  wall: HTMLImageElement;
  furniture: Record<string, HTMLImageElement>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Görsel yüklenemedi: ${src}`));
    img.src = src;
  });
}

let assetsPromise: Promise<OfficeAssets> | null = null;

export function loadOfficeAssets(): Promise<OfficeAssets> {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async () => {
    const characters = await Promise.all(
      [0, 1, 2, 3, 4, 5].map((i) => loadImage(`/assets/characters/char_${i}.png`)),
    );
    const floors = await Promise.all(
      [0, 1, 2].map((i) => loadImage(`/assets/floors/floor_${i}.png`)),
    );
    const wall = await loadImage('/assets/walls/wall_0.png');
    const furnitureEntries = await Promise.all(
      FURNITURE_IMAGE_KEYS.map(async (key) => [key, await loadImage(`/assets/furniture/${key}.png`)] as const),
    );
    return { characters, floors, wall, furniture: Object.fromEntries(furnitureEntries) };
  })();
  return assetsPromise;
}

// ── Türetilmiş sayfa önbellekleri ────────────────────────────

const sheetCache = new Map<string, HTMLCanvasElement>();

/**
 * Karakter sayfasının hue-shift'li / gri tonlamalı kopyası.
 * ctx.filter tüm sayfaya bir kez uygulanır, kareler bu canvas'tan kesilir.
 */
export function getCharacterSheet(
  assets: OfficeAssets,
  charIndex: number,
  hueShift: number,
  gray: boolean,
): CanvasImageSource {
  const img = assets.characters[charIndex % assets.characters.length];
  if (hueShift === 0 && !gray) return img;
  const key = `char-${charIndex}-${hueShift}-${gray ? 1 : 0}`;
  const cached = sheetCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const filters: string[] = [];
  if (hueShift !== 0) filters.push(`hue-rotate(${hueShift}deg)`);
  if (gray) filters.push('saturate(0.15) brightness(0.8)');
  ctx.filter = filters.join(' ');
  ctx.drawImage(img, 0, 0);
  sheetCache.set(key, canvas);
  return canvas;
}

/** Sayfadaki kare için kaynak dikdörtgen. Satırlar: down/up/right; left = right aynalı. */
export function charFrameRect(rowIndex: number, frameIndex: number): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
} {
  return {
    sx: (frameIndex % CHAR_FRAMES_PER_ROW) * CHAR_FRAME_W,
    sy: rowIndex * CHAR_FRAME_H,
    sw: CHAR_FRAME_W,
    sh: CHAR_FRAME_H,
  };
}

/**
 * Gri desenli zemin karosunun renklendirilmiş kopyası (Photoshop "colorize" benzeri:
 * desen parlaklığı korunur, üstüne 'color' blend ile ton geçer).
 */
export function getFloorTile(
  assets: OfficeAssets,
  patternIndex: number,
  color: { h: number; s: number; l: number },
): HTMLCanvasElement {
  const key = `floor-${patternIndex}-${color.h}-${color.s}-${color.l}`;
  const cached = sheetCache.get(key);
  if (cached) return cached;

  const img = assets.floors[patternIndex % assets.floors.length];
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.filter = `brightness(${color.l / 50})`;
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = `hsl(${color.h}, ${color.s}%, 50%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0); // alfa maskesini geri uygula
  sheetCache.set(key, canvas);
  return canvas;
}

/** Duvar sayfasının tema rengine boyanmış kopyası */
export function getWallSheet(assets: OfficeAssets): HTMLCanvasElement {
  const key = 'wall-tinted';
  const cached = sheetCache.get(key);
  if (cached) return cached;

  const img = assets.wall;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  sheetCache.set(key, canvas);
  return canvas;
}
