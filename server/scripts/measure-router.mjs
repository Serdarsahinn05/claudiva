#!/usr/bin/env node
/**
 * JEV model yönlendiricisi — İLK İŞ: maliyeti ölç, varsayma (docs/SONRAKI-ISLER.md §2).
 *
 * A) Sınıflandırıcı: kural katmanının emin olmadığı mesaj için Haiku'ya tek
 *    satırlık soru; cevap tek kelime (KÜÇÜK | ORTA | BÜYÜK). Ajanlar abonelikle
 *    çalıştığı için çağrı Agent SDK `query()` üzerinden, ajanlarla AYNI yoldan:
 *    düz dizge sistem istemi (preset DEĞİL), araç yok, settingSources: [] (CLAUDE.md
 *    ve skill yüklenmesin), MCP yok, oturum diske yazılmaz.
 * B) Karşılaştırma: bir ajan oturumunun açılış maliyeti (claude_code preset +
 *    kişilik + ajan skill'leri + kullanıcı/proje ayarları), tek "5+5" turu.
 *    Gerçek oturumdan biraz düşük çıkar: team/self/task MCP sunucuları ve hafıza
 *    dizinleri burada yok.
 *
 * Kullanım (repo kökünden): node server/scripts/measure-router.mjs [A|B|AB]
 * Model çağrısı yapar, yani küçük de olsa harcama doğurur.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const which = process.argv[2] ?? 'AB';
const env = { ...process.env, CLAUDIVA_AGENT: '1' };

async function run(prompt, options) {
  const t0 = Date.now();
  let text = '';
  let result = null;
  for await (const m of query({ prompt, options: { persistSession: false, maxTurns: 1, env, ...options } })) {
    if (m.type === 'assistant') {
      for (const b of m.message.content) if (b.type === 'text') text += b.text;
    }
    if (m.type === 'result') result = m;
  }
  const u = result?.usage ?? {};
  return {
    ms: Date.now() - t0,
    text: text.trim(),
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cost: result?.total_cost_usd ?? 0,
  };
}

const CLASSIFIER =
  'Bir yazılım ekibine gelen isteği iş büyüklüğüne göre sınıflandır. ' +
  'KÜÇÜK: okuma, listeleme, özet, tek satırlık düzeltme, basit soru. ' +
  'ORTA: tek dosyada özellik ya da hata düzeltme, test yazma, belge güncelleme. ' +
  'BÜYÜK: birden çok dosya, mimari karar, belirsiz ya da araştırma gerektiren iş. ' +
  'Yalnızca tek kelimeyle cevap ver: KÜÇÜK, ORTA ya da BÜYÜK.';

const SAMPLES = [
  'README dosyasındaki kurulum adımlarını özetle',
  'package.json içinde hangi sürüm var?',
  'Login formunda e-posta boşken hata mesajı çıkmıyor, düzelt',
  'TaskQueue için birim testleri yaz',
  'Kimlik doğrulamayı oturum çerezinden JWT tabanlı yapıya taşı, tüm uçları güncelle',
  'Uygulamanın neden yavaş açıldığını araştır ve bir iyileştirme planı çıkar',
];

if (which.includes('A')) {
  console.log('\n== A) Sınıflandırıcı (haiku, araçsız, ayarsız) ==');
  const rows = [];
  for (const s of SAMPLES) {
    // Mesaj VERİ olarak sarılır: çıplak gönderilince model "README'yi özetle"yi
    // görev sanıp yanıtlamaya çalıştı (ölçüldü). Düşünme kapalı: açıkken tek
    // kelimelik cevap 300-600 çıktı tokeni ve ~6.7 sn tuttu (ölçüldü).
    const r = await run(`<istek>
${s}
</istek>
Sınıf:`, {
      model: 'haiku',
      systemPrompt: CLASSIFIER,
      thinking: { type: 'disabled' },
      tools: [],
      settingSources: [],
      mcpServers: {},
      strictMcpConfig: true,
    });
    rows.push(r);
    console.log(
      `${r.text.padEnd(8)} girdi ${r.input} · çıktı ${r.output} · önbellek oku ${r.cacheRead} / yaz ${r.cacheWrite} · $${r.cost.toFixed(5)} · ${r.ms}ms  ← ${s}`
    );
  }
  const avg = (k) => rows.reduce((n, r) => n + r[k], 0) / rows.length;
  console.log(
    `ORTALAMA: girdi ${avg('input').toFixed(0)} · önbellek oku ${avg('cacheRead').toFixed(0)} / yaz ${avg('cacheWrite').toFixed(0)} · çıktı ${avg('output').toFixed(0)} · $${avg('cost').toFixed(5)} · ${avg('ms').toFixed(0)}ms`
  );
}

if (which.includes('B')) {
  console.log('\n== B) Ajan oturumu açılışı (tech-lead kişiliği, skill\'ler, kullanıcı/proje ayarları) ==');
  const home = process.env.CLAUDIVA_HOME ?? path.join(os.homedir(), '.claudiva');
  const dir = path.join(home, 'agents', 'tech-lead');
  const personality = fs.readFileSync(path.join(dir, 'personality.md'), 'utf8');
  for (const model of (process.env.MEASURE_MODELS ?? 'haiku,sonnet').split(',')) {
    const r = await run('5+5 kaç? Yalnız sayıyı yaz.', {
      model,
      cwd: process.cwd(),
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `# Kimlik\nSen "Teknik Lider" adlı bir ajansın. Rolün: manager.\n\n${personality}`,
      },
      settingSources: ['user', 'project', 'local'],
      plugins: [{ type: 'local', path: dir, skipMcpDiscovery: true }],
    });
    console.log(
      `${model.padEnd(6)} cevap "${r.text}" · girdi ${r.input} · önbellek oku ${r.cacheRead} / yaz ${r.cacheWrite} · çıktı ${r.output} · $${r.cost.toFixed(4)} · ${r.ms}ms`
    );
  }
}

/**
 * C) Oturum İÇİNDE model değişimi: önbellek modele özgüyse, mesaj başına model
 * değiştiren bir yönlendirici her geçişte yeni modelde bütün öneki yeniden
 * yazar. Bugünkü otomatik model seçimi (set_model) de bunu yapıyor.
 * Tur 1 haiku, tur 2 aynı modelde (kontrol), tur 3 sonnet'e geçilmiş, tur 4
 * yine haiku. Her turun önbellek okuma/yazma değerleri ayrı yazılır.
 */
