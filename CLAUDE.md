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
- **CSS**: renkler kanal token'ı (`rgb(var(--x-rgb) / a)`), ham renk yazma. Plakalar
  (`web/src/themes.css`) yalnızca token ezer, kural yazmaz.
- **Türetilmiş renk adları `[data-theme]` bloğunda tanımlanır, `:root`ta DEĞİL.**
  (`index.css` içindeki `:root, [data-theme]` bloğu.) Özel özellikler hesaplanmış
  değer olarak miras kalır: `--fg: rgb(var(--fg-rgb))` yalnızca `:root`ta dursaydı
  `--fg` bir kez kökte çözülür, alt bir kapta `--fg-rgb`yi ezmek hiçbir şeyi
  değiştirmezdi. Tema seçicideki minyatür önizleme tam olarak bunu yapıyor (kendi
  `data-theme`ini taşıyan bir span) — bu yüzden üç plaka da aynı görünüyordu.
  Yeni bir türetilmiş ad eklerken o bloğa ekle.
- **Kontrastı ÖLÇ, göz kararı yapma:** `node web/scripts/contrast.mjs` (çıkış kodu
  1 = eşik tutmuyor). Yüzeye karşı eşikler: `fg` ≥ 7, `muted` ≥ 4.5,
  `dim`/`accent`/`err`/`ok`/`warn` ≥ 3. Betik plaka bloklarını CSS'ten kendisi
  ayrıştırır; yeni plaka eklemek için yalnızca `plates` dizisine bir satır gerekir.
  Ölçüm eski temalarda gözden kaçmış üç hata bulmuştu (`spaceship` dim 2.52,
  `nord` err 2.46, `brutal` warn 2.79) — yayımlanmış paletler bile bu arayüzde
  eşiği tutmayabiliyor.
- **Yeni etkileşimli sınıf eklerken** `index.css`'teki ortak `transition` ve hover
  seçici listelerine de ekle, yoksa animasyon almaz.
- **Giriş animasyonu TEK.** `plate-in` yalnızca `main > *` üzerinde çalışır. Izgaraya,
  kenar çubuğuna ya da satıra ikinci bir giriş eklemek "her bölüme aynı giriş"
  tuzağıdır ve dünyanın kendi hareketini (sidereal sürüklenme, nişangâh dönüşü,
  yıldız nabzı) görünmez kılar. Gerçek beliriş olayları ayrıdır ve kalır: modal,
  menü, izin bandı, yeni döküm satırı, açılan ayrıntı.
- **Açılış perdesi `web/index.html`'de, React'te değil.** React bileşenine taşınırsa
  ancak bundle ayrıştırıldıktan sonra görünür — yani örtmesi gereken boşluğun tam
  ortasında belirir. Stiller de inline olmak zorunda (aynı sebep). Perde SÜREYE değil
  `store.ready`e bağlı kalkar; sabit süreli açılış ekranı her yenilemede vergi olurdu.
- **Giriş animasyonlarında `animation-fill-mode: backwards` kullan, `both` değil.**
  `both` bitişte `transform: none`'ı kalıcı uygular ve hover hareketini tamamen öldürür.
- **`session.usage` tümel toplamdır** (açılışta diskten geri yüklenir). Bütçe/kota gibi
  pencereli hesaplar bundan türetilemez; `usage.json` içindeki `daily` penceresi kullanılır
  ve tur payı önceki değerle **fark** alınarak bulunur (`deltaUsage`).
- **`AgentSession` sağlayıcıdan bağımsız; SDK'ya özel her şey `AgentBackend`
  arkasında.** (`server/src/agents/backend.ts` arayüz, `agents/backends/claudeBackend.ts`
  tek uygulama.) Döküm/bütçe/görev-korelasyonu/izin-bekletme/durum-makinesi
  `AgentSession`'da kalır — hiçbiri SDK mesaj şeklini bilmez, yalnızca normalleştirilmiş
  `BackendEvent`i (`kind` değerleri `TranscriptKind` ile bilerek aynı) işler.
  `ProviderId` şu an tek üyeli (`'claude'`) — ikinci sağlayıcı henüz YOK, yalnızca
  soyutlama katmanı var. Yeni sağlayıcı eklerken tek dokunulacak yer `backends/`
  altına yeni dosya + `backends/index.ts`'e bir dal; `AgentSession`'a dokunulmaz.
  `extraMcpServers` bilerek `Record<string, unknown>` (opak) — backend.ts SDK
  import ETMEZ, yalnızca `ClaudeBackend` içeriği SDK'nın gerçek tipine çevirir.
  **Bunu unutup birleştirmeyi atlamak** (`Object.assign(mcpServers, opts.extraMcpServers)`)
  team/self/task delegasyon araçlarını sessizce kırar — derleme hatası vermez,
  yalnızca ajan o araçları hiç göremez.
