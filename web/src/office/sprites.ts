/**
 * Piksel-art kedi spriteları. Karakterler:
 *  .  şeffaf
 *  k  dış çizgi (koyu)
 *  b  gövde rengi (ajan başına değişir)
 *  s  gövde gölge tonu
 *  p  pembe (kulak içi / burun)
 *  w  beyaz (ağız/patiler)
 *  E  açık göz
 *  -  kapalı göz (çizgi)
 */

export type Sprite = string[];

/** Oturan kedi, gözler açık (çalışıyor / bekliyor). 16x16 */
export const SIT_OPEN: Sprite = [
  '................',
  '..kk........kk..',
  '.kpbk......kbpk.',
  '.kbbkkkkkkkkbbk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbbbbbbbbbbbk.',
  '.kbEbbbbbbbbEbk.',
  '.kbbbbbppbbbbbk.',
  '.kbbbbwwwwbbbbk.',
  '..kbbbbbbbbbbk..',
  '..kbsbbbbbbsbk..',
  '..kbbbbbbbbbbk..',
  '.kbbbbbbbbbbbbk.',
  '.kbwwbbbbbbwwbk.',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Oturan kedi, göz kırpma karesi */
export const SIT_BLINK: Sprite = SIT_OPEN.map((r) => r.replace(/E/g, '-'));

/** Uyuyan kedi (somun pozu), gözler kapalı. 16x16 */
export const SLEEP_A: Sprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...kk........kk.',
  '..kpbk......kbpk',
  '..kbbkkkkkkkkbbk',
  '..kbbbbbbbbbbbbk',
  '..kb-bbbbbbb-bbk',
  '..kbbbbppbbbbbbk',
  '.kbbbbbwwbbbbbbk',
  'kbbsbbbbbbbbsbbk',
  'kbbbbbbbbbbbbbbk',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Uyuyan kedi, kuyruk kıpırdama karesi */
export const SLEEP_B: Sprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...kk........kk.',
  '..kpbk......kbpk',
  '..kbbkkkkkkkkbbk',
  '..kbbbbbbbbbbbbk',
  '..kb-bbbbbbb-bbk',
  '..kbbbbppbbbbbbk',
  '.kbbbbbwwbbbbkbk',
  'kbbsbbbbbbbbskbk',
  'kbbbbbbbbbbbbbbk',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Ajan gövde renk paleti — id hash'ine göre seçilir */
export const CAT_COLORS: Array<{ body: string; shade: string }> = [
  { body: '#e8963c', shade: '#c9782a' }, // turuncu tekir
  { body: '#9aa5b5', shade: '#7d8798' }, // gri
  { body: '#7a5238', shade: '#5f3f2a' }, // kahve
  { body: '#e8d5ae', shade: '#cdb98d' }, // krem
  { body: '#4b4b55', shade: '#38383f' }, // siyahımsı
  { body: '#c97b63', shade: '#a86050' }, // kızıl
  { body: '#b7c9a8', shade: '#9bb08a' }, // çağla
  { body: '#a58ac2', shade: '#8a6fa8' }, // lila
];

export const OFFLINE_COLOR = { body: '#6a6f78', shade: '#565a62' };

export function catColor(id: string): { body: string; shade: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
}

export interface Palette {
  k: string;
  b: string;
  s: string;
  p: string;
  w: string;
  E: string;
  '-': string;
}

export function makePalette(body: string, shade: string): Palette {
  return {
    k: '#1c1622',
    b: body,
    s: shade,
    p: '#e58ca0',
    w: '#f2ede4',
    E: '#241f2b',
    '-': '#241f2b',
  };
}

/** Sprite'ı canvas'a çizer. (ox, oy) mantıksal piksel, S ölçek. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  palette: Palette,
  ox: number,
  oy: number,
  S: number,
): void {
  for (let y = 0; y < sprite.length; y++) {
    const row = sprite[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x] as keyof Palette | '.';
      if (c === '.') continue;
      const color = palette[c as keyof Palette];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((ox + x) * S, (oy + y) * S, S, S);
    }
  }
}
