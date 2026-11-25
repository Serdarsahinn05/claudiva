/**
 * Paket skill'lerinin ESKİ (Türkçe) dizin adı → YENİ (İngilizce) dizin adı.
 *
 * 2026-11-25 kullanıcı kararı: skill içerikleri ve açıklamaları 2026-11-24'ten
 * beri İngilizce; adlar da İngilizce oldu (paket npm'de herkese açık, README
 * varsayılanı İngilizce, slash komutu `/durum-ozeti` İngilizce kullanıcıya bir
 * şey söylemiyordu). Panel adı ve açıklamayı arayüz diliyle gösterir
 * (`web/src/skillI18n.ts`).
 *
 * Bu tablonun üç okuyucusu var, üçü de BURADAN okur:
 *  - `agentUpgrade.ts`: mevcut kurulumda eski adlı dizini, içeriği paketin bir
 *    eski sürümüne eşitse yeni adına taşır; kullanıcı değiştirdiyse dokunmaz.
 *    `.seeded-skills` manifestindeki eski ad yeni adla değiştirilir (yoksa
 *    kullanıcının sildiği skill yeni adıyla "yeni" sanılıp geri gelirdi).
 *  - `server/scripts/legacy-hashes.mjs`: eski yoldaki geçmiş sürümlerin
 *    parmak izlerini YENİ yolun anahtarına yazar (bu dosyayı metin olarak
 *    ayrıştırır: satır biçimini `"eski": "yeni",` olarak koru).
 *  - Yeni adlar Claude Code'un yerleşik komutlarıyla çakışmayacak biçimde
 *    seçildi (`code-review`, `simplify`, `review`, `debug`, `plan` YOK).
 *
 * Elle EKLE, silme: bir girdi silinirse o eski adı taşıyan kurulumlar bir
 * daha taşınmaz.
 */
export const SKILL_RENAMES: Record<string, string> = {
  "arastir": "research-topic",
  "arastirma-yontemi": "research-method",
  "arayuz-ilkeleri": "ui-principles",
  "dokuman-guncelle": "docs-update",
  "dokuman-stili": "docs-style",
  "durum-ozeti": "status-summary",
  "gorev-bolme": "split-tasks",
  "hafiza-yaz": "save-memory",
  "hata-avi": "bug-hunt",
  "hata-ayiklama": "debug-method",
  "ikinci-gorus": "second-opinion",
  "inceleme-yap": "review-report",
  "is-baslat": "run-project",
  "kalite-kontrol": "quality-gate",
  "kod-inceleme": "review-checklist",
  "ozellik-yeni": "new-feature",
  "plan-yap": "plan-work",
  "temiz-kod": "clean-code",
  "test-stratejisi": "test-strategy",
  "test-yaz": "write-tests",
  "ui-bilesen": "ui-component",
};