- **`AgentSession.send()` ölü oturumu kendiliğinden yeniden başlatır.** Bu yüzden "ajanı
  durdur" biçimindeki hiçbir yaptırım tek başına yeterli değil; kapı `send()` ve
  `TaskQueue.dispatch()` içinde olmak zorunda (bütçe sınırı böyle uygulanıyor).
- **`handleMessage()`'ın başında `if (!this.q) return;` bekçisi var — kaldırma.**
  `stop()` içindeki `cleanup()` `this.q`'yu null'layıp durumu `offline` yapar, ama
  `loop()`'taki `for await` döngüsü o anda elinde bekleyen bir mesajı (ör.
  `session_state_changed: idle`) hâlâ işleyebilir; bekçisiz kalırsa durum `offline`'dan
  geri `idle`'a döner. Yalnız tek ajanı durdurunca fark edilmez, birden fazla ajanı
  **paralel** durdurunca (~1/8 oranında) ortaya çıkar — bu yüzden ilk kez "tümünü
  durdur" toplu eylemiyle bulundu.

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

## Paralel delegasyon

- **`delegate_task` tek ajanlıktır ve `wait=true` (varsayılan) çağıran turu
  `waitFor` ile 15dk'ya kadar BLOKLAR.** Altyapı paraleli destekler (her ajan ayrı
  `AgentSession` + ayrı SDK döngüsü; `dispatch()`→`launch()`→`send()` bloklamadan
  döner), ama boss tek tek `delegate_task` çağırınca doğal olarak seri çalışır:
  delege et → sonucu bekle → oku → sıradakini delege et. Kullanıcı "boss aynı anda
  tek ajana iş veriyor" diye bunu fark etti.
- **Çözüm `delegate_tasks` (çoğul)**: bir dizi `{agent_id,title,task}` alır, HEPSİNİ
  senkron `dispatch()` eder (hepsi anında başlar), sonra `Promise.all(waitFor)` ile
  birlikte bekler. Duvar-saati = en uzun görev, görevlerin toplamı değil. Ajan
  sayısı/kimlikleri serbest — iki de olur altı da. Doğrulama önce yapılır: bir hedef
  geçersizse HİÇBİRİ dağıtılmaz (kısmi dağıtım "N ajana verdim" beklentisini
  sessizce bozardı). `personality.md` (boss + patron) bağımsız işler için bunu
  emreder; tek tek `delegate_task` yalnızca bağımlı/sıralı iş içindir.

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

## Slash komutları (iki ayrı yol, karıştırma)

- **CLI bir mesajı ancak İLK KARAKTERİ `/` ise komut sayar.** `ClaudeBackend.send()`
  otomatik-model hatırlatmasını mesajın başına ekliyor; bu önek slash komutunu düz
  metne çeviriyor ve komut SESSİZCE hiç çalışmıyordu (yalnızca model metni
  okuyordu, hata da vermiyordu). `isSlashCommand()` kapısı bu yüzden var —
  **kaldırılırsa SDK tarafındaki bütün komutlar yeniden ölür.** Ölçüldü: kapıyla
  `/compact` → CLI'ın kendi yanıtı, 0 token, tur temiz kapanıyor.
- **Panelde çalışan komut ≠ ajana giden komut.** Ayrım tek soruyla: komut CLI'da
  **etkileşimli bir ekran mı açıyor** (menü/diyalog — panelde yüzeyi yok) yoksa
  **prompt'a mı genişliyor** (model okusun diye). Birinciler `web/src/localCommands.ts`
  içinde, ikinciler olduğu gibi SDK'ya gider. Panel HİÇBİR komutu reddetmez.
- **Oturum iç görüsü `AgentBackend.inspect(parts)` arkasında.** `context / models /
  agents / mcp / account` — şekli normalleştirilmiş, SDK tipleri backend'de kalır
  (`GET /api/agents/:id/inspect?parts=…`). Parça başına EN İYİ ÇABA ve **`null` ile
  `undefined` ayrı anlamlı**: `null` = istendi, okunamadı; `undefined` = istenmedi.
  Tek try bloğuna alınırsa `/status` gibi çok parçalı bir komut tek kırık kontrol
  isteği yüzünden tümüyle boşalır.
- **`/context` kategori yüzdelerinin paydası `maxTokens`, `totalTokens` DEĞİL.**
  Kategoriler pencerenin tamamını böler — "Free space" ve "Autocompact buffer" da
  birer kategori ama `totalTokens`in (kullanılan kısım) içinde değiller. Kullanılana
  bölmek ölçülmüş bir saçmalık üretti: 889.6k boş alan **%2023**.
