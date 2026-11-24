/**
 * Paket ajanlarının ESKİ dosya içeriklerinin parmak izleri.
 *
 * Anahtar `agents/` altına göre göreli yoldur; değer, o dosyanın daha önce
 * yayımlanmış sürümlerinin sha256 özetinin ilk 16 hex karakteridir (CRLF → LF
 * normalize edilerek). `agentUpgrade.ts` diskteki dosyanın özeti bu listedeyse
 * dosyanın kullanıcı tarafından değiştirilmediğine hükmeder ve paketteki yeni
 * sürümle değiştirir.
 *
 * Üretimi: `git show v0.1.1:<dosya>` ve İngilizce çeviriden önceki
 * `git show HEAD:<dosya>` içerikleri üzerinden (find-skills hariç) bir node
 * betiğiyle hesaplandı. Elle değiştirme; içerik bir daha değişirse o anki
 * yayımlanmış sürümün özetini ilgili diziye EKLE.
 */
export const LEGACY_CONTENT: Record<string, string[]> = {
  "boss/.claude-plugin/plugin.json": ["41a22618fa0fe191"],
  "boss/personality.md": ["6d79ee22ce302624", "f1397f3736707293"],
  "boss/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "boss/skills/gorev-bolme/SKILL.md": ["eaace28788194a86"],
  "boss/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "boss/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "boss/skills/is-baslat/SKILL.md": ["75d08ef1a7c29c82"],
  "boss/skills/ozellik-yeni/SKILL.md": ["3b69779113a509be"],
  "docs/.claude-plugin/plugin.json": ["f8fa58d73a942909"],
  "docs/personality.md": ["d7aae9e4c688a9ac", "5309f0e8a72981df"],
  "docs/skills/commit-pr/SKILL.md": ["496fe4456b6a6858"],
  "docs/skills/dokuman-guncelle/SKILL.md": ["addce29ac69fb59e"],
  "docs/skills/dokuman-stili/SKILL.md": ["9afcce32ff089ca9"],
  "docs/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "docs/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "docs/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "frontend-dev/.claude-plugin/plugin.json": ["f607e6e7b98f6e47"],
  "frontend-dev/personality.md": ["b4c275c4b638f267", "11bfe008355b6c17"],
  "frontend-dev/skills/arayuz-ilkeleri/SKILL.md": ["edb3770c9b517ad4"],
  "frontend-dev/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "frontend-dev/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "frontend-dev/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "frontend-dev/skills/ui-bilesen/SKILL.md": ["ffac046a7b96865e"],
  "researcher/.claude-plugin/plugin.json": ["1bc5756e190f9446"],
  "researcher/personality.md": ["aa2b7b4965e35144", "3fe4b2ca6b67c9c1"],
  "researcher/skills/arastir/SKILL.md": ["acaeaa277e547884"],
  "researcher/skills/arastirma-yontemi/SKILL.md": ["4a422fae288b00f7"],
  "researcher/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "researcher/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "researcher/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "reviewer/.claude-plugin/plugin.json": ["348ad0eb9b669117"],
  "reviewer/personality.md": ["5f1931dac5f39b6a", "f0056c6c595adb41"],
  "reviewer/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "reviewer/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "reviewer/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "reviewer/skills/inceleme-yap/SKILL.md": ["7aebb4ddcc775f45"],
  "reviewer/skills/kod-inceleme/SKILL.md": ["eb105be28933ee8a"],
  "senior-dev/.claude-plugin/plugin.json": ["10e029df0fab7043"],
  "senior-dev/personality.md": ["4e21d33e7c00a0e5", "b5cd46f3865f2afd"],
  "senior-dev/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "senior-dev/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "senior-dev/skills/hata-avi/SKILL.md": ["7a2915cd75e4bf41"],
  "senior-dev/skills/hata-ayiklama/SKILL.md": ["ba4a6ad0d3c008fb"],
  "senior-dev/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "senior-dev/skills/refactor/SKILL.md": ["6231493323c49db0"],
  "senior-dev/skills/temiz-kod/SKILL.md": ["a31675a0bebdb489"],
  "tech-lead/.claude-plugin/plugin.json": ["208f78b6e69cb79e"],
  "tech-lead/personality.md": ["4b05cc294bea2fd3", "e58fab2f62510811"],
  "tech-lead/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "tech-lead/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "tech-lead/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "tech-lead/skills/kalite-kontrol/SKILL.md": ["8d7418b69eb7915e"],
  "tech-lead/skills/plan-yap/SKILL.md": ["19541dab4cf9fece"],
  "tester/.claude-plugin/plugin.json": ["8905603e2f5640c1"],
  "tester/personality.md": ["163828a40cb7fbc9", "35882fbe4b917ef8"],
  "tester/skills/durum-ozeti/SKILL.md": ["40b99d576a2c9372"],
  "tester/skills/hafiza-yaz/SKILL.md": ["82e3ea39e66210b9"],
  "tester/skills/ikinci-gorus/SKILL.md": ["a16ff9f70366a3e9"],
  "tester/skills/test-stratejisi/SKILL.md": ["7a6a36c779be2dfb"],
  "tester/skills/test-yaz/SKILL.md": ["4549f0f0960c8025"],
};
