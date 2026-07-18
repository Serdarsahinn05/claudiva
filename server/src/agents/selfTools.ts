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
        'Bu oturumun modelini değiştirir. Görev basitse haiku, ortaysa sonnet, ' +
          'zorsa (mimari, karmaşık hata ayıklama, kritik kod) opus seç. ' +
          'Geçiş anında uygulanır; göreve yeni modelle devam edersin. ' +
          'Temel model değişmez; oturum yeniden başlarsa temele dönülür.',
        {
          model: z.enum(['haiku', 'sonnet', 'opus']).describe('Geçilecek model'),
          reason: z.string().describe('Tek cümlelik gerekçe (panelde gösterilir)'),
        },
        async (args) => {
          if (args.model === session.currentModel) {
            return text(`Zaten ${args.model} modelindesin; değişiklik yapılmadı.`);
          }
          try {
            await session.switchModel(args.model, args.reason);
          } catch (err) {
            return text(`HATA: ${(err as Error).message}`);
          }
          return text(`Model ${args.model} olarak değiştirildi. Göreve bu modelle devam et.`);
        },
      ),
    ],
  });
}

export const SELF_TOOL_RULES = ['mcp__self', 'mcp__self__set_model'];
