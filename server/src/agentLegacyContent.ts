/**
 * Paket ajanlarının ESKİ dosya içeriklerinin parmak izleri.
 *
 * Anahtar `agents/` altına göre göreli yoldur; değer, o dosyanın daha önce
 * yayımlanmış sürümlerinin sha256 özetinin ilk 16 hex karakteridir (CRLF → LF
 * normalize edilerek). `agentUpgrade.ts` diskteki dosyanın özeti bu listedeyse
 * dosyanın kullanıcı tarafından değiştirilmediğine hükmeder ve paketteki yeni
 * sürümle değiştirir.
 *
 * ÜRETİLMİŞ DOSYA, elle değiştirme: `node server/scripts/legacy-hashes.mjs`.
 * Kaynak git geçmişindeki bütün sürümler + betikteki SAHADA_GORULEN listesi.
 * Paketteki bir ajan dosyası değişince commit'ten SONRA betiği yeniden çalıştır.
 */
export const LEGACY_CONTENT: Record<string, string[]> = {
  "boss/.claude-plugin/plugin.json": ["042a7af0f124188a", "089ac1252c4ee588", "101b0ba0761cb0c4"],
  "boss/personality.md": ["2c4878d21671af33", "2e67f9d2d6c375ab", "7709decf86811623", "b6debc389d0a4210", "e366def40c219892"],
  "boss/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "boss/skills/gorev-bolme/SKILL.md": ["65d2529bb3918566"],
  "boss/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "boss/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "boss/skills/is-baslat/SKILL.md": ["50cb562233c27bf2"],
  "boss/skills/ozellik-yeni/SKILL.md": ["f398c4d90e8bafc8"],
  "docs/.claude-plugin/plugin.json": ["c6e9cf3bec885c5c", "f95122dca39e0b2b"],
  "docs/personality.md": ["3133403da7b546d2", "851423845702629d"],
  "docs/skills/commit-pr/SKILL.md": ["e4bf9ae9e00ba6c3"],
  "docs/skills/dokuman-guncelle/SKILL.md": ["e696a528b11e7885"],
  "docs/skills/dokuman-stili/SKILL.md": ["8fdaca0075315295"],
  "docs/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "docs/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "docs/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "frontend-dev/.claude-plugin/plugin.json": ["18620a6cf4fe2899", "416738cb26b04b48"],
  "frontend-dev/personality.md": ["0a02800e852267c8", "0ac065d922f3fc0e"],
  "frontend-dev/skills/arayuz-ilkeleri/SKILL.md": ["4a3bf6672ce75592"],
  "frontend-dev/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "frontend-dev/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "frontend-dev/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "frontend-dev/skills/ui-bilesen/SKILL.md": ["27344da49607a772"],
  "researcher/.claude-plugin/plugin.json": ["55630d04a1585091", "efed48ad6acc23ca"],
  "researcher/personality.md": ["23852c3e810d44d9", "bf14ff297600e36d"],
  "researcher/skills/arastir/SKILL.md": ["1ff36bcd4cadf75e"],
  "researcher/skills/arastirma-yontemi/SKILL.md": ["51a84405681eb143"],
  "researcher/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "researcher/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "researcher/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "reviewer/.claude-plugin/plugin.json": ["2aaff70bb753e034", "fead0081ca7367bf"],
  "reviewer/personality.md": ["1be1cda84083fac8", "6cde4711da00c3a1"],
  "reviewer/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "reviewer/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "reviewer/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "reviewer/skills/inceleme-yap/SKILL.md": ["45bf6e3a50d8807b"],
  "reviewer/skills/kod-inceleme/SKILL.md": ["dc5dd0cf867ef033"],
  "senior-dev/.claude-plugin/plugin.json": ["79fdcd9a7303ba52", "a5d6cbdfe3ac6e6d"],
  "senior-dev/personality.md": ["3d92fdcf5e3454fa", "d524407fd6c4e805"],
  "senior-dev/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "senior-dev/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "senior-dev/skills/hata-avi/SKILL.md": ["b6147c137ebda5f0"],
  "senior-dev/skills/hata-ayiklama/SKILL.md": ["4ed2e8d1ccae27bd"],
  "senior-dev/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "senior-dev/skills/refactor/SKILL.md": ["aef32c0e1b61fddd"],
  "senior-dev/skills/temiz-kod/SKILL.md": ["34a8551499cc8256"],
  "tech-lead/.claude-plugin/plugin.json": ["bb5236d763f97292", "e769c09be6957d9d"],
  "tech-lead/personality.md": ["4dbef0bd8ccc1f5a", "ca96691b65743125", "d3d4a6e86cbe6e47"],
  "tech-lead/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "tech-lead/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "tech-lead/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "tech-lead/skills/kalite-kontrol/SKILL.md": ["04db959adcda31ab"],
  "tech-lead/skills/plan-yap/SKILL.md": ["925d38387b6ed6fb"],
  "tester/.claude-plugin/plugin.json": ["68a36233615ec35f", "c6ae770e9de63511"],
  "tester/personality.md": ["5939b3edd677316c", "abf7aa74d92f0213"],
  "tester/skills/durum-ozeti/SKILL.md": ["56c44d0a42d8ec2e"],
  "tester/skills/hafiza-yaz/SKILL.md": ["556952501f09080d"],
  "tester/skills/ikinci-gorus/SKILL.md": ["3996e9f7adecc780"],
  "tester/skills/test-stratejisi/SKILL.md": ["39290354ad25619d"],
  "tester/skills/test-yaz/SKILL.md": ["c3f3f155ac3326be"],
};
