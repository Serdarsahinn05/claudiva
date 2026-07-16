import type { TokenUsage } from './types';

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

export const STATUS_LABEL: Record<string, string> = {
  offline: 'kapalı',
  idle: 'boşta',
  working: 'çalışıyor',
  waiting: 'onay bekliyor',
};

export const ROLE_LABEL: Record<string, string> = {
  boss: 'Patron',
  manager: 'Yönetici',
  'team-leader': 'Takım Lideri',
  worker: 'Çalışan',
};
