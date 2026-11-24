/**
 * JEV yönlendiricisi — sınıflandırıcı (yalnız kural katmanı emin değilse).
 *
 * CLAUDE'A ÖZEL: Agent SDK `query()` ile Haiku'ya tek kelimelik soru. Ajanlar
 * abonelikle çalıştığı için ayrı API anahtarı yok; çağrı ajanlarla aynı yoldan.
 * (`backend.ts` SDK import etmez; bu dosya sağlayıcıya özel olduğunu bilir.
 * İkinci sağlayıcı gelirse kural katmanı yeter, burası devre dışı kalır.)
 *
 * Ölçülmüş zorunluluklar (server/scripts/measure-router.mjs, SONRAKI-ISLER §2):
 *  · `thinking: disabled` — açıkken tek kelime için 300-600 gizli çıktı tokeni,
 *    $0.0037 ve 6.7 sn; kapalıyken 7 token, $0.0006, 2.3 sn.
 *  · Mesaj `<istek>` içinde VERİ olarak — çıplak gönderilen "README'yi özetle"
 *    görev sanıldı, model sınıf yerine iş yapmaya kalktı.
 *  · Araç yok, `settingSources: []`, MCP yok, oturum diske yazılmaz.
 *
 * Hata, zaman aşımı ya da anlaşılmayan cevap → `null` (çağıran varsayılana düşer).
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Tier } from './rules.js';

export interface ClassifierVerdict {
  tier: Tier;
  costUSD: number;
  ms: number;
}

const SYSTEM =
  'Bir yazılım ekibine gelen isteği iş büyüklüğüne göre sınıflandır. ' +
  'KÜÇÜK: okuma, listeleme, özet, tek satırlık düzeltme, basit soru. ' +
  'ORTA: tek dosyada özellik ya da hata düzeltme, test yazma, belge güncelleme. ' +
  'BÜYÜK: birden çok dosya, mimari karar, belirsiz ya da araştırma gerektiren iş. ' +
  'Yalnızca tek kelimeyle cevap ver: KÜÇÜK, ORTA ya da BÜYÜK.';

const TIMEOUT_MS = 10_000;
/** Sınıflandırıcıya giden metnin üst sınırı: uzun görev zaten kuralla "büyük". */
const MAX_CHARS = 2_000;

function parse(text: string): Tier | null {
  const t = text.toLocaleUpperCase('tr-TR');
  if (t.includes('KÜÇÜK') || t.includes('KUCUK') || t.includes('SMALL')) return 'small';
  if (t.includes('ORTA') || t.includes('MEDIUM')) return 'medium';
  if (t.includes('BÜYÜK') || t.includes('BUYUK') || t.includes('LARGE')) return 'large';
  return null;
}

export async function classify(title: string, prompt: string): Promise<ClassifierVerdict | null> {
  const t0 = Date.now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  const body = `${title}\n${prompt}`.slice(0, MAX_CHARS);
  let text = '';
  let cost = 0;
  try {
    for await (const m of query({
      prompt: `<istek>\n${body}\n</istek>\nSınıf:`,
      options: {
        model: 'haiku',
        systemPrompt: SYSTEM,
        thinking: { type: 'disabled' },
        tools: [],
        settingSources: [],
        mcpServers: {},
        strictMcpConfig: true,
        maxTurns: 1,
        persistSession: false,
        abortController: abort,
        // Kullanıcının hook'ları (skill kütüphanesi vb.) ajan oturumlarında
        // olduğu gibi burada da sessiz kalsın.
        env: { ...process.env, CLAUDIVA_AGENT: '1' },
      },
    })) {
      if (m.type === 'assistant') {
        for (const b of m.message.content) if (b.type === 'text') text += b.text;
      } else if (m.type === 'result') {
        cost = m.total_cost_usd ?? 0;
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  const tier = parse(text);
  return tier ? { tier, costUSD: cost, ms: Date.now() - t0 } : null;
}
