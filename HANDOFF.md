# Devir — panel revizyonu (4 fazlı)

**Son güncelleme:** 2026-08-15 · **Durum:** Faz 1, 2 ve 3 BİTTİ, üstüne iki ek
iş yapıldı (sözdizimi renklendirme + skill katalogu). **Faz 4 (ikinci
sağlayıcı) sırada — ama kullanıcı onu bilerek ertelemişti; açmadan önce sor.**

## ⚡ Sonraki oturum buradan başla

1. Bu dosyayı ve `CLAUDE.md`'yi oku (ikisi de güncel).
2. **Değişiklikler HÂLÂ COMMIT EDİLMEDİ.** Üç fazın tamamı + iki ek iş çalışma
   ağacında duruyor. Kullanıcı isterse ilk iş commit olabilir.
3. Yarım kalan iş YOK. Faz 3'ün dört paneli ve iki ek iş canlı doğrulandı.
4. Açık uç sayılabilecek tek şey: **Browser panelinde ajan bir sayfa açtığında
   panel kendiliğinden tazelenmiyor** — kullanıcı "takip" kutusunu işaretlerse
   2 saniyede bir yeniliyor. WS ile push yapmak doğru çözüm; küçük iş, HANDOFF
   dışı bir istek gelmezse öncelik değil.

## Ek iş (Faz 3 sonrası, kullanıcı isteği) — BİTTİ ✅

### 1) Kod panelinde sözdizimi renklendirme
`web/src/highlight.ts` + `web/src/prismLangs.ts` + `prismjs-components.d.ts`;
`index.css`/`themes.css`'e `--syn-*` kanalları; `contrast.mjs` genişletildi.

Faz 3'te "renklendirme yok" bir KARARDI ("en küçük highlighter bile paneli
paketin en büyük parçası yapardı"). Kullanıcı isteyince gerekçe **ölçüldü ve
tutmadı**: Prism 25.5 KB gzip, tembel yığın, panel açılmadan 0 bayt (uygulama
129 KB). Shiki ölçülüp elendi (309 KB = uygulamanın 2.4 katı). Ayrıntı ve
tuzaklar `CLAUDE.md` → "Sözdizimi renklendirme".

Doğrulandı: 8 dilde kayıpsızlık (parçaların birleşimi = kaynak), 6 plakada
kontrast eşiği (çıkış kodu 0), canlı panelde ts/tsx/markdown + üç plaka.
Bulunan ve düzeltilen 2 gerçek hata: (a) şablon dizgesi içindeki kod dizge
rengine boyanıyordu (`interpolation`), (b) Vite dil başına ayrı yığın üretip
28 istek atıyordu.

### 1b) Kod panelinde dosya türü ikonları
`server/src/fileIcons.ts` + `GET /api/file-icon/:name` + `TreeEntry.icon`.

VS Code'daki gibi dil/klasör ikonları (`material-icon-theme`, MIT, 1250 ikon).
Kullanıcı `vscode-icons`u önerdi ama o npm'de yok (404) ve deposu 4.08 MB.

Kritik karar: **ikonlar pakete girmiyor, sunucudan tek tek servis ediliyor** —
kullanıcı "bu araç yarın başka bir projede açılacak" dediği için dar bir set
seçmek yanlıştı; tam kapsam gerekiyordu ama 1 MB pakete konamazdı. Ölçülmüş
sonuç: **paket etkisi 0 bayt**, 87 satırlık ağaç 27 istek / 21.9 KB, yenilemede
0 (immutable önbellek). Ayrıntı `CLAUDE.md` → "Dosya ikonları".

Doğrulandı: 6 plakada canlı. Kırmızı Fener için `--icon-filter` eklendi
(renkli marka logoları o plakanın "mavi yok" kuralını deliyordu); Gündüz'de
`_light` sürümlerine gerek olmadığı ÖLÇÜLDÜ. Yol kaçışı (`..%2f`) reddedildi.

### 1c) `skills-lock.json` artığı düzeltildi
`removeSkill` artık kilit kaydını da düşürüyor — ama KOŞULLU: kilit yalnız
dizin adıyla anahtarlanıyor, kapsam boyutu yok; aynı skill iki kapsamda
kuruluysa kayıt diğeri için hâlâ doğru. Doğrulandı: kur → sil sonrası dosya
birebir eski hâline döndü (git diff boş).

