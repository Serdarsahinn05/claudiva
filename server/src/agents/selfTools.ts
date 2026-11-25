import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentSession } from './session.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

/**
 * Her ajana verilen in-process "self" MCP sunucusu: ajan, görevin zorluğuna
 * göre kendi modelini değiştirir (otomatik model seçimi).
 * Tel üzerindeki araç adı: mcp__self__set_model.
 */
export function createSelfServer(session: AgentSession) {
  return createSdkMcpServer({
    name: 'self',
    version: '1.0.0',
    tools: [
      tool(
        'set_model',
        'Changes this session\'s model. Pick haiku for a simple task, sonnet for a medium one, ' +
          'opus for a hard one (architecture, complex debugging, critical code). ' +
          'The switch applies immediately; you continue the task on the new model. ' +
          'The base model does not change; if the session restarts it goes back to the base.',
        {
          model: z.enum(['haiku', 'sonnet', 'opus']).describe('Model to switch to'),
          reason: z.string().describe('One-sentence reason (shown in the panel)'),
        },
        async (args) => {
          if (args.model === session.currentModel) {
            return text(`You are already on ${args.model}; nothing changed.`);
          }
          try {
            await session.switchModel(args.model, args.reason);
          } catch (err) {
            return text(`HATA: ${(err as Error).message}`);
          }
          return text(`Model changed to ${args.model}. Continue the task on this model.`);
        },
      ),
    ],
  });
}

export const SELF_TOOL_RULES = ['mcp__self', 'mcp__self__set_model'];
