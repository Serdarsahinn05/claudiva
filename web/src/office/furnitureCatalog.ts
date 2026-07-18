import type { FurnitureInstance, PlacedFurniture } from './types';
import { TILE_SIZE } from './types';

export type FurnitureCategory = 'desks' | 'chairs' | 'electronics' | 'decor' | 'wall' | 'misc';

export interface CatalogEntry {
  /** assets.furniture anahtarı */
  imageKey: string;
  /** Sprite piksel boyutu */
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  /** Üstten kaç footprint satırı "arka plan" (yürünebilir, yerleşim engeli yok) */
  backgroundTiles: number;
  category: FurnitureCategory;
  isDesk?: boolean;
  orientation?: 'front' | 'back' | 'left' | 'right';
  /** Çizimde yatay aynala (side görselinin sol varyantı) */
  mirrored?: boolean;
  /** Masa yüzeyine yerleştirilebilir (z-sıralamada masanın önüne geçer) */
  onSurface?: boolean;
  /** Aktif ajan karşısındayken dönen animasyon kareleri (imageKey listesi) */
  onFrames?: string[];
}

export const FURNITURE_CATALOG: Record<string, CatalogEntry> = {
  DESK_FRONT: {
    imageKey: 'DESK_FRONT', width: 48, height: 32,
    footprintW: 3, footprintH: 2, backgroundTiles: 1,
    category: 'desks', isDesk: true,
  },
  DESK_SIDE: {
    imageKey: 'DESK_SIDE', width: 16, height: 64,
    footprintW: 1, footprintH: 4, backgroundTiles: 1,
    category: 'desks', isDesk: true,
  },
  CUSHIONED_CHAIR_FRONT: {
    imageKey: 'CUSHIONED_CHAIR_FRONT', width: 16, height: 16,
    footprintW: 1, footprintH: 1, backgroundTiles: 0,
    category: 'chairs', orientation: 'front',
  },
  CUSHIONED_CHAIR_BACK: {
    imageKey: 'CUSHIONED_CHAIR_BACK', width: 16, height: 16,
    footprintW: 1, footprintH: 1, backgroundTiles: 0,
    category: 'chairs', orientation: 'back',
  },
  CUSHIONED_CHAIR_RIGHT: {
    imageKey: 'CUSHIONED_CHAIR_SIDE', width: 16, height: 16,
    footprintW: 1, footprintH: 1, backgroundTiles: 0,
    category: 'chairs', orientation: 'right',
  },
  CUSHIONED_CHAIR_LEFT: {
    imageKey: 'CUSHIONED_CHAIR_SIDE', width: 16, height: 16,
    footprintW: 1, footprintH: 1, backgroundTiles: 0,
    category: 'chairs', orientation: 'left', mirrored: true,
  },
  PC_FRONT_OFF: {
    imageKey: 'PC_FRONT_OFF', width: 16, height: 32,
    footprintW: 1, footprintH: 2, backgroundTiles: 1,
    category: 'electronics', onSurface: true,
    onFrames: ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'],
  },
  // Açık ekran animasyon kareleri — auto-on bu tiplere geçici olarak çevirir
  PC_FRONT_ON_1: {
    imageKey: 'PC_FRONT_ON_1', width: 16, height: 32,
    footprintW: 1, footprintH: 2, backgroundTiles: 1,
    category: 'electronics', onSurface: true,
  },
  PC_FRONT_ON_2: {
    imageKey: 'PC_FRONT_ON_2', width: 16, height: 32,
    footprintW: 1, footprintH: 2, backgroundTiles: 1,
    category: 'electronics', onSurface: true,
  },
  PC_FRONT_ON_3: {
    imageKey: 'PC_FRONT_ON_3', width: 16, height: 32,
    footprintW: 1, footprintH: 2, backgroundTiles: 1,
    category: 'electronics', onSurface: true,
  },
  PLANT: {
    imageKey: 'PLANT', width: 16, height: 32,
    footprintW: 1, footprintH: 2, backgroundTiles: 1,
    category: 'decor',
  },
  LARGE_PLANT: {
    imageKey: 'LARGE_PLANT', width: 32, height: 48,
    footprintW: 2, footprintH: 3, backgroundTiles: 2,
    category: 'decor',
  },
  BOOKSHELF: {
    imageKey: 'BOOKSHELF', width: 32, height: 16,
    footprintW: 2, footprintH: 1, backgroundTiles: 0,
    category: 'wall',
  },
  WHITEBOARD: {
    imageKey: 'WHITEBOARD', width: 32, height: 32,
    footprintW: 2, footprintH: 2, backgroundTiles: 0,
    category: 'wall',
  },
  CLOCK: {
    imageKey: 'CLOCK', width: 16, height: 32,
    footprintW: 1, footprintH: 2, backgroundTiles: 0,
    category: 'wall',
  },
  COFFEE: {
    imageKey: 'COFFEE', width: 16, height: 16,
    footprintW: 1, footprintH: 1, backgroundTiles: 0,
    category: 'misc', onSurface: true,
  },
};

export function getCatalogEntry(type: string): CatalogEntry | undefined {
  return FURNITURE_CATALOG[type];
}

/**
 * Yerleşik mobilyayı çizilebilir örneklere çevirir (pixel-agents portu).
 * Sandalye z-kuralı: karakter kendi tile'ının alt kenarına göre sıralandığından
 * ön/yan sandalyeler ilk satır altına sabitlenir (karakter önde), arkalıklılar
 * footprint altına (+1) sabitlenir (sandalye arkalığı karakteri örter).
 */
export function buildFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  // Masa yüzeyi z değerleri — yüzey eşyaları masanın önünde çizilsin
  const deskZByTile = new Map<string, number>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || !entry.isDesk) continue;
    const deskZY = item.row * TILE_SIZE + entry.height;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        const prev = deskZByTile.get(key);
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY);
      }
    }
  }

  const instances: FurnitureInstance[] = [];
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const x = item.col * TILE_SIZE;
    const y = item.row * TILE_SIZE;
    let zY = y + entry.height;

    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        zY = (item.row + entry.footprintH) * TILE_SIZE + 1;
      } else {
        zY = (item.row + 1) * TILE_SIZE;
      }
    }

    if (entry.onSurface) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const deskZ = deskZByTile.get(`${item.col + dc},${item.row + dr}`);
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5;
        }
      }
    }

    // Not: kataloğdaki tüm sprite'lar footprint boyutuyla birebir (w=fw*16, h=fh*16),
    // bu yüzden sol-üst köşe doğrudan tile köşesidir.
    instances.push({ type: item.type, x, y, zY, ...(entry.mirrored ? { mirrored: true } : {}) });
  }
  return instances;
}

/** Mobilya footprint'lerinin blokladığı tile'lar (arka plan satırları hariç) */
export function getBlockedTiles(furniture: PlacedFurniture[]): Set<string> {
  const tiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    for (let dr = entry.backgroundTiles; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        tiles.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }
  return tiles;
}
