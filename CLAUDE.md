## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- This rule applies to subagents too — include it in every subagent prompt involving code exploration.

## Proje gerçekleri (koddan hızlıca çıkarılamayanlar)

- **Ajan tanımları global, veri proje bazlı.** Tanımlar `~/.claude-manager/agents`,
  çalışma verisi `<proje>/.claude-manager/data` (usage, tasks, commands, sessions,
  transcripts, changes). Aynı ajan iki projede ayrı oturum yürütür.
- **`Task` ve diğer paylaşılan tipler iki yerde elle çoğaltılmış**: `server/src/types.ts`
  ve `web/src/types.ts`. Şema değiştirirken ikisini birden güncelle.
- **CSS**: renkler kanal token'ı (`rgb(var(--x-rgb) / a)`), ham renk yazma. Temalar
  (`web/src/themes.css`) yalnızca token ezer, kural yazmaz.
- **Grup, temanın ne kadar iş yaptığını belirler.** `Geliştirici paletleri`
  yalnızca renk ezebilir. **`Özel` ve `Sitelerden` temaları yapıyı da değiştirmek
  zorunda**: `--texture`/`--texture-blend` (çok katmanlı zemin), `--radius`,
  `--border-w`, `--glow-a`, `--surface-grad`, `--clip-panel`, font ve `--upper`.
  Sadece renk değiştiren bir blok bu iki gruba ait değildir — panel "çok basit"
  görünür.
- **Yeni tema eklerken kontrastı ÖLÇ, göz kararı yapma.** Yüzeye karşı eşikler:
  `fg` ≥ 7, `muted` ≥ 4.5, `dim`/`accent`/`err`/`ok`/`warn` ≥ 3. Ölçüm üç ayrı
  temada gözden kaçmış hata buldu (`spaceship` dim 2.52, `nord` err 2.46,
  `brutal` warn 2.79). Yayımlanmış paletler bile bu arayüzde eşiği tutmayabilir —
  Solarized'ın resmî metin tonları 4.86:1 kalıyordu, açmak gerekti. **Yeni etkileşimli sınıf
  eklerken** `index.css`'teki ortak `transition` ve hover seçici listelerine de ekle,
  yoksa animasyon almaz.
- **Açılış perdesi `web/index.html`'de, React'te değil.** React bileşenine taşınırsa
  ancak bundle ayrıştırıldıktan sonra görünür — yani örtmesi gereken boşluğun tam
  ortasında belirir. Stiller de inline olmak zorunda (aynı sebep). Perde SÜREYE değil
  `store.ready`e bağlı kalkar; sabit süreli açılış ekranı her yenilemede vergi olurdu.
- **Giriş animasyonlarında `animation-fill-mode: backwards` kullan, `both` değil.**
  `both` bitişte `transform: none`'ı kalıcı uygular ve hover hareketini tamamen öldürür.
- **`session.usage` tümel toplamdır** (açılışta diskten geri yüklenir). Bütçe/kota gibi
  pencereli hesaplar bundan türetilemez; `usage.json` içindeki `daily` penceresi kullanılır
  ve tur payı önceki değerle **fark** alınarak bulunur (`deltaUsage`).
- **`AgentSession.send()` ölü oturumu kendiliğinden yeniden başlatır.** Bu yüzden "ajanı
  durdur" biçimindeki hiçbir yaptırım tek başına yeterli değil; kapı `send()` ve
  `TaskQueue.dispatch()` içinde olmak zorunda (bütçe sınırı böyle uygulanıyor).

## Derleme tuzakları (ikisi de canlı hataya yol açtı)

- **`claude-manager` CLI `server/dist`i çalıştırır, kaynağı değil**
  (`bin/claude-manager.js`). `tsx` ile kaynaktan test etmek CLI yolunu HİÇ
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
- `npm run dev` vite'ı da açar; vite `/api`'yi **sabit** `localhost:4600`'e proxy'ler.
  Farklı portla test ediyorsan paneli sunucunun kendi portundan aç (server, `web/dist`
  varsa onu servis eder) — önce `npx vite build`.
- Ortamda başka oturumlardan kalmış artık sunucular olabilir; port çakışmasının ilk
  şüphelisi budur.

## Görev tamamlanması — turdan türetilemez

- **`send()` ile `result` 1:1 DEĞİL.** Ölçülmüş iki kırılma: (a) tur sürerken gelen
  mesaj o turun **içine emilir** → iki mesaj, tek sonuç; (b) `Monitor` gibi arka plan
  bildirimleri **mesajsız yeni tur doğurur**. Bu yüzden görevi tur sayarak kapatmak
  ilkesel olarak yanlış — konumsal FIFO da, mesaja jeton iliştirmek de yetmez.
- Kapanış **birincil olarak ajanın kendi bildirimidir**: `mcp__task__complete_task`
  (`server/src/tasks/tools.ts`), her role verilir (worker'lar `team` sunucusunu almaz).
  Yedek olarak son turdan `GRACE_MS` (90sn) sonra hâlâ açık görevler **son turun**
  metniyle kapatılır ve sonuca not düşülür.
- `turn_complete` yine de `taskId` taşır; ama yalnızca **hata turunda** kapatmak için
  ve dosya değişikliği atfı için kullanılır (`session.currentTaskId`).
- `cleanup()` sonuçlanmamış görev turları için `turn_abandoned` yayar — yoksa oturum
  ölünce görevler sonsuza dek `running` asılı kalırdı.

## Görev zincirleri

- Zincir adımı `pending` doğar (`chainId`/`stepIndex`/`dependsOn`/`passResult`).
  **`init()` `pending`'i ASLA `failed` yapmamalı** — eskiden yapıyordu; zincirler
  sunucu her yeniden başladığında sessizce ölürdü. Yalnızca `running` bayat sayılır,
  `pending` korunup `resumeChains()` ile bağımlılığına göre yerleştirilir.
- Başarısızlık aşağı yayılır: bir adım `failed` ise sonraki adım da `failed` olur
  (eksik girdiyle çalışıp yanıltıcı sonuç üretmesin).
- `delegate_task after_task_id` verildiğinde **`wait` bilerek yok sayılır**; zincir
  boyunca bloklamak `waitFor`ın 15dk zaman aşımını aşar ve biten işi "BAŞARISIZ"
  diye raporlardı.

## Bilinen açık sorun

- Ajan `complete_task`'ı çağırmadan önce `ToolSearch` ile yüklemek zorunda kalıyor
  (deferred tool); fazladan bir tur maliyeti var, işlevi bozmuyor.
