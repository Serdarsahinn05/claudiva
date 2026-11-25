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
  "boss/personality.md": ["2c4878d21671af33", "2e67f9d2d6c375ab", "7709decf86811623", "b6debc389d0a4210", "e366def40c219892", "e5474e967c19e68d"],
  "boss/skills/new-feature/SKILL.md": ["9582ad66fb5514a0", "f398c4d90e8bafc8"],
  "boss/skills/run-project/SKILL.md": ["50cb562233c27bf2", "5b61f10493368360"],
  "boss/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "boss/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "boss/skills/split-tasks/SKILL.md": ["65d2529bb3918566", "bb4363a1cb941c0b"],
  "boss/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "docs/.claude-plugin/plugin.json": ["c6e9cf3bec885c5c", "f95122dca39e0b2b"],
  "docs/personality.md": ["3133403da7b546d2", "851423845702629d", "bb27c33ae860e204"],
  "docs/skills/commit-pr/SKILL.md": ["e4bf9ae9e00ba6c3"],
  "docs/skills/docs-style/SKILL.md": ["8be429950ef7546a", "8fdaca0075315295"],
  "docs/skills/docs-update/SKILL.md": ["1fdfb58d9a5ee94a", "e696a528b11e7885"],
  "docs/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "docs/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "docs/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "frontend-dev/.claude-plugin/plugin.json": ["18620a6cf4fe2899", "416738cb26b04b48"],
  "frontend-dev/personality.md": ["0a02800e852267c8", "0ac065d922f3fc0e", "5c6d6916ef66212d"],
  "frontend-dev/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "frontend-dev/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "frontend-dev/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "frontend-dev/skills/ui-component/SKILL.md": ["27344da49607a772", "cded3dbd907636ff"],
  "frontend-dev/skills/ui-principles/SKILL.md": ["374f7ef09e9f60b8", "4a3bf6672ce75592"],
  "researcher/.claude-plugin/plugin.json": ["55630d04a1585091", "efed48ad6acc23ca"],
  "researcher/personality.md": ["23852c3e810d44d9", "6c96422e889af9fb", "bf14ff297600e36d"],
  "researcher/skills/research-method/SKILL.md": ["0b9c74a8d1ecd20c", "51a84405681eb143"],
  "researcher/skills/research-topic/SKILL.md": ["14e69d4179e71583", "1ff36bcd4cadf75e"],
  "researcher/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "researcher/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "researcher/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "reviewer/.claude-plugin/plugin.json": ["2aaff70bb753e034", "fead0081ca7367bf"],
  "reviewer/personality.md": ["1be1cda84083fac8", "4a33e73d48ad171b", "6cde4711da00c3a1"],
  "reviewer/skills/review-checklist/SKILL.md": ["be9a5335938cdea6", "dc5dd0cf867ef033"],
  "reviewer/skills/review-report/SKILL.md": ["45bf6e3a50d8807b", "e2429df1895b1692"],
  "reviewer/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "reviewer/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "reviewer/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "senior-dev/.claude-plugin/plugin.json": ["79fdcd9a7303ba52", "a5d6cbdfe3ac6e6d"],
  "senior-dev/personality.md": ["3d92fdcf5e3454fa", "4f22a42debcba15f", "d524407fd6c4e805"],
  "senior-dev/skills/bug-hunt/SKILL.md": ["b6147c137ebda5f0", "c968586bac852662"],
  "senior-dev/skills/clean-code/SKILL.md": ["34a8551499cc8256", "bf5bd403d4a80b86"],
  "senior-dev/skills/debug-method/SKILL.md": ["41f711838141ff08", "4ed2e8d1ccae27bd"],
  "senior-dev/skills/refactor/SKILL.md": ["aef32c0e1b61fddd", "de8e9a9401819cf0"],
  "senior-dev/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "senior-dev/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "senior-dev/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "tech-lead/.claude-plugin/plugin.json": ["bb5236d763f97292", "e769c09be6957d9d"],
  "tech-lead/personality.md": ["4dbef0bd8ccc1f5a", "af1c458d52c53fe7", "ca96691b65743125", "d3d4a6e86cbe6e47"],
  "tech-lead/skills/plan-work/SKILL.md": ["925d38387b6ed6fb", "d26a6ef01baa3de6"],
  "tech-lead/skills/quality-gate/SKILL.md": ["04db959adcda31ab", "71909056cedafa96"],
  "tech-lead/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "tech-lead/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "tech-lead/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "tester/.claude-plugin/plugin.json": ["68a36233615ec35f", "c6ae770e9de63511"],
  "tester/personality.md": ["4a3f56bd1dc405c5", "5939b3edd677316c", "abf7aa74d92f0213"],
  "tester/skills/save-memory/SKILL.md": ["530fa15be2580154", "556952501f09080d"],
  "tester/skills/second-opinion/SKILL.md": ["3996e9f7adecc780", "a47e543ff37bc379"],
  "tester/skills/status-summary/SKILL.md": ["56c44d0a42d8ec2e", "59f9780ab8fe92ac"],
  "tester/skills/test-strategy/SKILL.md": ["39290354ad25619d", "5d77a2bec0ea3365"],
  "tester/skills/write-tests/SKILL.md": ["4f26ab17da015d17", "c3f3f155ac3326be"],
};