- **Panel çıktısı `<pre>` içinde çizilmek ZORUNDA** (`SkinnedTranscript` →
  `LocalOut`). Bu çıktılar `padEnd` ile sütun hizalıyor ve blok karakterle çubuk
  çiziyor; normal bir kapta boşluklar daralıp hiza bozuluyor. Döküm skinlere
  taşınırken kaybolan tek şey buydu.

## Tarayıcı (Browser paneli + ajan araçları)

- **`allowedTools`'a giren araç `canUseTool`'a HİÇ SORULMAZ.** Ölçüldü:
  browser araçları listeye eklendiğinde oto-onayı KAPALI bir ajan bile izinsiz
  sayfa açıyordu. self/team/task için muafiyet doğru (panel içinde kalan işler),
  **tarayıcı için değil** — dış dünyaya çıkıyor. `browserTools.ts` bilerek bir
  kural listesi ihraç ETMEZ; oraya bir `BROWSER_TOOL_RULES` eklemek bu kapıyı
  yeniden deler.
- **Tek tarayıcı, iki aktör.** Kullanıcı panelden sürerken izin sorulmaz (aktör
  zaten o); ajan MCP ile sürerken mevcut izin kapısı devrededir. Ajana ayrı bir
  örnek verilmez: ajanın açtığı sayfayı kullanıcının görmesi bu panelin varlık
  sebebi.
- **Tıklama sonrası durumu `waitForURL` ile bekle.** İkisi de ölçülüp elendi:
  sabit bekleme (geçiş anını okuyor) ve `waitForLoadState` (gezinme henüz
  commit edilmediği için ESKİ belgeyi soruyor, anında dönüyor). `framenavigated`
  de commit sonrası çıktığı için yetişmiyor. Gezinme isteği `request`
  olayından anlaşılır, sonra `waitForURL` beklenir.
- **Playwright TEMBEL import edilir** ve `playwright-core` + yalnız chromium
  kuruludur (tam paket üç tarayıcı indirip ~1GB olurdu). Paket/tarayıcı yoksa
  sunucu ayakta kalır, yalnız panel "kurulu değil" der.
- URL kapısı yalnız `http`/`https`; `file://` yerel diski, `chrome://` tarayıcı
  iç sayfalarını açardı ve ajan eliyle sürüldüğünde dosya sızdırma yolu olurdu.

## Kanıt zinciri (Raporlar)

- **`Touch.taskId` tek başına YETMEZ; `Task.parentTaskId` şart.** Delegasyonda
  dosyayı üst görev değil torunu yazar: kullanıcı → boss → çalışan, dokunuş ALT
  görevin kimliğini taşır. Yalnız `filesForTask(t.id)` bakan bir rapor
  "hiçbir dosyaya dokunulmadı" der — ölçülmüş yanlış negatif. `/reports` alt
  ağacı gezer (döngü korumalı) ve dosyaları yola göre tekilleştirir.
- Ebeveyn `tasks.currentTaskFor(selfId)`'den okunur ve **`delegate_tasks`'te
  döngü DIŞINDA bir kez**: içeride okunsa ilk görev turu değiştirdiğinde
  kardeşler farklı ebeveynlere bağlanabilirdi.
