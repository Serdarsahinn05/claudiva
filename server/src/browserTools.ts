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
        'Bir web adresini tarayıcıda açar ve sayfanın metnini döndürür. Kullanıcı ' +
          'aynı sayfayı panelde canlı görür. Yalnızca http/https.',
        {
          url: z.string().describe('Açılacak adres (ör. https://example.com)'),
        },
        async (args) => {
          try {
            await browser.navigate(args.url);
            const r = await browser.readText();
            return text(`Açıldı: ${r.title}\n${r.url}\n\n${r.text}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'read',
        'Açık sayfanın metnini ve bağlantılarını döndürür. Gezinmeden önce ' +
          'sayfada ne olduğunu anlamak için kullan.',
        {
          links: z.boolean().optional().describe('Bağlantı listesi de gelsin mi (varsayılan: hayır)'),
        },
        async (args) => {
          try {
            const r = await browser.readText();
            if (!args.links) return text(`${r.title}\n${r.url}\n\n${r.text}`);
            const ls = await browser.links();
            const list = ls.map((l) => `- ${l.text} → ${l.href}`).join('\n');
            return text(`${r.title}\n${r.url}\n\n${r.text}\n\n--- Bağlantılar ---\n${list}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'click',
        'Sayfada bir noktaya tıklar. Koordinatlar görüntü alanına göredir ' +
          '(1280x800, sol üst 0,0). Önce read ile sayfayı oku.',
        {
          x: z.number().describe('Yatay koordinat (0-1280)'),
          y: z.number().describe('Dikey koordinat (0-800)'),
        },
        async (args) => {
          try {
            const s = await browser.click(args.x, args.y);
            return text(`Tıklandı (${args.x},${args.y}). Şimdiki sayfa: ${s.title} — ${s.url}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'type',
        'Odaktaki alana metin yazar. Önce ilgili alana click ile tıkla. ' +
          'submit=true ise sonunda Enter basar.',
        {
          text: z.string().describe('Yazılacak metin'),
          submit: z.boolean().optional().describe('Sonunda Enter basılsın mı'),
        },
        async (args) => {
          try {
            const s = await browser.type(args.text, args.submit === true);
            return text(`Yazıldı. Şimdiki sayfa: ${s.title} — ${s.url}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool(
        'scroll',
        'Sayfayı dikey kaydırır. Pozitif değer aşağı, negatif yukarı.',
        { dy: z.number().describe('Kaydırma miktarı (piksel), ör. 600') },
        async (args) => {
          try {
            await browser.scroll(args.dy);
            const r = await browser.readText();
            return text(`Kaydırıldı.\n\n${r.text}`);
          } catch (e) {
            return text(`HATA: ${(e as Error).message}`);
          }
        },
      ),
      tool('back', 'Tarayıcıda bir sayfa geri gider.', {}, async () => {
        try {
          const s = await browser.back();
          return text(`Geri gidildi. Şimdiki sayfa: ${s.title} — ${s.url}`);
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