if (which.includes('C')) {
  console.log('\n== C) Oturum içinde model değişimi (haiku → haiku → sonnet → haiku) ==');
  const home = process.env.CLAUDIVA_HOME ?? path.join(os.homedir(), '.claudiva');
  const dir = path.join(home, 'agents', 'tech-lead');
  const personality = fs.readFileSync(path.join(dir, 'personality.md'), 'utf8');
  const plan = ['haiku', 'haiku', 'sonnet', 'haiku'];
  const asks = ['5+5 kaç? Yalnız sayıyı yaz.', '6+6 kaç? Yalnız sayıyı yaz.', '7+7 kaç? Yalnız sayıyı yaz.', '8+8 kaç? Yalnız sayıyı yaz.'];
  let next = null;
  const gate = () => new Promise((r) => (next = r));
  async function* input() {
    for (let i = 0; i < asks.length; i++) {
      if (i > 0) await gate();
      yield { type: 'user', message: { role: 'user', content: asks[i] }, parent_tool_use_id: null, session_id: '' };
    }
  }
  const q = query({
    prompt: input(),
    options: {
      persistSession: false,
      env,
      model: plan[0],
      cwd: process.cwd(),
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `# Kimlik\nSen "Teknik Lider" adlı bir ajansın. Rolün: manager.\n\n${personality}`,
      },
      settingSources: ['user', 'project', 'local'],
      plugins: [{ type: 'local', path: dir, skipMcpDiscovery: true }],
    },
  });
  let turn = 0;
  let prevCost = 0;
  for await (const m of q) {
    if (m.type !== 'result') continue;
    const u = m.usage ?? {};
    const cost = (m.total_cost_usd ?? 0) - prevCost;
    prevCost = m.total_cost_usd ?? prevCost;
    console.log(
      `tur ${turn + 1} ${plan[turn].padEnd(6)} önbellek oku ${u.cache_read_input_tokens ?? 0} / yaz ${u.cache_creation_input_tokens ?? 0} · girdi ${u.input_tokens ?? 0} · çıktı ${u.output_tokens ?? 0} · tur maliyeti ≈ $${cost.toFixed(4)}`
    );
    turn++;
    if (turn >= asks.length) break;
    if (plan[turn] !== plan[turn - 1]) await q.setModel(plan[turn]);
    next?.();
  }
  q.interrupt?.().catch?.(() => {});
}