- Yalnız KÖK görevler (parentTaskId'siz) raporlanır; alt görevler `subtasks`
  olarak ait oldukları işin altında görünür, yoksa aynı iş iki kez okunurdu.

## Sözdizimi renklendirme (Kod paneli)

- **"Highlighter paketi şişirir" ölçüldü ve DOĞRU ÇIKMADI.** Eski karar
  ("hiçbir highlight kütüphanesi yok") bu ölçümle geri alındı — esbuild,
  minify + gzip: Prism (core + 28 dil) **25.5 KB**, highlight.js (9 dil)
  19.8 KB, Shiki (yalnız 4 dil + WASM) **309 KB**. Karşılaştırma: uygulamanın
  tamamı 129 KB gzip. Shiki bu yüzden elendi (tek panel için uygulamanın
  2.4 katı), Prism seçildi.
- **Asıl seçim ölçütü boyut değil ÇIKTI BİÇİMİ.** Prism CSS *sınıfı* üretir,
  Shiki satır içi *hex renk*. Hex renk 6 tema plakasını hiç dinlemez ve
  Kırmızı Fener'de mavi anahtar sözcük çıkarırdı — o plakanın tek kuralı
  "mavi yok" (gece görüşü).
- **`Prism.tokenize()` kullanılır, `Prism.highlight()` DEĞİL.** İkincisi HTML
  dizgesi döndürür ve `dangerouslySetInnerHTML` gerektirir; bu panel diskteki
  rastgele dosyaları okuyor, oraya enjeksiyon yüzeyi açmanın gerekçesi yok.
  Token ağacı düzleştirilip React düğümü olarak çiziliyor.
- **`window.Prism = { manual: true }` import'tan ÖNCE yazılmak zorunda.**
  `prism-core.js` bayrağı `_self.Prism && _self.Prism.manual` diye okuyor
  (satır 51); bayrak yoksa DOMContentLoaded'da sayfadaki BÜTÜN `<pre>`leri
  kendi kendine boyar — bu panelde döküm, terminal ve komut çıktısı da `<pre>`.
- **Diller `prismLangs.ts`'te TEK dosyada toplanır.** `highlight.ts` içinde
  tek tek `await import()` iken Vite her birine ayrı yığın üretti (ölçüldü:
  **28 istek**). Statik import'lar tek yığın olur; `highlight.ts` yalnız o
  dosyayı dinamik import eder → panel açılmadan 0 bayt, açılınca 1 istek.
  Dosyadaki import SIRASI sözleşmedir (typescript → javascript → clike).
- **`interpolation` kovası boş dizeye (`''`) eşlenir ve bu kasıtlıdır.** Boş
  dize nullish değil, o yüzden `??` zincirini keser ve miras almayı durdurur.
  Eşlenmezse `` `değer: ${n+1}` `` içindeki KOD üstündeki `template-string`ten
  'str' miras alıp dizge rengine boyanıyordu (ölçüldü).
- **Kovalar dokuz tane, Prism'in 100+ token tipi bunlara indirgenir.** Hepsine
  renk vermek 6 plaka × 100 değer olurdu. Eşlenmemiş tip **sınıfsız** kalır
  (düz `--fg`) — yanlış renk vermektense renksiz bırakmak.
- **`--syn-*` kanalları durum renklerinden AYRI.** ok/warn/err "bu nesne ne
  hâlde" der, sözdizimi "bu parça ne cinsten"; ödünç almak iki anlamı tek
  kanala bindirirdi. Tek istisna `--syn-ins`/`--syn-del` (gerçekten durum).
  Türetilmiş adlar yine `:root, [data-theme]` bloğunda (bkz. yukarıdaki not).
- **Sözdizimi kontrastının zemini `--void`, `--surface` DEĞİL** — kod gövdesi
  ekranın içinde. `contrast.mjs` bunları ayrı bölümde ve **4.5 eşiğiyle**
  ölçer (dokuzu da okunan metin; 3:1 grafik eşiği 12px mono için yanlış olur).
  Ölçüm bir hata buldu: redlight `syn-com` 3.85:1 → 168 104 90'a yükseltildi.
- **`contrast.mjs` artık blokları BİRLEŞTİRİYOR, "en çok token"a bakmıyor.**
  Eski kural ortak premium bloğa (9 sözdizimi kanalı) karşı plakanın kendi
  bloğunu (15 kanal) seçip ortak bloğu tümüyle düşürüyordu — aurora'daki
  sessiz düşüşün aynısı, başka kapıdan. Belge sırasıyla `Object.assign`:
  tarayıcıda ne oluyorsa ölçümde de o.

## Dosya ikonları (Kod paneli)

- **İkonlar tarayıcı paketine GİRMEZ, sunucudan tek tek servis edilir.**
  Panel genel amaçlı — yarın başka bir projede açılacak, orada Rust/Elixir/
  Terraform ne varsa çıkacak; "bu depoda hangi uzantı var" diye seçilmiş dar
  bir set yanlış çözümdür. Tam set ölçüldü: `material-icon-theme` 1250 ikon,
  **ortalama 824 B, medyan 500 B**, toplam ~1 MB. Pakete koymak 1 MB demekti
  (uygulamanın tamamı 129 KB gzip). Sunucudan servis edilince **paket etkisi
  0 bayt**. Ölçülmüş kazanç: 87 satırlık ağaç → **27 istek, 21.9 KB**
  (29 `.tsx` tek indirmeyi paylaşıyor), ve `immutable` başlığıyla yenilemede 0.
- **`Cache-Control: immutable` işin can damarı.** İkon adı içerikle birlikte
  değişiyor (yeni ikon = yeni ad), o yüzden aynı ad hep aynı SVG. Başlık
  kaldırılırsa her ağaç açılışı onlarca istek atar.
- **Eşleme tablosu SUNUCUDA kalır.** `material-icons.json` 450 KB (1378 uzantı
  + 2131 dosya adı + 4654 klasör adı). Tarayıcıya yollamak, kaçınılan
  şişkinliği arka kapıdan geri getirirdi. Çözülmüş ikon adı `TreeEntry.icon`
  ile ağaç yanıtına iliştiriliyor — fazladan gidiş-dönüş yok.
- **`vscode-icons` npm'de YOK** (404; o bir VS Code eklentisi). Depodaki 1584
  SVG 4.08 MB ve içinde 215 KB'lık aykırılar var. `material-icon-theme` hem
  npm'de, hem MIT, hem eşlemeyi de taşıyor — bu yüzden seçildi.
- **Kırmızı Fener plakasında ikonlar FİLTREDEN geçer** (`--icon-filter`).
  Marka renkleri sabit hex; React cyan'ı, Go mavisi o plakanın tek kuralını
  (gece görüşü, mavi yok) ağacın HER SATIRINDA delerdi. Filtre hepsini
  kırmızı-amber ailesine indiriyor, kimliği şekil taşıyor. Diğer plakalarda
  `--icon-filter` tanımsız, yani dokunmuyor.
- **Gündüz plakası için `_light` sürümleri GEREKMEDİ** — ölçüldü, renkli
  ikonlar beyaz kağıtta da okunuyor. Uç `?light=1` destekliyor ama kullanan
  yok; gerekirse hazır.
- **`onError` ile ikon gizlenir.** Paket kurulu değilse uç 404 döner ve
  tarayıcı ağacın her satırına KIRIK RESİM kutusu çizerdi. `fileIcons.ts`
  ayrıca tembel yükleniyor: paket yoksa sunucu ayakta kalır, ağaç ikonsuz
  çizilir.
- Yol güvenliği iki kapılı: ad `^[a-zA-Z0-9._-]+$` desenine uymak zorunda
  (ayraç taşıyan hiçbir ad geçmez) VE çözülen yolun ikon dizini altında
  kaldığı ayrıca doğrulanır. `..%2f` denemesi sınandı, 404 döndü.

## Skill katalogu (Keşfet kipi)

- **Contents API ile dizin dizin gezmek YANLIŞ YOL**: her dizin bir istek,
  kimlik doğrulamasız sınır saatte 60 — üç depoluk katalog sınırı ilk taramada
  bitirirdi. Doğrusu depo başına TEK istek: `git/trees/HEAD?recursive=1`
  bütün dosya listesini verir. Ölçüldü: 3 istekle 212 skill.
- **Açıklamalar `raw.githubusercontent.com`dan ve HTTP Range ile** (ölçüldü:
  206 dönüyor, yani kısmi indirme çalışıyor). Raw API kotasına yazılmıyor;
  her dosyanın yalnız ilk 4KB'ı çekiliyor, frontmatter zaten orada.
  Ölçüldü: 212 skill'in **hepsinde** açıklama okundu (açıklamasız 0).
- **"Kurulu mu" eşleşmesi DİZİN ADI üzerinden**, frontmatter `name`i üzerinden
  değil: `installFromGitHub` hedef dizini tam o adla açıyor, yani rozet ile
  kurulumun çakışma hatası aynı şeye bakıyor. İki skill aynı `name`i
  taşıyabilir; dizin adı kurulum kökünde zaten tekil.
- **Toplu kurulum SIRAYLA ve hata İZOLE.** Hepsi aynı köke yazıyor ve
  `skills-lock.json` tek dosya — paralel yazım kilidi bozardı. `Promise.all`
  ya da erken `throw` ile yazılsaydı sekizincinin ad çakışması ilk yediyi de
  yarıda bırakırdı; her satır kendi sonucunu döndürüyor.
- **Kapsam BİR KEZ sorulur, skill başına değil** (kullanıcı isteği). Ama
  sorulmak zorunda: genel kapsam kullanıcının bütün projelerine yazıyor,
  bunun sessiz varsayılanı olamaz.
- Yerleşik kaynaklar **silinmez, gizlenir** (`hidden` listesi) — kod
  değişmeden geri gelebilsinler.
- Bilinen artık: `removeSkill` `skills-lock.json`daki girdiyi TEMİZLEMİYOR
  (mevcut davranış, bu işte değiştirilmedi). Toplu kurulum bunu daha görünür
  yapıyor: 10 kur / 10 kaldır → kilitte 10 bayat girdi kalır.

## Skill'ler

- **`settings.json`'da skill kapatan anahtar YOK** (ölçüldü; anahtarlar: model,
  hooks, extraKnownMarketplaces, effortLevel, autoUpdatesChannel, theme,
  switchModelsOnFlag). Yükleyici `<dizin>/SKILL.md` aradığı için aç/kapat o
  dosyanın adıyla yapılır: `SKILL.md` ↔ `SKILL.md.disabled`. Dizin adına
  DOKUNULMAZ (referans dosyaları kaybolur, geri alma kırılganlaşır).
  Doğrulandı: ajanın komut sayısı 67 → 66 → 67.
