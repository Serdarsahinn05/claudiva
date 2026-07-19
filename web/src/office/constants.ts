// ── Karakter animasyonu (pixel-agents değerleri) ─────────────
export const WALK_SPEED_PX_PER_SEC = 48;
export const WALK_FRAME_DURATION_SEC = 0.15;
export const TYPE_FRAME_DURATION_SEC = 0.3;
export const WANDER_PAUSE_MIN_SEC = 2.0;
export const WANDER_PAUSE_MAX_SEC = 20.0;
export const WANDER_MOVES_BEFORE_REST_MIN = 3;
export const WANDER_MOVES_BEFORE_REST_MAX = 6;
export const SEAT_REST_MIN_SEC = 120.0;
export const SEAT_REST_MAX_SEC = 240.0;
/** Yürüme döngüsü: 3 karelik sayfadan 4 adımlık dizi */
export const WALK_SEQUENCE = [0, 1, 2, 1] as const;

// ── Sprite sayfası düzeni (char_N.png: 7 sütun × 3 satır, 16×32) ──
export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 32;
export const CHAR_FRAMES_PER_ROW = 7;
export const CHAR_ROW = { down: 0, up: 1, right: 2 } as const;

// ── Duvar sayfası (wall_0.png: 4×4 grid, 16×32 parça, bitmask N=1 E=2 S=4 W=8) ──
export const WALL_PIECE_W = 16;
export const WALL_PIECE_H = 32;
export const WALL_GRID_COLS = 4;

// ── Çeşitlilik ───────────────────────────────────────────────
export const HUE_SHIFT_MIN_DEG = 45;
export const HUE_SHIFT_RANGE_DEG = 271;

// ── Oyun mantığı ─────────────────────────────────────────────
export const MAX_DELTA_TIME_SEC = 0.1;
export const WAITING_BUBBLE_DURATION_SEC = 2.0;
export const TASK_BUBBLE_DURATION_SEC = 1.4;
export const BUBBLE_FADE_DURATION_SEC = 0.5;
export const INACTIVE_SEAT_TIMER_MIN_SEC = 3.0;
export const INACTIVE_SEAT_TIMER_RANGE_SEC = 2.0;
export const CHARACTER_SITTING_OFFSET_PX = 6;
export const CHARACTER_HIT_HALF_WIDTH = 8;
export const CHARACTER_HIT_HEIGHT = 24;
export const AUTO_ON_FACING_DEPTH = 3;
export const AUTO_ON_SIDE_DEPTH = 2;
export const FURNITURE_ANIM_INTERVAL_SEC = 0.2;

// ── Matrix efekti ────────────────────────────────────────────
export const MATRIX_EFFECT_DURATION_SEC = 0.3;
export const MATRIX_TRAIL_LENGTH = 6;
export const MATRIX_SPRITE_COLS = 16;
export const MATRIX_SPRITE_ROWS = 24;
export const MATRIX_COLUMN_STAGGER_RANGE = 0.3;
export const MATRIX_HEAD_COLOR = '#ccffcc';
export const matrixGreenBright = (a: number): string => `rgba(0, 255, 65, ${a})`;
export const matrixGreenMid = (a: number): string => `rgba(0, 170, 40, ${a})`;
export const matrixGreenDim = (a: number): string => `rgba(0, 85, 20, ${a})`;

// ── Yakıt göstergesi (bağlam doluluğu) ───────────────────────
export const MAX_CONTEXT_TOKENS = 200_000;
export const TOKEN_WARN_THRESHOLD = 0.6;
export const TOKEN_DANGER_THRESHOLD = 0.8;
export const TOKEN_CRITICAL_THRESHOLD = 0.95;
export const FUEL_COLOR_OK = '#44cc44';
export const FUEL_COLOR_WARN = '#ffcc00';
export const FUEL_COLOR_DANGER = '#ff8800';
export const FUEL_COLOR_CRITICAL = '#ff2222';
export const FUEL_GAUGE_BG = 'rgba(20,20,26,0.8)';

// ── Renkler ──────────────────────────────────────────────────
export const WALL_COLOR = '#3A3A5C';
/* VOID_COLOR kaldırıldı: ofis zemin rengi artık temadan okunuyor
   (bkz. office/themeColors.ts). Ham renk sabiti bırakmak tema sistemini
   sessizce delen bir kopyala-yapıştır kaynağı olurdu. */
/** Zemin bölge renkleri: hue, doygunluk (%), açıklık kaydırması */
export const FLOOR_ZONE_COLORS = {
  /** Worker alanı — sıcak bej */
  worker: { h: 35, s: 30, l: 52 },
  /** Boss alanı — bordo halı hissi */
  boss: { h: 356, s: 26, l: 40 },
  /** Koridor/nötr */
  neutral: { h: 220, s: 12, l: 46 },
} as const;

/** Okuma animasyonu gösterecek araçlar (Claude Agent SDK araç adları) */
export const READING_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'LS',
  'WebFetch',
  'WebSearch',
  'NotebookRead',
  'TodoRead',
]);

