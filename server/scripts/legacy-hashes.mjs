#!/usr/bin/env node
/**
 * server/src/agentLegacyContent.ts üreticisi.
 *
 * Paket ajan dosyalarının (personality.md, SKILL.md, .claude-plugin/plugin.json)
 * git geçmişindeki BÜTÜN sürümlerinin parmak izini toplar; bugünkü (HEAD)
 * sürüm hariç. agentUpgrade.ts diskteki dosya bu listedeyse "kullanıcı
 * değiştirmemiş" sayar ve paketteki sürümle değiştirir.
 *
 * Neden bütün geçmiş: ilk tablo yalnız v0.1.1 ve çeviri öncesi HEAD'i
 * biliyordu; v0.1.1'den önce kurulmuş bir kurulumun plugin.json'ları ve
 * kişilik dosyaları hiç güncellenmedi (ölçüldü, 2026-11-24).
 *
 * SAHADA_GORULEN: hiçbir commit'te bulunmayan ama gerçek bir kurulumda
 * görülen eski paket içerikleri (commit edilmemiş ara sürümden tohumlanmış).
 * Yalnız içeriği paketin eski hâli olduğu DOĞRULANMIŞ dosyalar girer;
 * kullanıcı düzenlemesi buraya girerse o düzenleme ezilir.
 *
 * Kullanım (repo kökünden): node server/scripts/legacy-hashes.mjs
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';

const SAHADA_GORULEN = {
  // Eski "Boss — Üst Akıl" / "Tech Lead — Teknik Yönetici" (delegate_tasks öncesi).
  'boss/personality.md': ['b6debc389d0a4210'],
  'tech-lead/personality.md': ['ca96691b65743125'],
};

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// agentUpgrade.ts contentHash ile AYNI kural: CRLF -> LF, sondaki boşluk kırpılır.
const hash = (text) =>
  crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n').trimEnd()).digest('hex').slice(0, 16);
const WANTED = /^agents\/[^/]+\/(personality\.md|skills\/[^/]+\/SKILL\.md|\.claude-plugin\/plugin\.json)$/;

// Bugünkü paket: dışarıda kalır (yoksa güncel dosya "eski" sayılırdı, zararsız ama gürültü).
const current = new Map();
for (const f of sh('git ls-tree -r --name-only HEAD agents').split('\n')) {
  if (!WANTED.test(f) || f.includes('/find-skills/')) continue;
  current.set(f.replace(/^agents\//, ''), hash(sh(`git show HEAD:"${f}"`)));
}

const out = {};
const commits = sh('git log --format=%H -- agents').split('\n').filter(Boolean);
for (const c of commits) {
  const files = sh(`git ls-tree -r --name-only ${c} agents`).split('\n');
  for (const f of files) {
    if (!WANTED.test(f) || f.includes('/find-skills/')) continue;
    const rel = f.replace(/^agents\//, '');
    if (!current.has(rel)) continue; // pakette artık olmayan dosya: güncellenecek hedef yok
    const h = hash(sh(`git show ${c}:"${f}"`));
    if (h === current.get(rel)) continue;
    (out[rel] ??= new Set()).add(h);
  }
}
for (const [rel, hs] of Object.entries(SAHADA_GORULEN)) for (const h of hs) (out[rel] ??= new Set()).add(h);

const body = Object.keys(out)
  .sort()
  .map((k) => `  ${JSON.stringify(k)}: [${[...out[k]].sort().map((h) => JSON.stringify(h)).join(', ')}],`)
  .join('\n');

const file = `/**
 * Paket ajanlarının ESKİ dosya içeriklerinin parmak izleri.
 *
 * Anahtar \`agents/\` altına göre göreli yoldur; değer, o dosyanın daha önce
 * yayımlanmış sürümlerinin sha256 özetinin ilk 16 hex karakteridir (CRLF → LF
 * normalize edilerek). \`agentUpgrade.ts\` diskteki dosyanın özeti bu listedeyse
 * dosyanın kullanıcı tarafından değiştirilmediğine hükmeder ve paketteki yeni
 * sürümle değiştirir.
 *
 * ÜRETİLMİŞ DOSYA, elle değiştirme: \`node server/scripts/legacy-hashes.mjs\`.
 * Kaynak git geçmişindeki bütün sürümler + betikteki SAHADA_GORULEN listesi.
 * Paketteki bir ajan dosyası değişince commit'ten SONRA betiği yeniden çalıştır.
 */
export const LEGACY_CONTENT: Record<string, string[]> = {
${body}
};
`;
fs.writeFileSync('server/src/agentLegacyContent.ts', file);
console.log(`${Object.keys(out).length} dosya, ${Object.values(out).reduce((n, s) => n + s.size, 0)} eski sürüm`);