### 2) Skill katalogu — "Keşfet" kipi
`server/src/skillCatalog.ts` + 5 uç (`/api/skills/catalog`,
`/catalog/refresh`, `/sources` GET/POST/DELETE, `/install-many`);
`Skills.tsx` iki kipli (Kurulu · Keşfet).

Küratörlü depolar (anthropics/skills · obra/superpowers · wshobson/agents) +
kullanıcı kendi deposunu ekleyebiliyor. Ara, işaretle, **toplu kur** —
kapsam bir kez sorulur. Ölçüldü: 3 istekle 212 skill, 9.4sn, açıklamasız 0.
Uçtan uca sınandı: 2 kurulum + 1 kasıtlı hata → hata diğerlerini iptal
etmedi; "kurulu" rozeti döndü; çift kurulum reddedildi; test kurulumları
geri alındı (`skills-lock.json` `git checkout` ile temizlendi).

Kullanıcının 7 maddelik arayüz+sistem revizyon isteği fazlara bölündü. Kullanıcı
"fazlı teslim, her faz sonunda çalışan panel" seçti.

---

## Alınmış kararlar (yeniden sorma)

| Konu | Karar |
|---|---|
| **Madde 7 — 2. sağlayıcı** | **ERTELENDİ.** Makinede Claude dışında CLI yok (`@anthropic-ai/claude-code@2.1.232` tek). `ProviderId` tek üyeli kalıyor. Kullanıcı yeniden açmadıkça dokunma. |
| **Madde 6 — Browser paneli** | **Playwright, sunucu tarafında.** Headless Chromium sunucuda sürülecek, panele canlı görüntü akacak, her eylem mevcut `canUseTool` izin kapısından geçecek. Faz 3'te. |
| **Teslim** | Fazlı. Her faz sonunda `npm run build` + `contrast.mjs` + canlı panelde doğrulama, sonra kullanıcıya rapor. |

---

## Faz 1 — BİTTİ ✅

Yerleşim, takımlar, orkestratör, premium temalar, yeniden tasarlanan ekranlar,
panel sürükle-bırak. Ayrıntılı mimari ve tuzaklar `CLAUDE.md` içine yazıldı
(bölümler: "Çok panelli kabuk", "Takımlar", "Görsel kimlik").

**Yeni dosyalar:** `web/src/workspace.ts`, `web/src/useLayout.ts`,
`web/src/teams.ts`, `web/src/components/Workspace.tsx`,
`web/src/components/TeamTabs.tsx`, `web/src/components/Orchestrator.tsx`.

**Doğrulandı:** build temiz · kontrast 6 plakada eşiği tutuyor (çıkış kodu 0) ·
sürüklemenin 4 yolu canlı sayfada gerçek `DragEvent`'lerle sınandı.

### Faz 1'de bulunan ve düzeltilen 3 gerçek hata
1. `.center` sınıf çakışması (eski `text-align: center` yardımcısı bütün terminal
   dökümünü ortalıyordu) → orta yuva `workarea` oldu.
2. `@media` panel genişliğini değil viewport'u ölçüyordu → `@container`.
3. `contrast.mjs` aurora'yı sessizce "gece" değerleriyle ölçüp yine "tüm eşikler
   tutuyor" diyordu → renk taşıyan bloğu seçiyor, bulamazsa çıkış kodu 2.

### Faz 1'in açık ucu (kullanıcı yanıtı bekliyor)
- Kullanıcıya soruldu, yanıt gelmedi: sürükleme tutma alanı büyümeli mi, bırakma
  çizgisi daha belirgin mi olmalı? Şikâyet yoksa olduğu gibi bırak.
- **impeccable hook bulgusu — bilerek düzeltilmedi:** `web/index.html` açılış
  perdesindeki `boot-scan` çubuğu "marquee" olarak işaretlendi. Yanlış pozitif
  (içeriksiz belirsiz-ilerleme göstergesi; `prefers-reduced-motion` altında zaten
  nabza dönüyor). Kullanıcı isterse:
  `/impeccable hooks ignore-value marquee "*" --file "web/index.html"`

---

## Faz 2 — BİTTİ ✅ (terminal + token/maliyet)

### 2a) Terminal = gerçek CLI (madde 3)

