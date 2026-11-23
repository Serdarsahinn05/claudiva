/**
 * Terminal "CLI skin" kayıt defteri — temalardan AYRI bir eksen.
 *
 * Tema tüm paneli boyar (renk paleti). CLI skin YALNIZCA terminalin görünümünü
 * değiştirir: hangi işaret glifleri kullanılır, karşılama başlığı nasıl çizilir,
 * çalışıyor göstergesi neye benzer. brainless.swerdlow.dev/components'taki üç
 * CLI (Claude Code / Codex / Grok) referans alınarak çıkarıldı; ama shadcn/
 * Tailwind bileşenleri değil, bu projenin token sistemine uyarlanmış yapıdır.
 *
 * Renk skin'e GÖMÜLÜ DEĞİL: skin terminal-kapsamlı token rollerini ezer
 * (`--cli` vb., bkz. index.css `.terminal[data-cli=…]`), böylece her skin aktif
 * TEMA'nın paletiyle birlikte çalışır — Codex temanın nötrlerini, Grok temanın
 * kehribar/uyarı tonunu kullanır. Skin × tema serbestçe birleşir.
 */

import { useSyncExternalStore } from 'react';

export type CliSkin = 'claude' | 'codex' | 'grok';

export interface CliSkinDef {
  id: CliSkin;
  name: string;
  /** Seçicideki tek satırlık karakter tarifi. */
  desc: string;
}

export const CLI_SKINS: CliSkinDef[] = [
  { id: 'claude', name: 'Claude Code', desc: 'Mercan vurgu, ● işaretleri, logo kutusu' },
  { id: 'codex', name: 'Codex', desc: 'Grayscale, › işareti, minimal başlangıç kartı' },
  { id: 'grok', name: 'Grok', desc: 'Kehribar, ◆ işareti, braille spinner, nokta-matris' },
];

/**
 * Olay türünden işaret glifine. `EventLine` `TranscriptKind`'i buradaki anahtara
 * eşler (tool_use→tool, tool_result→toolresult, system/diğer→system).
 */
export const CLI_MARKS: Record<CliSkin, Record<string, string>> = {
  claude: { user: '>', text: '⏺', thinking: '✻', tool: '⏺', toolresult: '⎿', result: '✓', error: '✗', system: '·', local: '⎿', prompt: '❯' },
  codex: { user: '›', text: '•', thinking: '·', tool: '•', toolresult: '→', result: '→', error: '⚠', system: '·', local: '→', prompt: '›' },
  grok: { user: '◆', text: '◇', thinking: '⠿', tool: '◆', toolresult: '└', result: '◆', error: '◆', system: '◇', local: '└', prompt: '❯' },
};

/** Grok'un imza braille spinner'ı (brainless: 90ms'de dönen 10 kare). */
export const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const STORAGE_KEY = 'claudiva.cli';
export const DEFAULT_CLI_SKIN: CliSkin = 'claude';

function isKnown(id: string | null): id is CliSkin {
  return !!id && CLI_SKINS.some((s) => s.id === id);
}

function load(): CliSkin {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isKnown(saved)) return saved;
  } catch {
    // localStorage kapalı olabilir (gizli sekme) — skin kaybı önemsiz.
  }
  return DEFAULT_CLI_SKIN;
}

/**
 * Tema gibi TEK GLOBAL seçim (tüm terminaller aynı tipi kullanır). Küçük
 * abonelik deposu: `setCliSkin` tüm açık terminalleri anında tazeler,
 * `useCliSkin` bileşenleri bağlar. Ayrı bir React context'e gerek yok.
 */
let current: CliSkin = load();
const listeners = new Set<() => void>();

export function getCliSkin(): CliSkin {
  return current;
}

export function setCliSkin(skin: CliSkin): void {
  if (!isKnown(skin) || skin === current) return;
  current = skin;
  try {
    localStorage.setItem(STORAGE_KEY, skin);
  } catch {
    /* yukarıdaki gerekçe */
  }
  for (const l of listeners) l();
}

export function subscribeCliSkin(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Global CLI skin'e bağlanır; değişince bileşen yeniden çizilir. */
export function useCliSkin(): CliSkin {
  return useSyncExternalStore(subscribeCliSkin, getCliSkin);
}
