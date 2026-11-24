/**
 * Arayüz modu: aynı veriyi (ajan dökümleri, görevler, delegasyon) iki ayrı
 * kabukla gösterir.
 *
 *  · `panels` — çok panelli çalışma alanı (varsayılan, uzman görünümü).
 *  · `chat`   — grup sohbeti: ekip bir sohbet odası, her ajan bir katılımcı.
 *               Terminal bilmeyen kullanıcı için.
 *  · `board`  — pano: özelleştirilebilir widget ızgarası, buzlu cam kartlar
 *               (bkz. board.ts, components/board/).
 *
 * Tema ve CLI skin'i gibi TEK GLOBAL tarayıcı tercihi; desen `cliSkins.ts`
 * ile aynı (küçük abonelik deposu + useSyncExternalStore). Mod değişince
 * sunucuya hiçbir şey gitmez; panel yerleşimi (`claudiva.layout.v1`) ayrı
 * tutulduğu için sohbete geçip dönmek yerleşimi bozmaz.
 */
import { useSyncExternalStore } from 'react';
import { L } from './i18n';

export type UiMode = 'panels' | 'chat' | 'board';

export const UI_MODES: { id: UiMode; label: string; desc: string }[] = [
  {
    id: 'panels',
    label: L.uiMode.panels,
    desc: L.uiMode.panelsDesc,
  },
  {
    id: 'chat',
    label: L.uiMode.chat,
    desc: L.uiMode.chatDesc,
  },
  {
    id: 'board',
    label: L.uiMode.board,
    desc: L.uiMode.boardDesc,
  },
];

const STORAGE_KEY = 'claudiva.uiMode';
export const DEFAULT_UI_MODE: UiMode = 'panels';

function isKnown(v: string | null): v is UiMode {
  return v === 'panels' || v === 'chat' || v === 'board';
}

function load(): UiMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isKnown(saved)) return saved;
  } catch {
    // Gizli sekmede localStorage kapalı olabilir; varsayılan yeterli.
  }
  return DEFAULT_UI_MODE;
}

let current: UiMode = load();
const listeners = new Set<() => void>();

export function getUiMode(): UiMode {
  return current;
}

export function setUiMode(mode: UiMode): void {
  if (!isKnown(mode) || mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* yukarıdaki gerekçe */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useUiMode(): UiMode {
  return useSyncExternalStore(subscribe, getUiMode);
}
