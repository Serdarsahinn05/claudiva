import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { BrowserSession } from './browser.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

/**
 * Ajanların tarayıcıyı sürmesi — "browser" MCP sunucusu.
 * Tel üzerindeki adlar: mcp__browser__open / read / click / type / scroll / back.
 *
 * İZİN: ayrı bir kapı YAZILMADI. Bütün MCP araçları `AgentSession.buildCanUseTool`
 * üzerinden geçtiği için bu araçlar da kendiliğinden izin bandına düşüyor —
 * ikinci bir kapı ilkiyle ayrışır ve biri sessizce delinirdi.
 *
 * Tarayıcı KULLANICIYLA ORTAK: ajanın açtığı sayfayı kullanıcı panelde canlı
 * görür ve devralabilir. Ajana ayrı bir örnek vermek "ajan ne yapıyor" sorusunu
 * yeniden görünmez kılardı — bu panelin varlık sebebi tam da onu görünür kılmak.
 *
 * Ajan METİN okur, ekran görüntüsü DEĞİL: sayfa metni zaten sayfada duruyor ve
 * görüntü yollamak hem pahalı hem de modelin işine yaramıyor. Görüntü insana ait.
 */
export function createBrowserServer(browser: BrowserSession) {
  return createSdkMcpServer({
    name: 'browser',
    version: '1.0.0',
    tools: [
      tool(
        'open',
        'Opens a web address in the browser and returns the page text. The user ' +
          'sees the same page live in the panel. http/https only.',
        {
          url: z.string().describe('Address to open (e.g. https://example.com)'),
        },
        async (args) => {
          try {
            await browser.navigate(args.url);
            const r = await browser.readText();
            return text(`Opened: ${r.title}\n${r.url}\n\n${r.text}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'read',
        'Returns the open page\'s text and links. Use it to understand what is ' +
          'on the page before navigating.',
        {
          links: z.boolean().optional().describe('Also return the list of links (default: no)'),
        },
        async (args) => {
          try {
            const r = await browser.readText();
            if (!args.links) return text(`${r.title}\n${r.url}\n\n${r.text}`);
            const ls = await browser.links();
            const list = ls.map((l) => `- ${l.text} → ${l.href}`).join('\n');
            return text(`${r.title}\n${r.url}\n\n${r.text}\n\n--- Links ---\n${list}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'click',
        'Clicks a point on the page. Coordinates are relative to the viewport ' +
          '(1280x800, top left 0,0). Read the page with read first.',
        {
          x: z.number().describe('Yatay koordinat (0-1280)'),
          y: z.number().describe('Dikey koordinat (0-800)'),
        },
        async (args) => {
          try {
            const s = await browser.click(args.x, args.y);
            return text(`Clicked (${args.x},${args.y}). Current page: ${s.title} — ${s.url}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'type',
        'Types text into the focused field. Click the field with click first. ' +
          'With submit=true it presses Enter at the end.',
        {
          text: z.string().describe('Text to type'),
          submit: z.boolean().optional().describe('Press Enter at the end'),
        },
        async (args) => {
          try {
            const s = await browser.type(args.text, args.submit === true);
            return text(`Typed. Current page: ${s.title} — ${s.url}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'scroll',
        'Scrolls the page vertically. Positive goes down, negative goes up.',
        { dy: z.number().describe('Scroll amount in pixels, e.g. 600') },
        async (args) => {
          try {
            await browser.scroll(args.dy);
            const r = await browser.readText();
            return text(`Scrolled.\n\n${r.text}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool('back', 'Goes back one page in the browser.', {}, async () => {
        try {
          const s = await browser.back();
          return text(`Went back. Current page: ${s.title} — ${s.url}`);
        } catch (e) {
          return text(`HATA: ${(e as Error).message}`);
        }
      }),
    ],
  });
}

/**
 * Bu sunucunun araçları BİLEREK bir `allowedTools` listesi ihraç ETMEZ.
 *
 * Diğer iç sunucular (self/team/task) araçlarını allowlist'e ekliyor ve bu
 * doğru: hepsi panelin kendi içinde kalan işler. `allowedTools`'a giren bir
 * araç `canUseTool`'a HİÇ sorulmuyor (ölçüldü) — tarayıcı dış dünyaya
 * çıktığı için o muafiyet burada bir güvenlik açığı olurdu: oto-onayı KAPALI
 * bir ajan bile izinsiz sayfa açardı. Listesiz bırakılınca her çağrı normal
 * izin kapısına düşer.
 */
