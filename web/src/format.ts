import type { TokenUsage } from './types';
import { L } from './i18n';

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function totalTokens(u: TokenUsage): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheCreationTokens;
}

export function fmtCost(usd: number): string {
  return '$' + usd.toFixed(usd >= 1 ? 2 : 4);
}

/** Etiket tabloları sözlükten gelir (bkz. i18n/index.ts: dil değişimi sayfayı yeniler). */
export const STATUS_LABEL: Record<string, string> = L.status;

export const ROLE_LABEL: Record<string, string> = L.roles;
