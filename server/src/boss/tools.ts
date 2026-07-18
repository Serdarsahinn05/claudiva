import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentManager } from '../agents/manager.js';
import type { TaskQueue } from '../tasks/queue.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

/**
 * In-process MCP server given to delegating agents (boss/manager/team-leader).
 * Tool names on the wire: mcp__team__<tool>.
 */
export function createTeamServer(manager: AgentManager, tasks: TaskQueue, selfId: string) {
  return createSdkMcpServer({
    name: 'team',
    version: '1.0.0',
    tools: [
      tool(
        'list_agents',
        'Ekipteki tüm ajanları listeler: id, isim, rol, model, anlık durum ve açıklama. Görev dağıtmadan önce çağır.',
        {},
        async () => {
          const rows = manager
            .list()
            .map(
              (a) =>
                `- id: ${a.config.id} | isim: ${a.config.name} | rol: ${a.config.role} | model: ${a.config.model} | durum: ${a.status}${a.config.description ? ` | açıklama: ${a.config.description}` : ''}`,
            );
          return text(rows.length ? rows.join('\n') : 'Ekipte ajan yok.');
        },
      ),
      tool(
        'get_usage',
        'Ekibin token/maliyet sayımını ve hesabın plan kotasını (5 saatlik / 7 günlük pencere doluluğu) döndürür. Kota kritikse pahalı model yerine ucuzunu seçmek ya da işi bölmek için görev dağıtmadan önce bakabilirsin.',
        {},
        async () => {
          const { total, perAgent } = manager.usageSummary();
          const lines = [
            `Toplam: ${total.inputTokens + total.outputTokens} token · $${total.costUSD.toFixed(4)} · ${total.requests} istek`,
          ];
          for (const [id, u] of Object.entries(perAgent)) {
            if (!u.requests) continue;
            lines.push(`- ${id}: ${u.inputTokens + u.outputTokens} token · $${u.costUSD.toFixed(4)}`);
          }

          const plan = (await manager.planUsage()) as {
            rate_limits_available?: boolean;
            rate_limits?: Record<string, { utilization?: number; resets_at?: string } | null>;
          } | null;
          const rl = plan?.rate_limits;
          if (plan?.rate_limits_available && rl) {
            lines.push('', 'Plan kotası:');
            for (const [key, win] of Object.entries(rl)) {
              if (!win || typeof win.utilization !== 'number') continue;
              const resets = win.resets_at ? ` (sıfırlanma: ${win.resets_at})` : '';
              lines.push(`- ${key}: %${win.utilization} dolu${resets}`);
            }
          } else {
            lines.push('', 'Plan kotası bu oturumda okunamadı (API anahtarı veya kapalı oturum).');
          }
          return text(lines.join('\n'));
        },
      ),
      tool(
        'delegate_task',
        'Bir görevi ekipteki bir ajana atar. wait=true (varsayılan) ise görev bitene kadar bekler ve sonucu döndürür; wait=false ise görev id döndürür, sonucu check_task ile alırsın. Basit görevler için ajanın modeli zaten yapılandırılmıştır; görevi net ve bağımsız yürütülebilir şekilde yaz. Birden fazla bağımsız görevi AYNI anda (paralel tool çağrılarıyla) dağıtabilirsin.',
        {
          agent_id: z.string().describe('Görevin atanacağı ajanın id değeri (list_agents çıktısından)'),
          title: z.string().describe('Görevin kısa başlığı'),
          task: z.string().describe('Görevin tam açıklaması: hedef, bağlam, beklenen çıktı'),
          wait: z.boolean().optional().describe('true: sonucu bekle ve döndür (varsayılan). false: hemen dön.'),
        },
        async (args) => {
          if (args.agent_id === selfId) {
            return text('HATA: Kendine görev atayamazsın; görevi doğrudan kendin yap.');
          }
          if (!manager.get(args.agent_id)) {
            return text(`HATA: "${args.agent_id}" kimlikli ajan yok. list_agents ile kontrol et.`);
          }
          const task = tasks.dispatch({
            title: args.title,
            prompt: args.task,
            assignedTo: args.agent_id,
            assignedBy: selfId,
          });
          if (args.wait === false) {
            return text(`Görev atandı. task_id: ${task.id} (durumu check_task ile sorgula)`);
          }
          const done = await tasks.waitFor(task.id);
          return text(
            `Görev ${done.status === 'done' ? 'tamamlandı' : 'BAŞARISIZ'} (task_id: ${done.id}, ajan: ${done.assignedTo}).\n\n--- Sonuç ---\n${done.result ?? '(sonuç yok)'}`,
          );
        },
      ),
      tool(
        'check_task',
        'Bir görevin durumunu ve (bittiyse) sonucunu döndürür.',
        {
          task_id: z.string().describe('delegate_task tarafından döndürülen görev id'),
        },
        async (args) => {
          const task = tasks.get(args.task_id);
          if (!task) return text(`Görev bulunamadı: ${args.task_id}`);
          return text(
            `Görev ${task.id} | ajan: ${task.assignedTo} | durum: ${task.status}` +
              (task.result ? `\n\n--- Sonuç ---\n${task.result}` : ''),
          );
        },
      ),
      tool(
        'list_tasks',
        'Tüm görevleri (son 30) durumlarıyla listeler.',
        {},
        async () => {
          const rows = tasks
            .list()
            .slice(0, 30)
            .map((t) => `- ${t.id} | ${t.title} | ajan: ${t.assignedTo} | atayan: ${t.assignedBy} | durum: ${t.status}`);
          return text(rows.length ? rows.join('\n') : 'Görev yok.');
        },
      ),
    ],
  });
}

export const TEAM_TOOL_RULES = [
  'mcp__team',
  'mcp__team__list_agents',
  'mcp__team__get_usage',
  'mcp__team__delegate_task',
  'mcp__team__check_task',
  'mcp__team__list_tasks',
];
