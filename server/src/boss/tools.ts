import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentManager } from '../agents/manager.js';
import type { TaskQueue } from '../tasks/queue.js';
import { agentFacing } from '../i18n.js';

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
        'Lists every agent on the team: id, name, role, model, current status and description. Call it before delegating.',
        {},
        async () => {
          const rows = manager
            .list()
            .map(
              (a) =>
                `- id: ${a.config.id} | name: ${agentFacing(a.config, 'name')} | role: ${a.config.role} | model: ${a.config.model} | status: ${a.status}${a.config.description ? ` | description: ${agentFacing(a.config, 'description')}` : ''}`,
            );
          return text(rows.length ? rows.join('\n') : 'There are no agents on the team.');
        },
      ),
      tool(
        'get_usage',
        'Returns the team\'s token/cost counts and the account plan quota (5-hour / 7-day window usage). Check it before delegating if the quota is tight, to pick a cheaper model or split the work.',
        {},
        async () => {
          const { total, perAgent } = manager.usageSummary();
          const lines = [
            `Total: ${total.inputTokens + total.outputTokens} tokens · $${total.costUSD.toFixed(4)} · ${total.requests} requests`,
          ];
          for (const [id, u] of Object.entries(perAgent)) {
            if (!u.requests) continue;
            lines.push(`- ${id}: ${u.inputTokens + u.outputTokens} tokens · $${u.costUSD.toFixed(4)}`);
          }

          const plan = (await manager.planUsage()) as {
            rate_limits_available?: boolean;
            rate_limits?: Record<string, { utilization?: number; resets_at?: string } | null>;
          } | null;
          const rl = plan?.rate_limits;
          if (plan?.rate_limits_available && rl) {
            lines.push('', 'Plan quota:');
            for (const [key, win] of Object.entries(rl)) {
              if (!win || typeof win.utilization !== 'number') continue;
              const resets = win.resets_at ? ` (resets: ${win.resets_at})` : '';
              lines.push(`- ${key}: ${win.utilization}% used${resets}`);
            }
          } else {
            lines.push('', 'Could not read the plan quota in this session (API key or closed session).');
          }
          return text(lines.join('\n'));
        },
      ),
      tool(
        'delegate_task',
        'Assigns a task to one agent on the team. With wait=true (default) it waits until the task finishes and returns the result; with wait=false it returns the task id and you fetch the result with check_task. The agent\'s model is already configured; write the task so it is clear and can be done on its own. For several independent tasks use delegate_tasks.',
        {
          agent_id: z.string().describe('Id of the agent that gets the task (from list_agents)'),
          title: z.string().describe('Short title of the task'),
          task: z.string().describe('Full description of the task: goal, context, expected output'),
          wait: z.boolean().optional().describe('true: wait and return the result (default). false: return immediately.'),
          after_task_id: z
            .string()
            .optional()
            .describe(
              'If given, the task does not start right away: it starts after this task finishes, with its result added as input. Use it to build a chain. When given, wait is ignored and the task id returns immediately.',
            ),
        },
        async (args) => {
          if (args.agent_id === selfId) {
            return text('ERROR: You cannot assign a task to yourself; do it directly.');
          }
          if (!manager.get(args.agent_id)) {
            return text(`ERROR: There is no agent with id "${args.agent_id}". Check with list_agents.`);
          }

          /**
           * Zincir adımı. `wait` bilerek yok sayılır: zincir boyunca bloklamak
           * waitFor'ın 15dk zaman aşımını kolayca aşar ve tamamlanmış bir işi
           * "BAŞARISIZ" diye raporlardı.
           */
          if (args.after_task_id) {
            const prev = tasks.get(args.after_task_id);
            if (!prev) return text(`ERROR: Task not found: ${args.after_task_id}`);
            const step = tasks.chainAfter(args.after_task_id, {
              title: args.title,
              prompt: args.task,
              assignedTo: args.agent_id,
              assignedBy: selfId,
              parentTaskId: tasks.currentTaskFor(selfId),
            });
            return text(
              `Step added to the chain. task_id: ${step.id} — it starts after "${prev.title}" (${prev.id}) ` +
                `finishes. Check its status with check_task.`,
            );
          }

          const task = tasks.dispatch({
            title: args.title,
            prompt: args.task,
            assignedTo: args.agent_id,
            assignedBy: selfId,
            // Delege eden ajanın O AN çalıştığı görev bu işin ebeveyni olur.
            // Kanıt zinciri bunu izliyor: alt görevde yazılan dosya üst görevin
            // raporunda da görünsün (bkz. TaskInput.parentTaskId).
            parentTaskId: tasks.currentTaskFor(selfId),
          });
          if (args.wait === false) {
            return text(`Task assigned. task_id: ${task.id} (check its status with check_task)`);
          }
          const done = await tasks.waitFor(task.id);
          // Zaman aşımında görev hâlâ çalışıyor olabilir; bunu "BAŞARISIZ"
          // diye raporlamak yanıltıcıydı — iş sürüyor, sadece bekleme bitti.
          if (done.status === 'running' || done.status === 'pending') {
            return text(
              `The task is still running (task_id: ${done.id}, agent: ${done.assignedTo}). The wait timed out; ` +
                `fetch the result with check_task.`,
            );
          }
          return text(
            `Task ${done.status === 'done' ? 'completed' : 'FAILED'} (task_id: ${done.id}, agent: ${done.assignedTo}).\n\n--- Result ---\n${done.result ?? '(no result)'}`,
          );
        },
      ),
      tool(
        'delegate_tasks',
        'Hands several INDEPENDENT tasks to DIFFERENT agents AT THE SAME TIME. Give as many agents as the work needs in one call — two or six (e.g. frontend + backend + researcher + tester + docs all in parallel). They all start at once; with wait=true (default) it waits until all finish and returns every result together — the total time is the longest task, not the sum. Use THIS instead of handing out independent work one by one with delegate_task. For dependent/sequential work use delegate_task with after_task_id.',
        {
          tasks: z
            .array(
              z.object({
                agent_id: z.string().describe('Id of the agent that gets the task (from list_agents)'),
                title: z.string().describe('Short title of the task'),
                task: z.string().describe('Full description of the task: goal, context, expected output'),
              }),
            )
            .min(1)
            .describe('Independent tasks to hand out at the same time'),
          wait: z
            .boolean()
            .optional()
            .describe('true: wait until all finish and return every result (default). false: return the id list immediately.'),
        },
        async (args) => {
          // Önce hepsini doğrula: biri geçersizse hiçbirini dağıtma (kısmi
          // dağıtım, "3 ajana verdim" beklentisini sessizce bozardı).
          const errors: string[] = [];
          args.tasks.forEach((t, i) => {
            if (t.agent_id === selfId) errors.push(`#${i + 1}: you cannot assign a task to yourself`);
            else if (!manager.get(t.agent_id)) errors.push(`#${i + 1}: there is no agent with id "${t.agent_id}"`);
          });
          if (errors.length) {
            return text(`ERROR: no task was handed out. Problems:\n${errors.join('\n')}\nCheck with list_agents.`);
          }

          // Ebeveyn TEK KEZ okunur: dağıtım senkron ama `currentTaskFor` canlı
          // oturumdan okuyor; döngü içinde çağırmak, ilk görev araya girip
          // turu değiştirirse kardeşleri farklı ebeveynlere bağlayabilirdi.
          const parentTaskId = tasks.currentTaskFor(selfId);
          const dispatched = args.tasks.map((t) =>
            tasks.dispatch({
              title: t.title,
              prompt: t.task,
              assignedTo: t.agent_id,
              assignedBy: selfId,
              parentTaskId,
            }),
          );

          if (args.wait === false) {
            const lines = dispatched.map((d) => `- task_id: ${d.id} | agent: ${d.assignedTo} | ${d.title}`);
            return text(`${dispatched.length} tasks handed out at once:\n${lines.join('\n')}\nFetch the results with check_task.`);
          }

          const done = await Promise.all(dispatched.map((d) => tasks.waitFor(d.id)));
          const blocks = done.map((t) => {
            const head =
              t.status === 'done' ? 'completed' : t.status === 'running' || t.status === 'pending' ? 'STILL RUNNING (wait timed out)' : 'FAILED';
            return `### ${t.title} (task_id: ${t.id}, agent: ${t.assignedTo}) — ${head}\n${t.result ?? '(no result)'}`;
          });
          return text(`Results of ${done.length} parallel tasks:\n\n${blocks.join('\n\n---\n\n')}`);
        },
      ),
      tool(
        'check_task',
        'Returns a task\'s status and, if it finished, its result.',
        {
          task_id: z.string().describe('Task id returned by delegate_task'),
        },
        async (args) => {
          const task = tasks.get(args.task_id);
          if (!task) return text(`Task not found: ${args.task_id}`);
          return text(
            `Task ${task.id} | agent: ${task.assignedTo} | status: ${task.status}` +
              (task.result ? `\n\n--- Result ---\n${task.result}` : ''),
          );
        },
      ),
      tool(
        'list_tasks',
        'Lists all tasks (latest 30) with their status.',
        {},
        async () => {
          const rows = tasks
            .list()
            .slice(0, 30)
            .map((t) => `- ${t.id} | ${t.title} | agent: ${t.assignedTo} | assigned by: ${t.assignedBy} | status: ${t.status}`);
          return text(rows.length ? rows.join('\n') : 'No tasks.');
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
  'mcp__team__delegate_tasks',
  'mcp__team__check_task',
  'mcp__team__list_tasks',
];