- **`~/.claude` ≠ `~/.claude-manager`.** İkincisi `CLAUDE_MANAGER_HOME` ile
  başka yere alınabiliyor; global skill yolu ondan TÜRETİLEMEZ. Sabit:
  `paths.ts` içindeki `CLAUDE_USER_DIR`.
- **Frontmatter ayrıştırmada CRLF iki ayrı yerde canını yakıyor** (ikisi de
  ölçüldü, 63 skill'in 16'sı açıklamasız görünüyordu): (1) `\r` ile biten
  satırda `/^…(.*)$/` **null** döner — JS'de `.` satır sonlandırıcı eşlemez,
  `\r` de bir satır sonlandırıcıdır; (2) `\r?\n` ile bölmek yetmez, bloğun SON
  satırındaki `\r`'nin ardında `\n` olmadığı için ayraç sayılmaz ve satırda
  asılı kalır — `name` düzelirken `description` bozuk kalıyordu. Çözüm: böl VE
  her satırı `trimEnd()`.
- YAML katlanmış blok (`description: >`) devam satırlarından toplanır; atlanınca
  değer anlamsız bir `">"` oluyordu.

## Harcama panosu (grafikler)

- **Üç ayrı zaman kipi var, karıştırma:** `usage.json` tümel toplam (zamansız),
  `budget` bugünkü pencere (gece yarısı sıfırlanır), `usage-history.json` tur tur
  ZAMAN DAMGALI ama **kaydın başladığı andan** itibaren. Eski toplamlar geriye
  dönük tur tur bölünemez; pano bunu gizlemez, "kayıt başlangıcı" yazar. Kahraman
  sayı tümel toplamdır, grafikteki toplam aralığındır — farklı olmaları normal.