**Kök neden beklenenden başkaydı ve ölçüldü.** Komutların "karşılıksız kalması"
allowlist yüzünden değildi: `ClaudeBackend.send()` otomatik-model hatırlatmasını
HER mesajın başına ekliyordu, CLI ise bir mesajı ancak **ilk karakteri `/`** ise
komut olarak ayrıştırıyor. Yani `/compact` CLI'a `[Hatırlatma: …]\n\n/compact`
olarak gidiyor, komut hiç çalışmıyor, yalnızca model metni okuyordu. Tek satırlık
kapı (`isSlashCommand()`) bunu düzeltti — **SDK tarafındaki 60 komutun tamamı
artık gerçekten çalışıyor.** Doğrulandı: `/compact` → CLI'ın kendi yanıtı
("Not enough messages to compact."), 0 token, tur temiz kapandı.

Kurulan ayrım — komut CLI'da **etkileşimli ekran mı açıyor**, yoksa **prompt'a mı
genişliyor**:
- Etkileşimli olanlar panelde çalışır (14 komut): `/help /status /context /usage
  (/cost) /model /agents /mcp /config /doctor /memory /todos /export /resume
  /clear`. CLI'ın çizeceği menünün panelde yüzeyi yok; veri zaten sunucuda.
- Prompt'a genişleyen her şey (`/compact`, `/init`, `/review`, skill'ler…)
  olduğu gibi SDK'ya gider. Panel hiçbir komutu reddetmez.

**Veri kaynağı: `GET /api/agents/:id/inspect?parts=…`** → `AgentSession.inspect()`
→ `AgentBackend.inspect()`. Normalleştirilmiş 5 parça (context/models/agents/
mcp/account), her biri ayrı try/catch ile **en iyi çaba**: biri okunamazsa `null`,
diğerleri yine döner. `null` = okunamadı, `undefined` = istenmedi — panel ikisini
ayrı yazdırır. Taşınabilirlik buradan geliyor: projeye gömülü hiçbir şey yok,
komut seti oturumun kendisinden okunuyor.

Ayrıca: yerel çıktıların hizalı `<pre>` görünümü geri geldi (skinli döküme
taşınırken kaybolan tek şeydi) ve composer `SkinnedComposer`a taşındı — kip
satırı gerçek izin kipini gösteriyor (oto onay / her araçta sor / N izin bekliyor).

