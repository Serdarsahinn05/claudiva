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
        'Marks a task assigned to you as completed. Call it with the id from the task message and summarize the result. You MUST call it when you finish the task; otherwise the task stays open in the panel.',
        {
          task_id: z.string().describe('The id in the task message heading'),
          summary: z.string().describe('A clear summary of what was done; shown in the panel as the task result'),
          failed: z
            .boolean()
            .optional()
            .describe('Pass true if the task could not be completed and explain why in summary'),
        },
        async (args) => {
          const task = tasks.get(args.task_id);
          if (!task) return text(`ERROR: Task not found: ${args.task_id}`);
          if (task.assignedTo !== selfId) {
            return text(`ERROR: ${args.task_id} is not assigned to you (assigned to: ${task.assignedTo}).`);
          }
          if (task.status === 'done' || task.status === 'failed') {
            return text(`Task ${args.task_id} is already closed (status: ${task.status}).`);
          }
          tasks.complete(args.task_id, args.failed ? 'failed' : 'done', args.summary);
          return text(`Task ${args.task_id} closed (status: ${args.failed ? 'failed' : 'done'}).`);
        },
      ),
    ],
  });
}

export const TASK_TOOL_RULES = ['mcp__task', 'mcp__task__complete_task'];
