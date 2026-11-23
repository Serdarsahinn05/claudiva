# Claudiva — Proje Analizi, Eksikler ve Fikirler

**Tarih:** 2026-11-23 · **Kapsam:** kod tabanı (`server/`, `web/`, `bin/`), `CLAUDE.md`,
`HANDOFF.md`, `PRODUCT.md`, `docs/` altındaki ekran görüntüsü ve video,
[Orkas-AI/Orkas](https://github.com/Orkas-AI/Orkas) deposu.

> Bu belge bir değerlendirmedir, karar değildir. Kesin olanlar (koddan doğrulandı) ile
> tahmin/öneri olanlar ayrı yazıldı.

---

## 1. Proje ne? — tek paragraf

Claudiva (npm: `claudiva` 0.1.1, MIT, Node 20+), kullanıcının makinesinde çalışan bir
**Express + WebSocket sunucusu** ile bir **React 19 / Vite paneli**dir. Claude Agent SDK
üzerinden birden fazla Claude ajanını kullanıcının proje klasöründe çalıştırır.

- **Ajanlar ve roller:** Ajan tanımları global olarak `~/.claude-manager/agents` altında
  durur, çalışma verisi projenin `.claude-manager/data` dizinindedir. Dört rol var:
  `boss | manager | team-leader | worker`.
- **Süreç içi MCP sunucuları:**
  - `team`: `delegate_task(s)`, `check_task`, `list_tasks` ve benzerleri. Worker'a verilmez.
  - `task`: `complete_task`.
  - `self`: `set_model`.
  - `browser`: Playwright ile sunucu tarafında Chromium sürer.
- **Görevler:** Tekil görevler ve bağımlılıklı zincirler var. Delegasyon ağacı
  `parentTaskId` ile kurulur.
- **Panel:** Üç yuvalı bir kabuk ve 12 panel: survey, office, agents, usage, tasks, code,
  reports, skills, browser, changes, memory, prompts. Her açık ajan orta yuvada kendi
  terminal gözünü alır.

**Mesaj akışı:**

```
SkinnedComposer → Terminal.tsx → POST /api/agents/:id/message
  → AgentSession.send()  (bütçe kapısı, gerekirse oturumu başlatır)
  → ClaudeBackend.send() (otomatik-model hatırlatması önek olarak eklenir)
  → AsyncQueue → SDK query()
  → onBackendMessage → pushEvent → AgentManager 'agent_event'
  → WsHub.broadcast → useStore.transcripts[agentId] → SkinnedTranscript
```

**Orkestratör çubuğu ("Ekibe dağıt")** ayrı bir servis değildir. Takım liderine
`delegate_tasks` çağırmasını emreden bir brif yollar. Lider de görevleri `TaskQueue`
üzerinden her ajanın kendi oturumuna dağıtır.

---

## 2. Güçlü yanlar (korunmalı)

1. **Ölçerek karar verme kültürü.** `CLAUDE.md`, ölçülmüş tuzakların kaydıdır: slash
   komutu öneki, `/context` paydası, `allowedTools` izin deliği, CRLF frontmatter. Çoğu
   projede bu bilgi kafada kalır.
2. **`AgentBackend` soyutlaması.** `AgentSession` SDK'yı bilmez. İkinci sağlayıcı
   eklemenin maliyeti gerçekten "bir dosya + bir dal" düzeyinde.
3. **Gerçek paralel delegasyon** (`delegate_tasks`). Ön doğrulama var, kısmi dağıtım yok.
4. **İddia ile kanıt ayrımı** (Raporlar). "Bitirdim" diyen ama dosyaya dokunmayan
   görev ele veriliyor. Bu, rakiplerde pek görülmeyen bir güven özelliği.
5. **Bütçe kapısı doğru yerde** (`send()` + `dispatch()`). Ölü oturumu yeniden başlatan
   yol da kapıdan geçiyor.
6. **Tanım global, veri projeye ait.** Aynı ajan birden fazla projede kullanılabiliyor.
7. **Paket disiplini.** İkonlar sunucudan servis ediliyor (pakete 0 bayt), Prism tembel
   yükleniyor, Playwright opsiyonel.

---

## 3. Kritik eksikler (öncelik sırasıyla)

### 3.1 🔴 Güvenlik: panel ağa ve her web sitesine açık

Koddan doğrulandı:

- `server/src/index.ts:69`: `app.use(cors())`. Her kökene izin veriyor.
- `server/src/index.ts:129`: `server.listen(PORT, …)` host vermiyor, yani tüm
  arayüzleri dinliyor (`::` / `0.0.0.0`). Açılış mesajı ise `localhost` yazıyor ve bunu
  gizliyor.
- Hiçbir REST ucunda ve WS'te kimlik doğrulama yok. WS'te Origin denetimi de yok.

**Sonuç:** Aynı ağdaki herhangi biri, ya da kullanıcının tarayıcıda açtığı herhangi bir
site (CORS açık olduğu için `fetch` ile), şunları yapabilir:

- ajana mesaj göndermek (oto-onaylı ajan Bash çalıştırır),
- bekleyen izin isteğini onaylamak (`POST /api/agents/:id/permission`),
- `mcpServers` içinde `stdio` tipi sunucu taşıyan yeni bir ajan yaratmak. Bu doğrudan
  **keyfi komut çalıştırma** demek.
- dosya değişikliklerini geri almak (`POST /api/changes/revert`),
- sunucudaki Chromium'u iç ağ adreslerine yönlendirmek (SSRF),
- rastgele bir depodan skill kurmak.

**Öneri (küçük iş, büyük etki):**

1. Varsayılan dinleme adresi `127.0.0.1` olsun. Ağdan erişim yalnızca `--host 0.0.0.0`
   bayrağıyla açılsın.
2. Açılışta rastgele bir token üretilsin. CLI paneli `http://localhost:4600/?t=…` ile
   açsın. Token bir çereze ya da başlığa taşınsın ve her `/api` ile `/ws` isteğinde
   denetlensin.
3. CORS kaldırılsın (panel aynı kökenden servis ediliyor, ona gerek yok). WS el
   sıkışmasında `Origin` denetimi eklensin.
4. Browser URL kapısına özel ağ aralıkları (10/8, 192.168/16, 169.254/16) için bir uyarı
   ya da izin adımı eklensin.

### 3.2 🔴 Test ve CI yok

- Hiç `*.test.*` ya da `*.spec.*` dosyası yok. `.github/` yok. Sunucu lint edilmiyor,
  yalnızca `tsc` çalışıyor.
- `CLAUDE.md`'deki her "ölçülmüş tuzak" bir regresyon testi adayı. En değerlileri:
  - `TaskQueue.init()` `pending` görevi `failed` yapmamalı.
  - `isSlashCommand()` kapısı: `/compact` öneksiz gitmeli.
  - `handleMessage()` başındaki `if (!this.q) return;` bekçisi: paralel stop sonrası
    durum `offline` kalmalı.
  - `extraMcpServers` birleştirmesi: team, self ve task araçları görünür olmalı.
  - `delegate_tasks`: bir hedef geçersizse hiçbir görev dağıtılmamalı.
  - `/context` yüzdelerinin toplamı %100 olmalı.
  - `safeResolve` ve ikon adı: yol kaçışı reddedilmeli.
- Önerilen başlangıç: Vitest (Vite zaten var). Bir GitHub Actions iş akışı şunları
  çalıştırsın: `npm ci`, `npm run build`, `vitest run` ve `node web/scripts/contrast.mjs`.

### 3.3 🟠 Bağımlılık: SDK sürümü `"latest"`

`package.json:50`: `"@anthropic-ai/claude-agent-sdk": "latest"`. Yayımlanmış bir pakette
bu, kullanıcının kurduğu gün sürümün değişmesi demek. SDK mesaj şekli değişirse
`ClaudeBackend` sessizce kırılır. Sürüm sabitlenmeli (`^x.y.z`) ve güncellemeler
bilerek yapılmalı.

### 3.4 🟠 Model takma adları bir nesil geride

`server/src/agents/backends/claudeBackend.ts:25-28`:

```ts
haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-5', opus: 'claude-opus-4-8'
```

Güncel aile **Opus 5.5 / Sonnet 5.5 / Haiku 5.5** (`claude-opus-5-5`,
`claude-sonnet-5-5`, `claude-haiku-5-5`). Ayrıca **Fable 5.2** (`claude-fable-5-2`) var.
Ekran görüntüsündeki "Proje Yöneticisi Fable" de bunu kullanıyor.

Ayrıca "haiku basit / sonnet orta / opus zor" eşlemesi **üç yerde** elle yazılmış:
`selfTools.ts:21`, `claudeBackend.ts:113` ve `claudeBackend.ts:283-293`. Tek bir tabloya
indirilmeli.

### 3.5 🟠 Paralel ajanlar aynı çalışma ağacına yazıyor

İki ajan aynı dosyayı aynı anda düzenleyebilir. Ne kilit ne izolasyon var. `delegate_tasks`
ne kadar paralelse risk o kadar büyük. Videodaki "audit runs in a worktree" fikri tam
bunun çözümü (bkz. §8).

### 3.6 🟡 Çeviri altyapısı yok

Arayüz, CLI yardımı ve ajan istemleri sabit Türkçe. `web/index.html:2` ise `lang="en"`
diyor (ekran okuyucular yanlış dili seslendirir). PRODUCT.md ürünü "herkese açık dağıtılan
araç" olarak tanımlıyor. En azından `lang="tr"` düzeltilmeli ve metinler bir sözlüğe
toplanmaya başlanmalı.

### 3.7 🟡 Belge çelişkileri ve bayatlık

- `HANDOFF.md` "değişiklikler commit edilmedi" diyor, ama çalışma ağacı temiz ve
  0.1.1 yayımlanmış.
- `PRODUCT.md` iki şey söylüyor: "Bağlayıcı bir görsel kimlik yok, mevcut görünüm
  reddedildi" ve ürün adı "claudiva". `CLAUDE.md` ise gök plakasını ve `web/DESIGN.md`yi
  otorite sayıyor. Hangisinin geçerli olduğu yazılmalı.
- **`CLAUDE.md` 36.5 KB.** Harcama panosu kendisi ölçmüştü: bu dosya ajanlarda 31k token
  bağlam vergisi alıyor. Panelin ajanları da bu proje klasöründe çalıştığı için her ajan
  her turda geliştirici notlarını taşıyor. Öneri: geliştirici tuzakları `docs/DEV-NOTES.md`
  dosyasına taşınsın, `CLAUDE.md` kısa bir dizin olarak kalsın.

### 3.8 🟡 `complete_task` her görevde fazladan tur harcıyor

Araç ertelenmiş (deferred) olarak geliyor, ajan önce `ToolSearch` çağırıyor. Bilinen açık
sorun olarak kayıtlı. Olası çözüm: `task` sunucusu `allowedTools` listesine ekli ama
araç hâlâ ertelenmiş geliyor. SDK'nın erteleme eşiği ya da araç sayısı ayarı denenmeli
ya da `complete_task` sistem isteminde ad olarak verilmeli. Bu ölçülmeli, varsayılmamalı.

---

## 4. Gereksiz / fazlalık

| Ne | Neden fazla | Öneri |
|---|---|---|
| `web/src/components/brainless/` altındaki kullanılmayan bloklar ve menüler (~2.5k satır: `claude-session`, `codex-session`, `grok-*`, `pied-piper-onboarding`, slash menüleri…) | Hiçbir yerden import edilmiyor | Sil. Git geçmişinde zaten duruyor. |
| Codex / Grok **skin**leri | O sağlayıcılar yok (Faz 4 ertelendi). `SkinnedTranscript` her öğeyi üç kez çiziyor. | Faz 4'e kadar yalnız Claude skin'i kalsın, ya da skin seçimi tek bir bileşene indirilsin. |
| `web/src/index.css` (2947 satır) | Tek dosyada bütün paneller | Panel başına CSS dosyası. Token ve tema blokları ayrı kalsın. |
| `Skills.tsx` (862 satır) | İki kip (Kurulu / Keşfet) tek dosyada | İki bileşene bölünebilir. |
| Paylaşılan tipler iki kopya (`server/src/types.ts` ↔ `web/src/types.ts`) | Elle senkron. Unutulursa sessiz hata. | Kökte bir `shared/` klasörü ve tsconfig yol takma adı. |
| Yeni kullanıcıya 12 panel + 6 tema | PRODUCT.md ilkesi 5: "giriş noktası acemiyi boğmamalı" | Varsayılan yerleşim 2-3 panel olsun, gerisi Rail'den açılsın. |
| Ofis + Gök plakası | İkisi de "ekip durumu" görselleştirmesi | Biri varsayılan olsun, diğeri seçenek kalsın. Ofis grup sohbetiyle eşleşince daha anlamlı (ekran görüntüsündeki gibi). |
| `ProviderId` ve yetenek bayrakları | Tek uygulama var, bayraklar dallanmada kullanılmıyor | Bu bilinçli bir hazırlık, dokunma. Faz 4 açılınca anlam kazanır. |

---

## 5. Orkas — işe yarar mı?

**Kısa cevap: bağımlılık ya da çatal olarak hayır; fikir ve referans kaynağı olarak
kesinlikle evet.**

### Ne olduğu

- MIT lisanslı, yaklaşık 9.6k yıldız, 1060 commit, son sürüm `v2026.11.16`. Çok aktif.
- **Electron masaüstü uygulaması**, kütüphane değil (npm paketi ya da genel API yok).
- Genel amaçlı bir "AI ekibi": **Commander** bir hedefi yapılacaklara böler, 16 yerleşik
  ajana (DeepResearcher, ContentWriter, PptMaker, ECommerce* …) ya da yerel CLI
  ajanlarına dağıtır.
- Paketlenmiş sürümde hesap ve ücretli katman var ($11.99/ay'dan başlıyor). Kaynak
  sürümde yok.

### Neden doğrudan kullanılamaz

- Mimari uyuşmuyor: biz Node sunucusu + web paneli + npm CLI'yız, o Electron.
- Kitle farklı: o genel ofis/pazarlama işleri için, biz geliştiricinin kendi deposu için.
- Çatallamak, bizim güçlü yanlarımızı (kanıt zinciri, bütçe kapısı, ölçülmüş tuzaklar)
  başka bir kod tabanına taşımak demek olurdu.

### Alınacak fikirler (MIT: atıfla okunup uyarlanabilir)

1. **Üç ayrı delegasyon fiili.** Bizde yalnız `delegate_task(s)` var.
   - `dispatch_to`: adlı ajanı çalıştır, bekle ya da asenkron bildirimle dön.
   - `hand_off_to`: işin kalanını devret ve **turu bitir**, istenirse sonra devam et.
     Bizde lider bekleyerek bloke oluyor; devretme fiili 15 dakikalık `waitFor` sorununu
     da kökten çözer.
   - `run_worker`: **geçmişsiz, izole**, isimsiz alt iş. Ucuz Haiku sürüsü için doğru
     soyutlama (bkz. §7).
2. **CLI ajanlarını alt süreç olarak sürme** (Claude Code, Codex, OpenCode). Faz 4
   (ikinci sağlayıcı) için hazır desen: `backends/cliBackend.ts`, stdout akışını
   `BackendEvent`e normalleştirir. Takılan akış tespiti ve yerel ajanın sorusunu yanıtlama
   gibi tuzakları sürüm notlarında belgelenmiş.
3. **Grup sohbeti bus'ı** (`src/main/features/group_chat/bus.ts`). Ekran görüntüsündeki
   özelliğin referans uygulaması.
4. **To-do + Auto-advance.** Ekip kuyruktaki sıradaki işi kendisi alır, biteni incelemeye
   bırakır.
5. **Zamanlanmış otomasyonlar.** Saatlik, günlük ya da haftalık görev. Makine uyanınca
   kaçırılan son çalıştırmayı 12 saat içinde telafi eder.
6. **Library.** `sqlite-vec` ile yerel belge indeksi ve alıntılı cevaplar. Bizim bellek
   paneli düz `.md` + `[[link]]`, arama yok.
7. **Öz-iyileştirme.** Boşta çalışan gözden geçirme `COMPETENCE.md` ve öğrenilmiş
   skill'ler yazar. Bizim skill paneliyle doğal olarak birleşir.

### Alınmayacaklar

Hesap ve ücret katmanı, Electron, 16 genel amaçlı ajan, e-ticaret bağlayıcıları.

---

## 6. Ekran görüntüsü — ajanlarla grup sohbeti

### Görülen

`docs/Screenshot_…jpg`: solda piksel ofis, sağda **tek bir sohbet akışı**.

- Her ajan bir **kart**: ad + uzmanlık ("RACF / Mainframe Güvenlik Uzmanı"), **model
  rozeti** (Sonnet, Codex, Gemini), **kim devretti** ("Proje Yöneticisi Fable devretti"),
  durum (çalışıyor / bitti), görev özeti ve katlanmış **"Ayrıntılar (17 araç)"**.
- Altta "Ekip çalışıyor… 63 sn" sayacı.
- Composer: "Ekibe ne yaptırmak istiyorsun?" ve seçiciler: **Ekip: Mainframe Team ·
  Tüm ekip · Plan: otomatik · Soru sor**. `@` dosya, `/` komut.

### Bizdeki karşılığı

**Yok.** Transcript'ler `store.transcripts[agentId]` içinde ajan başına tutuluyor ve
yalnızca o ajanın terminal gözü okuyor (`App.tsx:297`). Ofis panelindeki baloncuklar
yalnız izin, bekleme ve ziyaret için çıkıyor, mesaj metnini göstermiyor
(`office/officeState.ts:229-245`).

**Ama gereken veri zaten panelde:**

- bütün ajanların transcript'leri (WS ile canlı geliyor),
- görevler ve `parentTaskId` delegasyon ağacı ("kim kime devretti"),
- izin istekleri, ajan başına model ve tur maliyeti.

Yani ilk sürüm **sunucuya hiç dokunmadan**, yalnız istemci tarafında yazılabilir.

### Öneri: "Ekip Sohbeti" paneli (`PanelId: 'chat'`)

1. **Akış:** Seçili takımın transcript'leri zamana göre birleştirilir. `user` ve
   `assistant` metni görünür, `tool_use` ve `tool_result` olayları kartın içinde
   "Ayrıntılar (N araç)" altında katlanır.
2. **Kartlar görev ağacına göre:** Bir delegasyon kartı "Boss → Tester'a devretti:
   <başlık>" der. Alt görevler girintili ya da bağlı gösterilir. Bitince kart
   `complete_task` sonucunu ve kanıt rozetini (Raporlar'daki `N dosya` / `dosya yok`)
   taşır. Bu, Orkas'ta da ekran görüntüsünde de olmayan bizim farkımız.
3. **İzin kartı:** Bekleyen izin isteği sohbette düğmeli bir kart olarak çıkar. Terminal
   bilmeyen kullanıcı için en kritik etkileşim budur.
4. **Composer:**
   - `@ajan` ile o ajana doğrudan yazılır.
   - Hedef yoksa mesaj **Orkestratör mantığıyla** takım liderine gider (mevcut
     `Orchestrator.tsx` brifi yeniden kullanılır).
   - Takım seçici mevcut `TeamTabs` kapsamını kullanır.
5. **Plan kipi:** "Plan: otomatik / onaylı". Onaylı kipte lider önce `propose_plan`
   (yeni MCP aracı) ile bir plan kartı üretir. Kullanıcı "Onayla / Düzenle" deyince
   `delegate_tasks` çalışır. Bu, çok ajanlı işin en pahalı hatasını (yanlış anlaşılmış
   işi 6 ajana dağıtmak) önler.
6. **"Soru sor" kipi:** Mesaj görev açmadan, yalnız cevap için gider (görev kuyruğunu
   kirletmez).

### Terminal bilmeyen kullanıcı için konumlandırma

- **Varsayılan görünüm: Sohbet + Görevler** (+ küçük bir ekip durumu, ofis ya da gök).
- **Terminal gözleri "uzman görünümü"** olarak kalır: slash komutları, `/context`,
  `/status` orada.
- Sohbet dar ekranda da okunur. Telefondan takip için doğru yüzey de budur (bkz. §8
  uzaktan erişim).

---

## 7. Video — JEV ve modeller arası yönlendirme

### Gösterilen mimari ("Sonnet builds, Haiku swarms")

```
Opus 5.5 · danışman (çağrıldığında)        Sonnet 5.5 · ana oturum (düzenler + test çalıştırır)
  tetikleyiciler:                                   │
   ◇ plan öncesi                             JEV · fork katmanı
   ◇ aynı hata ×2                              hangi dosya   0.64 split → Sonnet'e sor
   ◇ bitmeden önce                             hangi araç    0.81 sharp → kodda karar
  bütün oturumu okur, tavsiye verir,           tekrar / dur  0.98 sharp → kodda karar
  KOD YAZMAZ, rutin turda sessiz                    │
                                          Haiku 5.5 alt ajanlar: search · grep · audit (worktree)
                                                    │
                                          Sonnet'e geri dön · incele + doğrula
```

Komut satırı: `claude --model sonnet --advisor opus`.

### Dürüst değerlendirme

- **"JEV" ve "1.659 fork" bağımsız olarak doğrulanabilen bir ürün değil.** Video bir
  "ipucu" tanıtımı. Sayıların gerçek bir ölçümden mi geldiği belli değil, temkinli
  yaklaşılmalı.
- **Ama içindeki üç fikir sağlam ve bizde uygulanabilir:**
  1. Modeller **rol**e göre ayrılır, mesaja göre değil.
  2. Pahalı model **olayla** çağrılır, her turda değil.
  3. Mikro kararlar mümkünse **kodla** verilir, LLM yalnız emin olunmayan durumda
     devreye girer.

### Bizdeki mevcut durum (koddan)

Otomatik model seçimi **modelin kendi beyanına** dayanıyor:

- `ClaudeBackend.send()` **her** kullanıcı mesajının başına bir "[Hatırlatma: …]" ekliyor.
- Model zorluğu kendisi tartıp `mcp__self__set_model` çağırıyor. Tur bitince temel modele
  dönülüyor (`session.ts:421-429`).
- Zayıflıkları:
  - Her turda hatırlatma tokeni harcanıyor, model değişiminde bir araç çağrısı daha.
  - Model kendini değerlendirirken yanlı. Pratikte nadiren yükseltir ya da düşürür.
  - Karar ölçülmüyor: hangi seçimin işe yaradığı bilinmiyor.

### Öneriler (sağlayıcıdan bağımsız kalacak şekilde)

1. **Olay tetiklemeli danışman (en yüksek değer).**
   - `AgentSession` zaten normalleştirilmiş `BackendEvent` akışını görüyor. Buradan iki
     tetik saptanabilir: **aynı araç hatası iki kez** ve **`complete_task` çağrısı
     öncesi**.
   - Tetiklenince danışman modeli (Opus 5.5) transcript özetiyle **tek seferlik**
     çağrılır. Bunun için ayrı ve kısa bir SDK çağrısı yeterli, oturum gerekmez.
   - Tavsiye ajana bir sistem notu olarak iletilir. Danışman araç almaz, kod yazmaz.
   - Maliyet: yalnız sorun anında. Ajan konfigürasyonunda `advisor: 'opus' | off`
     alanı olur.
2. **Haiku sürüsü.**
   - Salt-okunur izinli `scout` worker rolü: yalnız Read, Grep, Glob, WebFetch.
   - Lider arama ve denetim işlerini `delegate_tasks` (ya da Orkas'taki `run_worker`
     benzeri, geçmişsiz bir fiil) ile bu ucuz modele yollar.
   - Yazma yetkisi olmadığı için izin ve çakışma riski de yok.
3. **Deterministik ön yönlendirici.**
   - Her mesaja hatırlatma eklemek yerine, mesaj gönderilmeden önce ucuz bir
     sınıflandırıcı modeli seçer. Kullanabileceği sinyaller: görev tipi (zincir adımı mı,
     arama mı, düzenleme mi), mesaj uzunluğu, anahtar sözcükler, ajanın son N turdaki
     hata oranı.
   - Güveni düşükse mevcut davranışa (modelin kendi kararı) düşer. Bu, videodaki
     sharp/split ayrımının bizdeki karşılığı.
   - **Ölç:** `usage-history.json` zaten tur tur model ve maliyet tutuyor. Yönlendirici
     kararı oraya bir alan olarak eklenir, Harcama panosunda "yönlendirici tasarrufu"
     gösterilir. Uydurma bir sayı değil, gerçek fark.
4. **Takma adları 5.5 ailesine güncelle** ve eşlemeyi tek tabloya indir (§3.4).
5. **Ekran görüntüsündeki model rozeti:** Sohbet kartında her ajanın o anki modeli
   görünsün (`session.model` zaten var). Kullanıcı yönlendirmenin ne yaptığını görür.

---

## 8. Diğer yeni fikirler

| Fikir | Neden | Bağlandığı mevcut parça |
|---|---|---|
| **Görev başına git worktree** + birleştirme/inceleme adımı | Paralel ajanlar aynı dosyayı ezmesin (§3.5). Raporlar paneli zaten "kanıt" gösteriyor; worktree farkı doğrudan kanıt olur. | `TaskQueue.dispatch`, `git.ts`, Değişiklikler paneli |
| **Plan onay kapısı** | Yanlış anlaşılmış işi 6 ajana dağıtmamak | `delegate_tasks` öncesi yeni `propose_plan` aracı |
| **Bildirimler** (masaüstü + telefon): izin bekliyor, görev bitti, bütçe %80 | Panel açık değilken akış duruyor (izin bekleyen ajan sonsuza dek bekler) | WS `permission_request`, `task_update` |
| **Uzaktan erişim** (token korumalı) | Telefondan sohbeti izlemek ve izin vermek | §3.1'deki token altyapısı + Sohbet paneli |
| **Zamanlanmış görevler** | "Her sabah bağımlılıkları denetle", "her gece test" | `TaskQueue` + bir zamanlayıcı |
| **Maliyet tahmini** (görev başlamadan) | Bütçe şu an yalnızca sonradan uyarıyor | `usage-history.json`'daki benzer görevlerin ortalaması |
| **Oturum yeniden oynatma** | "Ajan neden bunu yaptı?" sorusu için zaman çizelgesi | `SessionStore` transcript'leri |
| **İlk açılış sihirbazı + ekip şablonları** ("Web uygulaması ekibi", "Araştırma ekibi") | PRODUCT.md ilkesi 5: projeyi bilmeyen kullanıcı | `agents/` hazır tanımları, `AgentForm` |
| **GitHub PR entegrasyonu** | Görev biter, worktree dalından PR açılır, Raporlar'daki kanıt PR açıklamasına girer | Raporlar + worktree |
| **Görev şablonları / tekrar kullanılabilir zincirler** | Sık yapılan "araştır → uygula → test et → incele" akışı | `POST /tasks/chain`, Promptlar paneli |
| **Ajanlar arası doğrudan soru** (`ask_agent`) | Şu an yalnız yukarıdan aşağı delegasyon var; tester, geliştiriciye soru soramıyor | `team` MCP sunucusu |

---

## 9. Önerilen yol haritası

| Sıra | İş | Boyut | Not |
|---|---|---|---|
| 1 | **Güvenlik sertleştirmesi** (127.0.0.1, token, CORS kaldır, WS Origin) + **SDK sürümünü sabitle** + **model takma adları 5.5** | Küçük | Yayımlanmış paketteki en büyük risk. Önce bu. |
| 2 | **Vitest + GitHub Actions**. Ölçülmüş tuzaklar ilk testler olur. | Orta | Sonraki büyük işlerin güvencesi. |
| 3 | **Ekip Sohbeti paneli**, yalnız istemci tarafında | Orta | Terminal bilmeyen kullanıcıyı açan özellik. |
| 4 | **Plan onay kipi** (`propose_plan`) | Küçük-orta | Sohbetin üstüne oturur. |
| 5 | **Olay tetiklemeli Opus danışmanı** + **Haiku scout rolü** | Orta | Videodaki fikrin bizdeki hâli; yönlendirici ölçümüyle birlikte. |
| 6 | **Worktree izolasyonu** | Orta-büyük | Paralellik arttıkça zorunlu hâle gelir. |
| 7 | Temizlik: `brainless/` ölü kodu, `index.css` bölme, ortak tipler, `CLAUDE.md` inceltme, `lang` düzeltmesi | Küçük | Herhangi bir aralığa sıkıştırılabilir. |
| — | **Faz 4: CLI alt süreç backend'i** (Codex, Gemini, OpenCode; Orkas deseni) | Büyük | Kullanıcı bilerek erteledi, açmadan önce sorulmalı. Ekran görüntüsündeki "Codex / Gemini" kartları bunun ne kazandıracağını gösteriyor. |

---

## 10. İki ofis videosu (docs/, 2026-11-23 eklendi)

### (a) "I built an office for my AI agents": izometrik low-poly ofis

- **Sahne:** 8 takım odası ortadaki bir **"Beyin"in** etrafında dizilmiş. Beyin
  ortak hafızayı temsil ediyor ("1.842 not · ortak hafıza"). Odalar arasında
  ışıklı veri çizgileri var, karakterler yürüyor ve masada çalışıyor.
- **Arayüz katmanları:**
  - Üst çubuk: Office · Tasks · Calendar · Brain sekmeleri ve "31 ajan · 12 çalışıyor" sayacı.
  - Takım çekmecesi: bağlı MCP'ler (Drive, Canva, Slack…), **skill ilerleme
    çubukları** ("5 skill paralel çalışıyor" ve her birinin yüzdesi), ajan durumu.
  - Diğerleri: **sesli kip** (konuşarak iş verme), görev panosu, ajana tıklayınca sohbet.
- **Bizim verimizle eşleme:**

  | Videodaki | Bizdeki gerçek veri |
  |---|---|
  | Oda | Takım (`teams.ts`) |
  | Masa ve karakter | Ajan, yürüme/çalışma animasyonu ise durum |
  | Beyin | Hafıza paneli: `.claudiva/memory`, not sayısı gerçek |
  | Çizgi | `delegate_tasks` delegasyonu |
  | Skill çubukları | **Bizde yok.** Skill'in "ne kadar bittiği" ölçülmüyor; uydurma yüzde yazılmamalı (CLAUDE.md "Uydurma ölçek yazma"). |

- **Ders:** Bu videonun asıl gücü 3D değil. Asıl güç **her şeyin tek ekranda ve
  gerçek veriye bağlı** olması. Bizim gök plakası da aynı ilkeyle kurulu.

### (b) "My AI agents have a better office than me": gerçekçi, yürünebilir 3D ofis

- 10 odalı ofis: oyun odası, mutfak, toplantı odası. Karakterlerin başında isim
  etiketi ve durum var ("Olivia · idle"), karaktere tıklayınca sohbet açılıyor.
- Bir oyun motoru işi (büyük olasılıkla Unity veya Unreal, hazır asset paketleri).
- **Bizim için önerilmez.** Paket boyutu yüzlerce MB olur, geliştirme maliyeti
  yüksek ve ürünün değerine katkısı düşük.

---

## 11. Panel modları (YAPILDI: Paneller + Sohbet)

- **Seçim:** Ayarlar → **Arayüz**. Tercih tarayıcıda saklanır
  (`claudiva.uiMode`), panel yerleşimi ayrı tutulduğu için mod değiştirmek
  yerleşimi bozmaz (ölçüldü).
- **Sohbet modu:** solda sohbet listesi (takım grupları + ajanlarla doğrudan
  sohbet), ortada akış, sağda katlanır ekip çekmecesi.
  - **Mesaj türleri:**
    - Ajan turları balon olarak görünür, araçları "Ayrıntılar (N araç)" altında katlanır.
    - Devir kartları "X → Y: görev" biçiminde.
    - Teslim kartları sonucu ve durumu gösterir.
    - Satır içi izin kartları: Evet · Bu ajanda sorma · Hayır.
  - **Footer:** yazı alanı ve `@ajan` önerisi, Görev/Soru kipi, Plan:
    otomatik/onaylı, oto-onay ve Durdur çipleri, canlı durum satırı ("Ekip
    çalışıyor · 1 dk 03 sn · 3 ajan"), ipuçları ve bugünkü harcama.
  - Sunucuya yeni uç eklenmedi; bütün veri zaten paneldeydi.
- **Sonraki aday mod, "Akış":** ilk videodaki (Claude Code Subagents) gibi
  kutular ve animasyonlu veri çizgileri, altta oturum günlüğü. SVG ile çizilir,
  kütüphane gerekmez. Kutular ajan; çizgiler gerçek `delegate_tasks` ve sonuç
  dönüşleri; günlük `chatFeed`in düz hâli. Sohbet modu için yazılan
  `chatFeed.ts` bu mod için de veri kaynağı olur.
- **Dördüncü aday:** 3D Ofis (§12).

---

## 12. 3D ofis + Blender değerlendirmesi (sona bırakıldı)

**Sonuç:** Video (a)'daki izometrik low-poly ofis **yapılabilir ve mantıklı**.
Video (b)'deki gerçekçi ofis yapılmamalı.

### Önerilen teknik yol

- **Render:** React Three Fiber (three.js'in React katmanı) + `drei`.
  - Proje şu an hiçbir 3D kütüphanesi taşımıyor. CLAUDE.md kuralı gereği eklemeden önce kullanıcıya sorulacak.
  - three.js gzip ~150 KB olur; uygulamanın tamamı ~140 KB gzip. **Tembel yığın şart:** Ofis paneli açılmadan 0 bayt (Prism'deki desen).
- **Modeller:** Blender'da low-poly, **GLB** olarak dışa aktarım.
  - Karakter rigleri: Mixamo veya benzeri; idle / typing / walk / wave animasyonları.
  - Sıkıştırma: Draco ya da meshopt + KTX2 doku.
  - Varlıklar dosya ikonlarındaki gibi **sunucudan, `immutable` önbellekle** servis edilir; pakete girmez.
- **Önce sıfırdan modelleme YAPMA.** CC0 paketleri (Kenney "Furniture Kit",
  Quaternius karakterleri) ile başla, kimliği renk ve düzenle ver. Blender'da
  yalnız markaya özel parçaları (Beyin, oda tabelaları) modelle.
- **Blender'ı ajana sürdürmek:** Blender için MCP köprüleri var (ör. blender-mcp).
  Ajan sahneyi komutla kurabilir. Sürüm ve güvenliği kurulumdan önce doğrulanmalı;
  bu analizde denenmedi.
- **Kurulan skill'ler:** proje `.claude/skills` altında `threejs-react-three-fiber`,
  `threejs-loaders`, `threejs-animation` ve `threejs-performance` bu iş için hazır.

### Veri bağlama kuralı (gök plakasıyla aynı)

Hiçbir görsel öğe süs değil, hepsi gerçek veriye bağlı:

| Görsel | Veri |
|---|---|
| Oda | Takım |
| Masa | Ajan |
| Karakter animasyonu | Durum: çalışıyor → yazıyor, boşta → dolaşıyor, onay bekliyor → el kaldırıyor, kapalı → masada yok |
| Çizgi | Gerçek delegasyon |
| Beyin parlaklığı | Hafıza not sayısı |

### Kademeli plan

1. Mevcut 2D ofisi (pixel-agents portu) R3F izometrik sahneyle değiştir. Kutular ve basit karakterlerle başla.
2. CC0 mobilya ve karakterlere geç, durum animasyonlarını bağla.
3. Beyin ve delegasyon çizgileri ekle; ajana tıklayınca Sohbet modundaki DM açılsın.
4. Blender'da markaya özel parçalar.

---

## 13. Repo klasörünü `claude-manager` → `claudiva` yapmak

Kodda repo yoluna bağlı bir şey **yok**: yollar `INSTALL_ROOT` ve `PROJECT_DIR`'den
türetiliyor, git remote zaten `claudiva`. Yola bağlı **dış durum** ise var:

1. **Claude Code hafızası ve oturum geçmişi** yola göre anahtarlanıyor:
   `~/.claude/projects/D--SoftwareProject-claude-manager/`. Rename sonrası
   `D--SoftwareProject-claudiva/` adıyla **kopyala**, yoksa hafıza (MEMORY.md) kaybolur.
2. `~/.claude.json` proje girdisi: yeni yol bir kez yeniden güven ister.
3. **Ajan SDK oturumları cwd'ye bağlı:** kayıtlı resume kimlikleri tutmaz, her
   ajan ilk mesajda geri düşüşle yeni oturum açar.
   - Bu yol bu turda canlı sınandı ve **gerçek bir hata buldu:** geri düşüş mesajı dökümde
     İKİ KEZ gösteriyordu. Düzeltildi (`AgentSession.send(..., { replay: true })`).
4. **`npm install`:** workspace bağlantıları mutlak yol taşıyabilir.
5. **`graphify update .`**
6. `.claude/settings.local.json` içinde eski mutlak yolla yazılmış bir izin satırı var. Zararsız, temizlenebilir.
7. Skill kütüphanesi eskiden yolda "claudiva" geçen projeyi dışlıyordu. Artık
   yalnız `CLAUDIVA_AGENT=1` taşıyan ajan oturumlarını dışlıyor (§3 düzeltildi),
   yani rename sorun çıkarmaz.
8. Rename'i bu oturum ve sunucu **kapalıyken** yap; açık süreçler klasörü kilitler.

---

## Ek: Doğrulama notları

- Güvenlik bulguları: `server/src/index.ts:69` (`cors()`) ve `:129` (host'suz `listen`)
  satırları okundu. Rotalarda auth ara katmanı yok.
- Model takma adları: `claudeBackend.ts:25-28` okundu.
- SDK sürümü: `package.json:50` → `"latest"`.
- Test ve CI yokluğu: `*.test.*` / `*.spec.*` yok, `.github/` dizini yok.
- Orkas bilgileri 2026-11-23 itibarıyla GitHub sayfasından alındı. `package.json`
  okunamadı (503), bu yüzden Electron ve React sürümleri doğrulanmadı.
- Video: 36 sn, 720×900. Kareler ffmpeg ile çıkarılıp incelendi. Ses dökümü yapılmadı.
