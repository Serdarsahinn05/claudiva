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

// ---------------------------------------------------------- seçenekli soru
/**
 * Ajanın `AskUserQuestion` aracı izin kanalından gelir ama bir izin DEĞİL:
 * kullanıcıdan seçim ister. Sunucu oto-onayda bile onu bekletir; panel her
 * yüzeyde (terminal, sohbet, pano) izin düğmeleri yerine `QuestionForm` çizer.
 * Cevap `answers` (soru metni → seçilen etiket) olarak döner; çoklu seçimde
 * etiketler ", " ile birleşir.
 */
export const QUESTION_TOOL = 'AskUserQuestion';

export interface QuestionOption {
  label: string;
  description?: string;
  preview?: string;
}
export interface Question {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export function isQuestion(req: PermissionRequestInfo): boolean {
  return req.toolName === QUESTION_TOOL;
}

/** Girdiden soruları güvenle okur (bozuk alanlar atlanır). */
export function questionsOf(req: PermissionRequestInfo): Question[] {
  const raw = (req.input as { questions?: unknown })?.questions;
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue;
    const o = q as Record<string, unknown>;
    if (typeof o.question !== 'string') continue;
    const options = Array.isArray(o.options)
      ? (o.options as unknown[]).flatMap((x) => {
          const v = x as Record<string, unknown>;
          return v && typeof v.label === 'string'
            ? [{
                label: v.label,
                description: typeof v.description === 'string' ? v.description : undefined,
                preview: typeof v.preview === 'string' ? v.preview : undefined,
              }]
            : [];
        })
      : [];
    out.push({
      question: o.question,
      header: typeof o.header === 'string' ? o.header : undefined,
      options,
      multiSelect: o.multiSelect === true,
    });
  }
  return out;
}

export async function answerQuestion(
  agentId: string,
  req: PermissionRequestInfo,
  answers: Record<string, string>
): Promise<void> {
  await api.permission(agentId, req.id, true, undefined, answers).catch(() => {});
}

/** Cevaplamadan geç: ajan kullanıcının cevap vermediğini öğrenir, kendisi karar verir. */
export async function skipQuestion(agentId: string, req: PermissionRequestInfo): Promise<void> {
  await api
    .permission(agentId, req.id, false, 'The user chose not to answer. Decide yourself and say what you chose.')
    .catch(() => {});
}

/** Ajanın bekleyen isteklerinden en az biri soru mu (durum etiketleri için). */
export function hasQuestion(reqs: PermissionRequestInfo[]): boolean {
  return reqs.some(isQuestion);
}

/** İzin isteğinin tek satırlık özeti (komut ya da yol; soruda ilk soru). */
export function permissionSummary(req: PermissionRequestInfo): string {
  if (isQuestion(req)) return questionsOf(req)[0]?.question ?? '';
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
