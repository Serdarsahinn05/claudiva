import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { TaskQueue } from './queue.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

/**
 * Görev bitişini ajanın kendisinin bildirdiği in-process MCP sunucusu.
 * Tel üzerindeki ad: mcp__task__complete_task.
 *
 * Neden araç, neden tur sonu değil: SDK'da gönderilen mesaj ile biten tur
 * 1:1 DEĞİL. Ölçülen iki kırılma:
 *  - Tur sürerken gelen mesaj o turun içine emilir → iki mesaj, tek sonuç.
 *  - Monitor gibi arka plan bildirimleri hiç mesaj olmadan yeni tur doğurur.
 * Bu yüzden konumsal eşleştirme ilkesel olarak düzeltilemez; bitişi yalnızca
 * işi yapan bilir.
 */
export function createTaskServer(tasks: TaskQueue, selfId: string) {
  return createSdkMcpServer({
    name: 'task',
    version: '1.0.0',
    tools: [
      tool(
        'complete_task',
        'Sana atanan bir görevi tamamlandı olarak işaretler. Görev mesajındaki id ile çağır ve sonucu özetle. Görevi bitirdiğinde bunu çağırmak ZORUNLUDUR; çağırmazsan görev panelde açık kalır.',
        {
          task_id: z.string().describe('Görev mesajının başlığındaki id'),
          summary: z.string().describe('Ne yapıldığının net özeti; panelde görevin sonucu olarak görünür'),
          failed: z
            .boolean()
            .optional()
            .describe('Görev tamamlanamadıysa true ver ve summary alanında nedenini yaz'),
        },
        async (args) => {
          const task = tasks.get(args.task_id);
          if (!task) return text(`HATA: Görev bulunamadı: ${args.task_id}`);
          if (task.assignedTo !== selfId) {
            return text(`HATA: ${args.task_id} sana atanmadı (atanan: ${task.assignedTo}).`);
          }
          if (task.status === 'done' || task.status === 'failed') {
            return text(`Görev ${args.task_id} zaten kapalı (durum: ${task.status}).`);
          }
          tasks.complete(args.task_id, args.failed ? 'failed' : 'done', args.summary);
          return text(`Görev ${args.task_id} kapatıldı (durum: ${args.failed ? 'failed' : 'done'}).`);
        },
      ),
    ],
  });
}

export const TASK_TOOL_RULES = ['mcp__task', 'mcp__task__complete_task'];
