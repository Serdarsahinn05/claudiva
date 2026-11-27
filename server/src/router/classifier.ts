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
import { claudeExecutable } from '../agents/claudeExecutable.js';
import type { Tier } from './rules.js';

export interface ClassifierVerdict {
  tier: Tier;
  costUSD: number;
  ms: number;
}

const SYSTEM =
  // Ajana giden metin: İngilizce (bkz. i18n.ts). İstek Türkçe de olabilir;
  // parse() iki dilin cevabını da tanır.
  'Classify a request sent to a software team by the size of the work. ' +
  'SMALL: reading, listing, summarizing, a one-line fix, a simple question. ' +
  'MEDIUM: a feature or bug fix in one file, writing tests, updating docs. ' +
  'LARGE: several files, an architecture decision, unclear work or work that needs research. ' +
  'Answer with a single word only: SMALL, MEDIUM or LARGE.';

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
      prompt: `<request>\n${body}\n</request>\nClass:`,
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
        pathToClaudeCodeExecutable: claudeExecutable().path,
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