### 2b) Token/maliyet görünürlüğü (madde 4)
`AgentSession.lastTurn` eklendi (tümel `usage`'dan türetilemez), `turnSnapshot()`
ile WS `usage` yayınına iliştirildi. Üç yerde okunuyor:
- Göz rozeti: `model · +turn · toplam`
- Terminal alt çubuğu: `son tur +N · $X · toplam · $Y · [bütçe %] · model`
- `/usage` ve `/status`: tur dökümü + panel bütçesi + plan kotası

Bağlam DOLULUĞU bilerek alt çubukta yok: gerçek üst sınır yalnızca oturumun
kontrol isteğinden geliyor, orada göstermek uydurma bir sabit MAX gerektirirdi.
`/context` gerçek `maxTokens` ile çalışıyor.

### 2c) Harcama panosu (kullanıcı isteği üzerine eklendi)
Terminaldeki okuma kaldı, üstüne ayrı bir panel geldi: **Harcama**
(`web/src/components/UsageBoard.tsx` + `charts.tsx`, `PanelId: 'usage'`).

Yeni veri kaynağı: **`data/usage-history.json`** (`server/src/agents/usageHistory.ts`)
— tur tur, zaman damgalı, 5000 turluk pencere. Bu olmadan zaman ekseni ÇİZİLEMEZDİ:
`usage.json` yalnız zamansız sayaçlar tutuyor. Kayıt bu sürümle başlar ve pano bunu
açıkça yazar.

Bölümler ve biçimleri (biçim veriye göre seçildi, süs olarak değil):
- kahraman sayı + 5 kutucuk · **ne kadar kaldı**: bütçe + plan kotası pencereleri
  (gösterge çubuğu, iki dilimli pasta değil) · **zaman içinde**: alan grafiği,
  nişangâh + ipucu, maliyet/token değiştiricisi (tek eksen) · **kim harcadı**:
  halka + lejant (≤6 dilim, kuyruk "Diğer") · **model başına** · **bağlam nereye
  gidiyor** + ajan başına doluluk · **en çok token yiyen dosyalar** ·
  **MCP bağlam vergisi** · **ajan başına tam döküm tablosu**.

Ölçülmüş bulgular (pano ilk açılışta bunları gösterdi): proje `CLAUDE.md`'si üç
ajanda birden yüklü ve 31.0k token; `claude_ai_Descript` MCP sunucusu 42 aracıyla
25.0k token bağlam vergisi alıyor.

### Faz 2'de bulunan ve düzeltilen 2 gerçek hata
1. **Slash komutları CLI'a hiç ulaşmıyordu** (yukarıdaki hatırlatma öneki).
2. `/context` kategori yüzdeleri `totalTokens`e bölünüyordu; oysa kategoriler
   pencerenin TAMAMINI böler ("Free space" da bir kategori) → 889.6k boş alan
   **%2023** çıkıyordu. Payda `maxTokens` oldu, toplam artık %100.
3. (pano) Aynı "Free space" satırı bu kez ortak cetveli tek başına dolduruyor,
   gerçek tüketicileri ölçülemez hâle getiriyordu → artakalan satırları çubuk
   dökümünden çıkarıldı (`HEADROOM`), doluluk ayrı göstergede.

---

## Faz 3 — BİTTİ ✅ (4/4 panel)

Yeni panel eklemek ucuz: `web/src/workspace.ts` içindeki `PanelId` +
`PANELS` kaydına birer satır, `App.tsx` `renderPanel()` içine bir `case`.

### ✅ Kod paneli
`web/src/components/Code.tsx` + `server/src/files.ts`
(`GET /api/files/tree`, `GET /api/files/read`).

Değişiklikler panelinden AYRI bir soruyu yanıtlıyor: o "son commit'e göre ne
farklı"yı gösteriyor, commit'lenen dosya listeden düşüyor ve ajanın okuyup
değiştirmediği dosya hiç görünmüyordu. Burada kod tabanının kendisi var, tembel
yüklenen ağaç + satır numaralı salt-okunur görüntüleyici + "bu dosyaya kim
dokundu" rozeti (git farkından düşmüş dosyada da durur).

**Yazma ucu bilerek YOK**: dosyayı değiştiren tek özne ajan ve o izin kapısından
geçiyor; panele ikinci bir yazma yolu açmak o kapıyı delerdi. Yol güvenliği
`safeResolve` (git.ts ile aynı kapı) — göreli/mutlak kaçış denemeleri sınandı,
üçü de reddedildi. Sözdizimi renklendirme yok: proje hiçbir highlight/ikon
kütüphanesi taşımıyor, en küçüğü bile paketin en büyük parçası olurdu.

### ✅ Raporlar paneli
`web/src/components/Reports.tsx` + `GET /api/reports`.

İddia (ajanın `result` metni) ile ölçüm (o işte gerçekten yazılan dosyalar) yan
yana. "Bitirdim" deyip hiçbir dosyaya dokunmamış görev rozetinde kendini ele
veriyor (`dosya yok` sönük rozet vs `N dosya` yeşil).

**Bu panel yazılırken gerçek bir hata bulundu ve düzeltildi:** kanıt zinciri
delegasyonda kopuyordu. Kullanıcı boss'a iş verir, boss çalışana delege eder,
dosya dokunuşu ALT görevin kimliğini taşır → üst görevin raporu "dosya yok"
diyordu (ölçüldü: rapor "FAZ3-TEST.md oluşturuldu" derken kanıt boştu). Çözüm
`Task.parentTaskId` + `/reports`'ta alt ağaç toplama; `delegate_task`,
`delegate_tasks` ve `chainAfter` ebeveyni `tasks.currentTaskFor(selfId)`'den
alıyor. `delegate_tasks`'te ebeveyn döngü DIŞINDA bir kez okunur.
Doğrulandı: delege edilen işte torunun yazdığı dosya üst raporda görünüyor.

### ✅ Skill'ler paneli
`web/src/components/Skills.tsx` + `server/src/skills.ts`
(`GET /api/skills`, `POST /api/skills/toggle`, `DELETE /api/skills`,
`POST /api/skills/install`). Üç kapsam: genel (`~/.claude/skills`), proje
(`.claude/skills`), ajan (`~/.claude-manager/agents/<id>/skills`). 63 skill
bulundu, arama ad+açıklamada çalışıyor.

**Aç/kapat mekanizması ÖLÇÜLDÜ, uydurulmadı:** `settings.json`'da skill kapatan
bir anahtar YOK. Yükleyici `<dizin>/SKILL.md` arıyor, dolayısıyla tek geri
alınabilir yol o dosyayı `SKILL.md.disabled` yapmak. Tam döngü sınandı: ajanın
komut sayısı 67 → 66 (skill düştü) → 67 (geri geldi).

GitHub kurulumu arşiv değil **tek tek dosya** indiriyor (tarball açmak bir
sıkıştırma bağımlılığı ister ve arşiv içi yollara güvenmek gerekirdi); her ad ve
hedef yol ayrı ayrı köke karşı sınanıyor, yarım kurulum temizleniyor,
`skills-lock.json` mevcut biçimiyle güncelleniyor.

### ✅ Browser paneli
`web/src/components/Browser.tsx` + `server/src/browser.ts` +
`server/src/browserTools.ts` (`/api/browser/state|navigate|act|screenshot|close`).

Kullanıcı Playwright kurulumunu **onayladı**. Kurulan: `playwright-core` +
`npx playwright-core install chromium` — tam `playwright` paketi üç tarayıcı
indirip ~1GB olurdu, kullanıcıya ~300MB denmişti. Chromium 151 doğrulandı.
Playwright **tembel import** edilir: paket ya da tarayıcı yoksa sunucu ayakta
kalır, yalnız bu panel "kurulu değil" der.

**Tek tarayıcı, iki aktör:** kullanıcı panelden sürer (izin sorulmaz, aktör
zaten o), ajan `mcp__browser__*` ile sürer (mevcut `canUseTool` kapısından
geçer). Ajanın açtığı sayfayı kullanıcı panelde görür ve devralır — ajana ayrı
bir örnek vermek "ajan ne yapıyor"u yeniden görünmez kılardı.

Ajan METİN okur (`read`), ekran görüntüsü değil: sayfa metni zaten sayfada ve
görüntü yollamak hem pahalı hem modele yaramıyor. Görüntü insana ait.

**Browser'da bulunan ve düzeltilen 2 gerçek hata:**
1. *Güvenlik:* araçlar `allowedTools`'a eklenmişti; o listedeki araç
   `canUseTool`'a **hiç sorulmuyor** — oto-onayı KAPALI bir ajan bile izinsiz
   sayfa açıyordu (ölçüldü). Liste kaldırıldı; artık izin bandı çıkıyor ve
   uçtan uca doğrulandı (durum `waiting` → onay → sayfa açıldı).
2. *Durum raporu:* tıklama gezinme başlattığında panel Chromium'un ara
   başlığını ("Loading https://…") ve **eski URL'i** gösteriyordu. Üç yaklaşım
   denendi; çalışan `waitForURL` (bkz. `settle()` yorumu). Boşta tıklama
   0.43sn'de dönüyor, sabit gecikme yok.

Protokol kapısı: yalnız `http`/`https`. `file://`, `chrome://`, `javascript:`,
`ftp://` denendi, dördü de reddedildi.

### Memory paneli
Zaten var; Faz 3'te dokunulmadı, gerek görülmedi.

---

## Faz 4 — Sağlayıcı

Kullanıcı erteledi. Yeniden açarsa: `server/src/agents/backends/` altına yeni
dosya + `backends/index.ts`'e bir dal. `AgentSession`'a DOKUNULMAZ.

---

## Faz 3'te panel sayısı 7'den 11'e çıktı

`PanelId`: survey, office, agents, **usage**, tasks, **code**, **reports**,
**skills**, **browser**, changes, memory, prompts. Yeni panel eklemek hâlâ ucuz:
`workspace.ts`'e iki satır + `App.tsx` `renderPanel()`'e bir `case`.

Kayıtlı yerleşim (`localStorage`) yeni panelleri KENDİLİĞİNDEN almaz — eski
kayıt geçerli kaldığı için Rail'den açılırlar. Temiz başlangıç için başlıktaki
"Yerleşimi sıfırla".

## Ortam notları (sonraki oturum için)

- **Değişiklikler COMMIT EDİLMEDİ.** Kullanıcı istemedi. Devam etmeden önce
  `git status` ile bak; kullanıcı isterse commit et.
- Faz 1'de test için 8 ajana takım atandı (API ile, `config.json`'lara yazıldı):
  `boss, tech-lead, senior-dev, frontend-dev → PRODUCT` · `reviewer, tester →
  QUALITY` · `researcher, docs → RESEARCH`. Bu **benim demo verim**, kullanıcının
  tercihi değil — istemezse değiştirilebilir.
- Sunucu 4600'de çalışıyor olabilir. Öldürmeden önce porta bak, boşaldığını
  DOĞRULA (`CLAUDE.md` "Test/çalıştırma tuzakları").
- Doğrulama daima `npm run build` (CLI `server/dist`i çalıştırır; `tsc --noEmit`
  web'de hiçbir şeyi denetlemez) + `cd web && node scripts/contrast.mjs`.
