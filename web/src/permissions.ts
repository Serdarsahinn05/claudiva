/**
 * İzin isteğine yanıt — terminal ve sohbet aynı yolu kullanır.
 *
 * Sıra sabittir ve her iki yüzeyde aynı anlamı taşır:
 *   0 → izin ver · 1 → izin ver + bu ajanda bir daha sorma (autoApprove) · 2 → reddet
 */
import { api } from './api';
import type { PermissionRequestInfo } from './types';
import { L } from './i18n';

export const PERMISSION_OPTIONS = [L.permission.allow, L.permission.allowAlways, L.permission.deny] as const;
export type PermissionChoice = 0 | 1 | 2;

export async function answerPermission(
  agentId: string,
  req: PermissionRequestInfo,
  choice: PermissionChoice
): Promise<void> {
  if (choice === 1) await api.updateAgent(agentId, { autoApprove: true }).catch(() => {});
  await api.permission(agentId, req.id, choice !== 2).catch(() => {});
}

/** İzin isteğinin tek satırlık özeti (komut ya da yol). */
export function permissionSummary(req: PermissionRequestInfo): string {
  const input = req.input ?? {};
  const pick = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : null);
  return (
    pick('command') ??
    pick('file_path') ??
    pick('url') ??
    pick('path') ??
    JSON.stringify(input).slice(0, 300)
  );
}
