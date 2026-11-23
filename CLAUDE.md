## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- This rule applies to subagents too — include it in every subagent prompt involving code exploration.

## Proje gerçekleri (koddan hızlıca çıkarılamayanlar)

- **Ajan tanımları global, veri proje bazlı.** Tanımlar `~/.claudiva/agents`,
  çalışma verisi `<proje>/.claudiva/data` (usage, tasks, commands, sessions,
  transcripts, changes). Aynı ajan iki projede ayrı oturum yürütür.
- **`Task` ve diğer paylaşılan tipler iki yerde elle çoğaltılmış**: `server/src/types.ts`
  ve `web/src/types.ts`. Şema değiştirirken ikisini birden güncelle.

## Derleme tuzakları (ikisi de canlı hataya yol açtı)

- **`claudiva` CLI `server/dist`i çalıştırır, kaynağı değil**
  (`bin/claudiva.js`). `tsx` ile kaynaktan test etmek CLI yolunu HİÇ
  kapsamaz. Sunucu değişikliğinden sonra `npm run build` çalıştırılmazsa CLI eski
  sunucuyu açar; taze `web/dist` olmayan uçları çağırır (`/api/budget` vb.),
  `Promise.all` reddedilir ve panel açılış perdesinde sonsuza dek asılı kalır.
- **`web/` içinde `npx tsc --noEmit` HİÇBİR ŞEYİ denetlemez.** `web/tsconfig.json`
  bir çözüm dosyası (`"files": []` + references). Gerçek denetim için `tsc -b` ya da
  `npm run build`. Ölçüldü: kasıtlı bir tip hatası `--noEmit`ten geçti, `-b` yakaladı.
- Sonuç: web/sunucu değişikliğinden sonra doğrulama **`npm run build`**; `npx vite build`
  tek başına `tsc -b`yi atlar ve kırık tipi görmezden gelir.

## Test/çalıştırma tuzakları

- Sunucu `tsx --watch` ile çalışır. **Test sırasında kod düzenlemek sunucuyu yeniden
  başlatır** ve çalışan görev kaybolur (`tasks.json` 500ms gecikmeli yazılır).
- **Sunucuyu yaşına göre değil PORTA göre öldür ve portun boşaldığını DOĞRULA.**
  Eski süreç sağ kalırsa yeni sunucu sessizce bağlanamaz ve farkında olmadan eski
  sunucuyla konuşursun (bu tuzağa iki kez düşüldü):
  `Get-NetTCPConnection -LocalPort <p> -State Listen` → `Stop-Process -Id <pid> -Force`
- **`DATA_DIR` altındaki JSON dosyalarını (sessions.json, tasks.json, usage.json…)
  sunucu ÇALIŞIRKEN elle düzenlemek hiçbir işe yaramaz.** İlgili Store sınıfı
  (`SessionStore` vb.) dosyayı yalnızca `init()`'te okur, sonrası bellekte yaşar;
  disk yazımı tek yönlüdür. Bozuk bir sessionId enjekte edip resume geri düşüşünü
  test ederken bu yüzden yanlış negatif alındı — canlı sunucu kendi bellekteki
  geçerli id'yi kullanmaya devam etti, dosya değişikliği görünmedi. Doğru yöntem:
  **önce sunucuyu durdur, dosyayı düzenle, SONRA yeniden başlat** (init() dosyayı
  o an okur).
- `npm run dev` vite'ı da açar; vite `/api`'yi **sabit** `localhost:4600`'e proxy'ler.
  Farklı portla test ediyorsan paneli sunucunun kendi portundan aç (server, `web/dist`
  varsa onu servis eder) — önce `npx vite build`.
- Ortamda başka oturumlardan kalmış artık sunucular olabilir; port çakışmasının ilk
  şüphelisi budur.

## ŞU ANKİ İŞ (oku: docs/SONRAKI-ISLER.md, HANDOFF.md, docs/ANALIZ.md)

Panel revizyonunun Faz 1-3'ü bitti ve 0.1.1 ile yayımlandı. 2026-11-23 turunda
şunlar yapıldı (commit EDİLMEDİ): **Sohbet modu**, **`.claudiva` veri klasörü
geçişi**, **Türkçe rol adları ve tohum güncellemesi**, **skill kütüphanesi
bağlama**. Sıradaki adımlar, kullanıcı kararları ve repo rename kontrol listesi
`HANDOFF.md`'nin başında. Kararları yeniden sorma.

**Faz 4 = ikinci sağlayıcı ve kullanıcı onu BİLEREK ertelemişti**, açmadan önce
sor. **3D ofis de sona bırakıldı**; three.js eklemeden önce sor.

## Notlar nerede (token için bölündü)

Geliştirici notları üç dosyaya bölündü. Kök dosya her oturumda yüklenir;
alt dizindekiler Claude Code tarafından YALNIZ o dizindeki bir dosya
okunduğunda yüklenir. Bölmenin sebebi ölçüldü: bu dosya tek parçayken
paneldeki HER ajanın HER yeni oturumuna 20.2k token ekliyordu.

- **`server/CLAUDE.md`**: oturum katmanı (`AgentSession`/`AgentBackend`),
  görev tamamlama, delegasyon ve zincirler, slash komutları, tarayıcı, kanıt
  zinciri, dosya ikonları, skill'ler ve katalog, token okumaları, veri
  klasörü geçişi ve tohum güncellemesi.
- **`web/CLAUDE.md`**: CSS token kuralları ve hareket katmanı, kontrast ölçümü,
  sözdizimi renklendirme, harcama panosu, arayüz modları (Paneller/Sohbet),
  çok panelli kabuk ve sürükle-bırak, takımlar, görsel kimlik.
- Kök dosyaya yalnız HER işte gereken kural girer. Yeni bir not hangi dizinin
  koduna aitse oraya yazılır; kök dosya büyürse bölmenin kazancı geri gider.
