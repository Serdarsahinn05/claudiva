# Sunucu notları (server/)

Kökteki `CLAUDE.md` her oturumda, bu dosya yalnız `server/` altında çalışırken yüklenir.

## Oturum katmanı (proje gerçekleri)

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
- **Panel YOKLAMAZ, sunucu İTER** (`BrowserSession.onChange` → WS
  `browser_state`). İki aktör olmasının doğrudan sonucu: ajan sürerken panel
  hiçbir istek atmıyor, dolayısıyla yoklama ancak kullanıcı elle bir "takip"
  kutusu işaretlerse çalışıyordu — panelin varlık sebebi olan durum tam da
  varsayılan hâlde görünmezdi. Yayını yalnız durumu DEĞİŞTİREN yol yapar
  (`changed()`); `state()` ve `screenshot()` yayın yapmaz, yoksa panelin kendi
  okuması kendine yankı olarak dönerdi. Kare, değişiklik olayına bağlı: sayfa
  kendi kendine değişirse (gecikmeli yönlendirme) yeni kare gelmez.
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
- **`~/.claude` ≠ `~/.claudiva`.** İkincisi `CLAUDIVA_HOME` (eski: `CLAUDE_MANAGER_HOME`) ile
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

## Veri klasörü adı ve tohum güncellemesi

- **Klasörler `.claudiva`** (`~/.claudiva`, `<proje>/.claudiva`). Eski
  `.claude-manager` açılışta bir kez `migrateLegacyDir()` ile taşınır. Taşıma
  YOL ÇÖZÜMÜNDEN ÖNCE çalışır (sabitler modül yüklenirken hesaplanıyor). Klasör
  kilitliyse eski adla devam edilir; ikisi birden varsa yeni kazanır. Ortam
  değişkenleri `CLAUDIVA_HOME`/`CLAUDIVA_PROJECT`, eskileri yedek olarak okunur.
- localStorage anahtarları `claudiva.*`. Eski anahtarlar `web/index.html`
  satır içi betiğinde bundle'dan ÖNCE taşınır, çünkü `themes.ts`/`cliSkins.ts`
  anahtarı modül yüklenirken okuyor.
- **`seedAgents()` var olan ajana dokunmuyordu** → paketteki düzeltme mevcut
  kullanıcıya hiç ulaşmıyordu. `agentUpgrade.ts`:
  - ad ve açıklama yalnız 0.1.x değerine BİREBİR eşitse yenilenir;
  - skill'ler `<ajan>/.seeded-skills` manifestiyle izlenir; manifest yoksa başlangıç 0.1.x skill listesidir, aksi hâlde kullanıcının sildiği eski skill "yeni" sanılıp geri gelirdi.
  - `personality.md`, `plugin.json` ve `SKILL.md` (pasifse `SKILL.md.disabled`, adı korunur) yalnız içerik özeti eski bir paket sürümüne eşitse paketteki sürümle değiştirilir (`agentLegacyContent.ts`: CRLF→LF sha256, ilk 16 hex). Bilinmeyen özet = kullanıcı düzenlemesi, dokunulmaz; yalnız var olan dosya yazılır.
  - Paket ajanının adı ya da açıklaması değişirse eski değeri `LEGACY` tablosuna EKLE.
  - **`agentLegacyContent.ts` ÜRETİLİR:** `node server/scripts/legacy-hashes.mjs` git geçmişindeki BÜTÜN sürümleri tarar (ilk tablo yalnız v0.1.1 + HEAD biliyordu; v0.1.1 öncesi kurulumlar hiç güncellenmedi, ölçüldü). Paket ajan dosyası değişince commit'ten SONRA yeniden çalıştır. Commit'te hiç olmamış ama sahada görülen eski içerik betikteki `SAHADA_GORULEN`e girer (yalnız paketin eski hâli olduğu doğrulanmışsa).
  - **Özet sondaki boşluğu kırpar** (`trimEnd`): eski manifestler aynı içerikte ama sondaki satır sonu eksikti, tek bayt yüzünden eşleşmiyordu.
  - **`writeAgentFiles` plugin.json'u yalnız YOKSA yazar.** Eskiden her ajan güncellemesinde (oto-onay düğmesi dahil) `"<ad> skill'leri"` diye yeniden yazıp paketteki açıklamayı eziyordu; bu üretilmiş kalıp ada göre değiştiği için özetle tanınamaz, `isGeneratedManifest` onu ayrıca tanıyıp onarır.
- **Ajan oturumları `CLAUDIVA_AGENT=1` taşır** (`claudeBackend` → SDK `env`).
  `env` verilince SDK süreç ortamını devralmaz, bu yüzden `process.env`in
  tamamı taşınıyor. Kullanıcının skill kütüphanesi bu değişkene bakıp ajan
  oturumlarında sessiz kalır.
- **Resume geri düşüşü mesajı yeniden gönderirken dökümde İKİNCİ KEZ yazmamalı**
  (`send(..., { replay: true })`). Ölçüldü: başka bir cwd'de açılan oturumda
  (ör. repo klasörü yeniden adlandırılınca) her ajanın ilk mesajı çift görünüyordu.
