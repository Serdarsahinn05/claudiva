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
  (`web/src/themes.css`) yalnızca token ezer, kural yazmaz. **Yeni etkileşimli sınıf
  eklerken** `index.css`'teki ortak `transition` ve hover seçici listelerine de ekle,
  yoksa animasyon almaz.
- **Giriş animasyonlarında `animation-fill-mode: backwards` kullan, `both` değil.**
  `both` bitişte `transform: none`'ı kalıcı uygular ve hover hareketini tamamen öldürür.
- **`session.usage` tümel toplamdır** (açılışta diskten geri yüklenir). Bütçe/kota gibi
  pencereli hesaplar bundan türetilemez; `usage.json` içindeki `daily` penceresi kullanılır
  ve tur payı önceki değerle **fark** alınarak bulunur (`deltaUsage`).
- **`AgentSession.send()` ölü oturumu kendiliğinden yeniden başlatır.** Bu yüzden "ajanı
  durdur" biçimindeki hiçbir yaptırım tek başına yeterli değil; kapı `send()` ve
  `TaskQueue.dispatch()` içinde olmak zorunda (bütçe sınırı böyle uygulanıyor).

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

## Bilinen açık sorun

- Ajan `complete_task`'ı çağırmadan önce `ToolSearch` ile yüklemek zorunda kalıyor
  (deferred tool); fazladan bir tur maliyeti var, işlevi bozmuyor.