- **Geçmişe `lastTurn` yazılır, `delta` DEĞİL** (`manager.ts`). İkisi normalde
  aynı; ama delta negatife düşmesin diye kırpılıyor ve ajan silinip yeniden
  yaratıldığında (`perAgent` sıfırlanır) turu olduğundan büyük gösterirdi.
- **"Hangi dosya kaç token" yalnızca bağlam dökümünden gelir** (`memoryFiles`,
  SDK'nın `getContextUsage()`'ı). Bir araç çağrısının (ör. bir Read'in) kaç token
  götürdüğü HİÇBİR YERDE dosyaya atfedilmiyor — o sayı uydurulamaz. Panoda
  "dosya" başlığı altında sadece gerçekten ölçülmüş olan var ve sınırı yazılı.
- **Bağlam çubuklarından "Free space" ve "Autocompact buffer" ÇIKARILIR**
  (`HEADROOM`). İkisi tüketim değil artakalan; içeride kalınca boş alan (1.9M)
  ortak cetveli tek başına dolduruyor ve bölümün sorduğu soruyu görünmez
  kılıyordu. Doluluk oranı zaten ajan başına göstergelerde.
- **Nominal kategoriye değer rampası yok:** ajan çubukları tek renk. Koyuluk =
  büyüklük eşlemesi, çubuğun boyunun zaten söylediği şeyi tekrar eder ve tek
  serbest kanalı harcar. Halka istisna: dilimler zaten büyüklüğe göre sıralı.
- **İki büyüklük = iki grafik durumu, iki eksen DEĞİL.** Maliyet/token bir
  değiştirici; ikisini tek çizime koymak iki y-ölçeği demek olurdu.

## Token/maliyet okumaları

- **`session.usage` tümel toplam, `session.lastTurn` yalnız son tur.** Tur payı
  toplamdan TÜRETİLEMEZ (toplam açılışta diskten geri yükleniyor), bu yüzden ayrı
  alan + WS `usage` yayınında ayrı `turns` sözlüğü (`manager.turnSnapshot()`).
- **Bağlam DOLULUĞU terminalin alt çubuğunda bilerek yok.** Pencerenin gerçek üst
  sınırı yalnızca oturumun kontrol isteğinden geliyor; alt çubukta göstermek
  uydurma bir sabit MAX gerektirirdi (bkz. "Uydurma ölçek yazma"). Doluluk
  `/context` ve `/status`ta, gerçek `maxTokens` ile.

## Bilinen açık sorun

- Ajan `complete_task`'ı çağırmadan önce `ToolSearch` ile yüklemek zorunda kalıyor
  (deferred tool); fazladan bir tur maliyeti var, işlevi bozmuyor.

## ŞU ANKİ İŞ — panel revizyonu (oku: HANDOFF.md)

4 fazlı arayüz+sistem revizyonunun **ilk üçü bitti**: Faz 1 (çok panelli
yerleşim, takımlar, orkestratör, premium temalar, sürükle-bırak), Faz 2
(yerleşik slash komutları gerçekten çalışıyor, oturum iç görüsü, tur payı
okumaları, harcama panosu), Faz 3 (Kod, Raporlar, Skill'ler, Browser panelleri).

**Faz 4 = ikinci sağlayıcı ve kullanıcı onu BİLEREK ertelemişti** — açmadan
önce sor. Ayrıntı ve sonraki adımlar `HANDOFF.md`'de.

Devam etmeden önce **`HANDOFF.md`** oku — alınmış kararlar (2. sağlayıcı
ertelendi, Browser paneli Playwright olacak), fazların içeriği ve ortam notları
orada. Kararları yeniden sorma.

## Çok panelli kabuk (yerleşim)

- **Sekme yok, üç yuva var.** `workspace.ts` şekli (PanelId, Tile, Layout) ve
  saf yardımcıları tanımlar; `useLayout.ts` yerleşimi DEĞİŞTİREN tek yerdir.
  Bileşenler yerleşimi doğrudan kurcalamaz — bir paneli taşımak "eski yuvadan
  çıkar + yeniye ekle + eski yuvanın aktifini tazele" üç adımıdır ve üçü tek
  yerde durmazsa bir çağıran sonuncuyu unutup boş yuva bırakır.
- Yan yuvalar **sekmeli** (dar sütunda tek panel okunur), orta yuva **döşeli**
  (`gridCols`, kare köke göre). Terminal bir "panel" değil bir `Tile`: tekil
  değil, her açık ajan kendi gözünü alır.
- Takım dışı terminal gözü **kapanmaz, gizlenir** (App.tsx `centerTiles`).
  Takıma dönünce aynı terminal yerinde durur.
- Yerleşim `localStorage`'da (`claude-manager.layout.v1`), 250ms gecikmeli
  yazılır. `loadLayout()` şekli tutmayan kaydı BÜTÜNÜYLE reddeder; yarı
  geçerli bir yerleşim (var olmayan panel id'si) sessizce boş kutu olurdu.

### Sürükle-bırak

- Taşımanın BİRİNCİL yolu sürüklemedir: panel sekmesi ve panel başlık çubuğu
  sürüklenebilir, üç yuva da (çalışma alanı dahil) bırakma hedefidir. Çerçevedeki
  yerleştirme düğmeleri erişilebilir yedek olarak duruyor (sürükleme klavyeyle
  yapılamaz) ve yalnızca panelin BULUNMADIĞI yuvalar için çiziliyor.
- **İKİ AYRI MIME tipi var ve bu zorunlu:** `DND_PANEL` ve `DND_TERMINAL`.
  HTML5'te `dataTransfer.getData()` `dragover` sırasında OKUNAMAZ, yalnızca
  `drop` anında; hedefin "kabul ediyor muyum" kararını sürükleme sürerken
  vermesi gerekiyor ve o an elde sadece `types` var. Tek MIME kullanıp türü
  yükün içine yazsaydık yan yuva bir terminali kabul ediyormuş gibi görünür,
  bırakınca hiçbir şey olmazdı. (Yan yuva terminali bilerek reddeder: 300px'lik
  sütunda döküm okunmuyor.)
- `dragenter`/`dragleave` çocuk öğelerde de tetiklenir → vurgu titrer.
  `useDropZone` bir DERİNLİK SAYACI tutar; vurgu ancak sayaç sıfırlanınca kalkar.
- Bırakma vurgusu `box-shadow: inset`, `border` DEĞİL: kenarlık yuvanın
  genişliğini 2px değiştirip yanındaki her şeyi oynatıyordu (sürükleme
  sırasında zemin kayması).
- `moveWithin()` hedef indeksi öğe HENÜZ ÇIKARILMAMIŞKEN sayar (kullanıcının
  gördüğü boşluk); hedef kaynağın sağındaysa bir azaltır. Bu düzeltme olmadan
  bir öğeyi bir adım sağa taşımak hiçbir şey yapmaz.

### İki ölçülmüş tuzak

- **`className="center"` KULLANILAMAZ.** `index.css`'te `.center` eski bir
  yardımcı sınıf (`text-align: center; padding: 24px`). Orta yuvaya verilince
  miras yoluyla BÜTÜN terminal dökümünü ortaladı ve yatay taşma yarattı;
  hizalama miras alındığı için hiçbir bileşenin kendi CSS'inde görünmüyordu.
  Orta yuvanın sınıfı `workarea`.
- **Duyarlı kırılmalar `@media` DEĞİL `@container`.** 1568px ekranda bir
  terminal gözü 400px olabiliyor; `@media (max-width: 900px)` orada asla
  tetiklenmez ve iki sütunlu karşılama kutusu kelime kelime sarar. `.pf-body`
  `container-type: inline-size` taşır; survey/katalog/terminal kırılmaları
  panelin kendi genişliğini ölçer.

## Takımlar

- **Takım kayıt defteri YOK** — takımlar ajanlardan türetilir (`web/src/teams.ts`).
  `AgentConfig.team` serbest metin; yeni bir ad yazmak takımı var eder, son
  ajanı taşımak yok eder. Böylece "üyesi olmayan takım" durumu doğamaz.
  Boş/tanımsız olanlar `GENEL` altında toplanır (eski kurulumlar bozulmaz).
- Takım sekmesi **bölüm değil KAPSAM** seçicisidir: açık panelleri değiştirmez,
  hepsinin kimi gösterdiğini değiştirir. Toplu eylemler (tümünü başlat/durdur,
  oto-onay) de seçili takımı hedefler, tüm ekibi değil.
- **`worker` rolü iş DAĞITAMAZ**: `sessionDecorator` ona `team` MCP sunucusunu
  hiç vermez (`server/src/index.ts`). Orkestratör çubuğu bunu `canDelegate()`
  ile kontrol eder — yoksa ajan "bende böyle bir araç yok" der ve dağıtım
  sessizce yapılmamış olur. Yalnızca çalışanlardan kurulu bir takımda çubuk
  dağıtım talimatını hiç eklemez, isteği olduğu gibi tek ajana yollar.
- Orkestratör `delegate_tasks` (ÇOĞUL) emreder: tekil `delegate_task` çağıran
  turu bloklar ve ekip zorunlu olarak seri çalışır.

## Görsel kimlik: gök plakası

- **Ürün otoritesi `PRODUCT.md`**, görsel otorite `web/DESIGN.md`. Tasarım kararı
  alırken önce ikisi okunur. Yön sözleşmesi `web/index.html`'de `<body>`nin ilk
  yorumu olarak duruyor (anahtar `7d9cf4fa`) — üretim derlemesinden sağ çıkar.
- **Dünya:** gök atlası plakası. Ajan = yıldız; **kadir (nokta çapı) = token
  ağırlığı**; renk + biçim = durum (çalışıyor mavi-beyaz, boşta beyaz, onay bekliyor
  kehribar + HALKA, kapalı içi boş); takımyıldız çizgisi = gerçek delegasyon;
  **kapalı ajanlar ufkun altındadır** (gözlenemezler). Hiçbiri süs değil, hepsi
  gerçek veriye bağlı — yeni bir görsel kanal eklerken de bu kural geçerli.
- **Uydurma ölçek yazma.** Gökyüzü ızgarası etiketsiz çizgiyken jenerik bir
  dashboard ızgarasıydı; RA/DEC yazmak da olmazdı (var olmayan veri). Yerine rol
  bantları kondu: konum zaten `ROLE_RANK`e göre sıralı olduğu için halka gerçekten
  bir şey ölçüyor.
- **VARSAYILAN TEMA İKİ YERDE.** `web/index.html`'deki satır içi betiğin yedek
  adı varsayılanı GERÇEKTEN belirler; açılışta `setTheme()` çağıran hiçbir yer
  yok, `themes.ts`'teki `DEFAULT_THEME` yalnızca seçicinin bildiği değer.
  Ayrışırlarsa panel bir temayla boyanır, seçici başkasını işaretli gösterir.
  Şu an ikisi de `obsidian`.
- **İki tema ailesi.** *Plakalar* bir gözlem koşulunu taklit eder (kağıt,
  mürekkep, tane): Gece · Kırmızı Fener · Gündüz. *Premium* işlenmiş bir yüzeyi
  (cam/anodize metal, mürekkep değil ışık): Obsidyen (varsayılan) · Karbon ·
  Aurora — siyah gövde, cyan vurgu, grain 0.42→0.10 ve `overlay` karışım.
  Premium'da da durum renkleri (ok/warn/err) cyan'a boyanmaz; yoksa üç ayrı
  durum tek renge çökerdi.
- **`contrast.mjs` artık aynı seçicinin BİRDEN FAZLA bloğunu tarar.** Premium
  plakalar önce ortak bir listede (yalnızca yüzey davranışı, renk yok), sonra
  kendi bloklarında geçiyor; ilk eşleşmeyi almak aurora'yı sessizce "gece"
  değerleriyle ölçtürdü ve yine "tüm eşikler tutuyor" dedi. Betik en çok renk
  token'ı taşıyan bloğu seçer ve renk bloğu bulunamayan plakada çıkış kodu 2
  ile durur — sessiz düşüş bu betiğin en tehlikeli hata biçimi.
- **Üç plaka, üçü de gerçek bir gözlem koşulu:** Gece · Kırmızı Fener
  (gece görüşünü bozmaz, bu yüzden **mavi yok**; durumlar tonla değil parlaklık ve
  biçimle ayrışır) · Gündüz (basılı plaka, `--glow-a: 0`). Keyfî renk şeması eklemek
  bu üçlünün mantığını bozar.
- **Fontlar paketten gelir** (çevrimdışı da aynı görünsün): Bodoni Moda italik
  (gravür başlıkları), Archivo (arayüz), JetBrains Mono (koordinat/okuma).
- Yerleşim gerçeği: solda plaka indeksi, ortada plaka, Genel Durum'da sağda efemeris
  okumaları. Ekip listesi yalnızca Terminal plakasında — Ajanlar plakasında liste
  sayfanın kendisidir, ikinci bir kopya aynı adları tekrarlıyordu.
