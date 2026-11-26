# Devir — Claudiva

# ▶ aitmpl.com entegrasyonu (2026-11-26)

**1. adım (skill'ler → Keşfet) `8040ab9`, 2. adım (Yeni ajan → Şablon)
`5b69d80`, 3. adım (Promptlar → aitmpl’den ekle) YAPILDI, commit EDİLMEDİ.** Ayrıntı ve ölçümler:
**`docs/AITMPL-ENTEGRASYON.md`**. Kararlar (yeniden sorma): User-Agent
`claudiva/<sürüm> (+…/claudiva/issues)`, sıra 1 → 2 → 3 → 4. aitmpl.com
Türkiye'den engelli; GitHub kopyasına düşülüyor. Push edilmedi.

Kota iyileştirmesi (`githubTree.ts`, ayrıntı `server/CLAUDE.md`): kurulum
ve tekrar taramalar artık GitHub kotası harcamıyor. Kurulum dosya sınırı
40 → 150 (kullanıcı onayı). **skills.sh bağlandı** (Keşfet'te adla arama,
"taranmadı" rozeti + kurulum onayı; ayrıntı `docs/AITMPL-ENTEGRASYON.md`).
Sırada: 4. adım (MCP), kullanıcı onayı bekliyor.

Aynı gün ek (`3. adım` commit'inde): depo taramasında kopya ayıklama, Skill
paneli dar yuva düzeni (panel kayar, yapışkan arama, katlanır filtreler,
Kurulu sekmesinde yatay taşma düzeltildi), Keşfet'te "GitHub linkiyle bul"
(kaynak olarak kaydetmez; graphify bu yoldan bulunup kuruldu).
**Kullanıcı kararı:** ünlü depolar yerleşik kaynak YAPILMAYACAK (bakım +
ileride Rust uygulaması). **skills.sh incelendi, çalışıyor** (bulgular ve
önerilen bağlama `docs/AITMPL-ENTEGRASYON.md` sonu); bağlamak için kullanıcı
onayı bekleniyor. 4. adım (MCP) da bekliyor.


# ▶ 2026-11-25 akşamı: açık/koyu mod + Cam stili EKLENDİ (commit BEKLİYOR)

Kullanıcı kararları (yeniden sorma): ana stil **Cam** (açık = Vireon/Optivue,
koyu = Astrabit/Ventra); her stilin altında Açık/Koyu modu; Gözlemevi açık =
Vireon renkleri, Stüdyo koyu = eski Grafit, Fosfor açık = InsightOS renkleri.
Işık ve Atölye stilleri önizlendi, BEĞENİLMEDİ, eklenmedi. Önizleme:
https://claude.ai/artifact/WetjE1G2wkAiHFGKFeB3a8

Yapılan: 5 palet (`themes.css`), `appStyle.ts` stil × mod, `index.html` betiği,
`styles.css` Cam token'ları, `index.css` "CAM STİLİ" kabuk kuralları, Ayarlar'da
mod seçici, komut paleti, i18n, `contrast.mjs` (8 palet geçiyor), `npm run build`
geçiyor, 4621 demosunda dört stilin yeni modları gözle doğrulandı.

Ek (aynı gün): Cam'ın Genel Durum ekranı `GlassOverview.tsx` YAPILDI (kahraman
kart, Lidere sor, bütçe kadranı, ısı haritası, son devirler, delegasyon ağı);
4621 demosunda açık/koyu ve dar/geniş gözde bakıldı. "Lidere sor" gönderimi
canlı ajana karşı DENENMEDİ (ücretli). Ayarlar'daki Kaydet düğmesi i18n'e
bağlandı. **Commit yapılmadı (kullanıcı: şimdilik commit yok; `docs/*.jpg`
referans görselleri commit'e GİRMEYECEK).**

Pano'ya da eklendi: `heatmap`, `dial`, `network` widget'ları (galeri + varsayılan
dizilimde ağ ve ısı haritası). 4621 demosunda bakıldı.

Sonra (aynı gün): Cam açık SU YEŞİLİ (Gözlemevi açık turkuaz kalır), delegasyon
ağı Stüdyo/Fosfor Genel Durum'unda, Sohbet'e sağ panel (`ChatInspector.tsx`).
Hepsi 4621'de bakıldı. Hâlâ COMMIT YOK.

Commit edildi: `e107104` (stiller, Cam, sağ panel). Ardından skill adları
İngilizce (`e12df1f` + özet tablosu ve ilk-taşıma uyarısı düzeltmesi), panelde dile
göre çeviri; eski kurulumlar açılışta güvenle taşınır (bkz. server/CLAUDE.md).
PUSH EDİLMEDİ.

0.4.0 HAZIR (2026-11-25): README (EN+TR) ve DESIGN.md güncel, `chore: release 0.4.0`
+ açıklamalı `v0.4.0` etiketi (sürüm notu etiket mesajında). Denetim kullanıcı
isteğiyle atlandı. PUSH ve `npm publish` kullanıcıda.

**Eksik:** `docs/screenshots/chat.jpg` ve `board.jpg` hâlâ eski (Gözlemevi koyu);
Chrome ekran görüntüsü zaman aşımına düştü (pencere arka plandaydı). Cam açık,
sağ panel açık Sohbet ve yeni widget'lı Pano ile yeniden çekilmeli; sürüm
gerektirmez (README görselleri ana daldan okunur). Eski isteğe bağlı liste: Sohbet'e sağ panel (model/skill/MCP/dosyalar). README ve
ekran görüntüleri yeni varsayılan stile göre güncellenmeli.


# ▶ SIRADAKİ İŞ (2026-11-25 sonu, kullanıcı kararları — yeniden sorma)

Durum: 0.2.1 push edildi (npm'de 0.1.1, yayın kullanıcıda). Sonrasında
commit edilenler: Stüdyo Genel Durum (`StudioOverview.tsx`), açık palette
terminal koyu kart (`b298ee9`, push EDİLMEDİ). 4600 (kullanıcının sunucusu)
ve 4621 (demo `%TEMP%/claude/cm-demo`) açık kalmış olabilir: porta göre kapat.

**1. ✅ YAPILDI (2026-11-25): Paletler kalktı, yalnız STİL kaldı.** Kullanıcı: "Obsidyen, Karbon,
Aurora birbirinin aynı; bunlar yalnız renk değiştiren tema, gereksiz."
- Kalan: **Gözlemevi, Stüdyo, Fosfor** — her stil TEK sabit görünüm.
- Silinecek paletler: `night`, `day`, `carbon`, `aurora`, `graphite` (Stüdyo'nun
  koyu sürümü), ve palet seçimi. Her stil kendi tek paletiyle: Gözlemevi →
  `obsidian`, Stüdyo → `paper`, Fosfor → `phosphor`.
- Dokunulacak yerler: `themes.ts` (THEMES, DEFAULT_THEME), `themes.css`
  (blokları sil; `obsidian` bloğu premium ortak blokla birlikte), `appStyle.ts`
  (`STYLE_GROUPS`, `STYLE_DEFAULT_THEME`, `syncPalette` → stil seçilince palet
  ZORLA o stilinki), `index.html` satır içi betik (`own`/`dflt`, kayıtlı eski
  palet → stilin paleti), `contrast.mjs` `plates` dizisi, i18n `themes.*`,
  `ThemePicker` (palet ızgarası gider), komut paletindeki tema komutları
  (`themeCommands`), README/DESIGN.md/web CLAUDE.md'deki palet anlatımları.
- Açık palette terminal kartı (`--terminal-*`) artık yalnız `paper`da gerekir.
- **Kural (kalıcı):** kullanıcı "yeni tema ekle" derse yeni STİL eklenir
  (`styles.css` bloğu + kendi paleti), palet değil.

**2. ✅ YAPILDI: Tema/stil seçimi Ayarlar'a taşındı.** Başlıktaki Görünüm düğmesi ve
`ThemePicker` modalı kalkar; seçim Ayarlar → Arayüz bölümüne (mod ve dil
seçiminin yanına) stil kartları olarak girer. Terminal tipi (CLI skin)
seçimi de oraya. Komut paletindeki "Görünüm" komutu Ayarlar'ı o bölümde açsın.

**3. ✅ YAPILDI (ölçüldü: dört bölümde 720px): Ayarlar modalının boyu sabit.** Şu an soldaki menüden bölüm
seçince modalın yüksekliği içeriğe göre büyüyüp küçülüyor. İstenen: modal
sabit yükseklik (ör. `height: min(720px, 86vh)`), sağ içerik alanı kendi
içinde kaydırılır (`overflow-y: auto`, `min-height: 0`). `Settings.tsx` ve
`.modal`/ayarlar CSS'i. Ölç: bölümler arasında geçerken modal yüksekliği
değişmemeli.

**4. Sonra:** kullanıcı yeni stiller tarif edecek; her biri yeni stil olarak.

Doğrulama: `npm run build`, `node web/scripts/contrast.mjs`, 4621 demo
verisiyle üç stilde Paneller/Sohbet/Pano/Genel Durum bakışı, eski kayıtlı
palet (`claudiva.theme = 'carbon'` vb.) açılışta stilin paletine düşmeli.

# 2026-11-25: çeviriler BİTTİ, yayın sende

- [x] **Yerel komut çıktıları** (`localCommands.ts` → `L.cmdOut`) ve **sunucu
  hataları** (`routes.ts` `ApiError` kodu → `L.apiErrors`) çevrildi. Kurallar
  `web/CLAUDE.md` → "Arayüz dili". Ölçüldü: `/status`, `/doctor`, `/help` iki
  dilde canlı sunucuya karşı doğru; `agent_not_found` EN'de "Agent not found.".
- [x] Yayın öncesi kontrol: `npm run build` ✓, `contrast.mjs` 0 ✓,
  `npm pack --dry-run` 1.1 MB / 200 dosya ✓, boş dizine kurulum testi
  (`/`, `/api/budget`, `/api/agents` 200) ✓, `agents/` kişisel içerik yok ✓.
- [x] Küçük işler: sohbet teslim kartında kanıt rozeti (`/api/tasks/evidence`),
  paket bölme (579 → 340 KB, uyarı yok), sohbet modu `impeccable audit` + P1
  erişilebilirlik düzeltmeleri, Kırmızı Fener paleti kaldırıldı.
- [x] Ajan adları/açıklamaları dile göre (`config.json` `i18n`, `web/src/agentI18n.ts`).
- [x] **"Plan: onaylı" canlı sınandı** (scratch proje, 4620, $1.33): 1. tur lider
  planı tablo olarak yazdı, `delegate_tasks` ÇAĞIRMADI, görev/dosya yok; "Onaylıyorum"
  sonrası tek `delegate_tasks` → docs iki dosyayı yazdı, lider özetledi. Not: oto-onay
  kapalı ajanda alt ajan izin bekler, lider o sürede `delegate_tasks` içinde bloklu kalır.
- [x] **README iki dilli:** `README.md` İngilizce (varsayılan; GitHub ve npm bunu
  gösterir), `README.tr.md` Türkçe, ikisinin başında dil bağlantısı. npm bütün `README*`
  dosyalarını `files`tan bağımsız pakete koyar (ölçüldü: ikisi de giriyor, 18 KB). Ekran görüntüleri `docs/screenshots/` (panels, chat, board,
  studio, phosphor): scratch demo (`my-app`, haiku, ~$0.27), İngilizce arayüz. README
  değişince İKİ dosyayı birlikte güncelle.
- [x] Arayüzde sabit kalmış ~35 Türkçe metin `L.extra`ya taşındı (tarama betiği:
  JSX metin düğümleri + title/aria-label/placeholder).
- [x] **Sunucu tarafı i18n YAPILDI** (`server/src/i18n.ts`, kurallar `server/CLAUDE.md` → "Sunucunun dili"). Eski not: `server/src` ~208 Türkçe dizge.
  Ajana gidenler (görev kuyruğu çerçevesi `# Görev (id:` …, `complete_task` talimatı)
  İngilizce kullanıcıda alt ajanları TÜRKÇE cevaba itiyor (demo çekiminde ölçüldü);
  dökümdeki sistem notları ("Oturum sürdürülüyor") da Türkçe. Önek sabitleri eski
  dökümleri tanımak için korunmalı (`TASK_PREFIX`).
- [ ] **Kullanıcı yapacak:** `npm login` → `npm whoami` → `npm publish`
  (etkileşimli, ajan kabuğunda asılı kalır; bu oturumda `npm whoami` E401 verdi).
- [ ] Sonra repo klasörünü `claudiva` yap (aşağıdaki liste).
- Bilinen: ajan `config.json` adları (ör. "Proje Yöneticisi") bilerek Türkçe,
  EN arayüzde de Türkçe görünür.

# (önceki) SONRAKİ OTURUM (2026-11-24 sonu)

Her şey commit edildi ve **push edildi** (`88d9ea9`, origin/main ile eşit).
Kullanıcı tokeni bittiği için durdu; kaldığı yer:

**Sıradaki iş (kullanıcıya önerildi, onay bekliyor):**
1. **Kalan çeviriler** — `web/src/localCommands.ts` komut ÇIKTILARI (~100 satır),
   `server/src/api/routes.ts` hata metinleri (~21 dizge). npm yayınından önce şart.
2. **npm yayını 0.2.0** (`npm publish` EN SONA, kullanıcı kararı) → ardından repo
   klasörünü `claudiva` yapma (kontrol listesi aşağıda).

**Bu turda biten (hepsi commit + push):**
- Ajan dosyaları İngilizce + eski kurulumları güncelleme (aşağıda ayrıntı).
- **Stil katmanı:** Gözlemevi · **Stüdyo** (referans `docs/Screenshot_…jpg`,
  beyaz kart, mor) · **Fosfor** (referans "Drop Cloude" videosu, limon, Genel
  Durum ürün sayfası düzeniyle `PhosphorHero.tsx`). Stil + palet TEK yerden:
  Görünüm menüsü. Kurallar `web/CLAUDE.md` → "Stil katmanı".
- **Pano modu** (3. arayüz modu): 14 widget, galeri, işaretçiyle sürükleme,
  köşeden boyutlandırma, 12 sütun × sabit satır. `web/CLAUDE.md` → "Pano modu".
- **JEV model yönlendiricisi** `server/src/router/`, **VARSAYILAN KAPALI**
  (Ayarlar → Bütçe; kullanıcı kararı: tasarruf garanti değil). Ölçümler
  `docs/SONRAKI-ISLER.md` §2, kurallar `server/CLAUDE.md`.
- **Terminal dökümü varsayılan SADE** (araç adımları katlı, okunur etiket;
  "ayrıntılar" kutusu ham görünüm). `web/CLAUDE.md` → "Terminal dökümü".
- Kullanıcının kurulumunda Boss + Teknik Lider kişilikleri güncellendi;
  eskileri `~/.claudiva/agents/<id>/personality.md.yedek-2026-11-24`.

**Bekleyen/ertelenen (açmadan önce sor):** Atölye ve Sade stilleri · JEV'in
evet/hayır kararları ve sınıflandırıcı gecikmesi · Tauri · 3D ofis · Faz 4.

**Bilinen ufak notlar:** `git push` izin sınıflandırıcısına takılabiliyor —
kullanıcı açıkça isteyince geçti. Git Bash `curl` Türkçe karakteri UTF-8
göndermiyor; API testlerinde Node `fetch` kullan.

## 2026-11-24 turu — ayrıntılar

- [x] **Ajan dosyaları İngilizce:** 8 personality, bütün SKILL.md'ler,
  plugin.json açıklamaları. Skill DİZİN adları ve `name:` Türkçe kaldı (kimlik:
  `/durum-ozeti`, `.seeded-skills` manifesti). `config.json` (ad/açıklama,
  arayüzde görünür) Türkçe kaldı. Her personality'de "kullanıcının dilinde
  cevap ver" satırı var.
  - Mevcut kurulumlar: `agentUpgrade.ts` artık içerik de günceller. Diskteki
    dosya eski paket sürümünün (v0.1.1 veya çeviri öncesi HEAD) BİREBİR
    kopyasıysa yenisiyle değişir, elle düzenlenmişse dokunulmaz
    (`server/src/agentLegacyContent.ts`, hash tablosu). Scratch kopyada ölçüldü.
  - Gerçek `~/.claudiva/agents` sunucu ilk açıldığında İngilizceye geçecek.
  - Ölçülmedi: çeviriden sonra yeni oturum açılış tokeni (önceki 35.0k).
- [x] **Stil katmanı + Stüdyo** (`docs/SONRAKI-ISLER.md` §1 adım 1-2):
  `web/src/styles.css`, `appStyle.ts`, Stüdyo paletleri `paper`/`graphite`
  (`themes.css`), Ayarlar → Arayüz → Stil. Kurallar `web/CLAUDE.md` →
  "Stil katmanı". 4611 portunda scratch veriyle canlı doğrulandı (Gözlemevi
  değişmedi; Stüdyo açık/koyu, panel ve sohbet modu; stil↔palet eşleşmesi;
  kontrast betiği temiz).
  - Kalan: Atölye ve Sade stilleri; Genel Durum gök haritasının Stüdyo karşılığı.

# Tamamlanan iş (2026-11-23): Sohbet modu + .claudiva + roller + skill'ler + i18n

**Önce oku:** `docs/ANALIZ.md`. Proje analizi, eksikler, Orkas değerlendirmesi,
videolar ve yol haritası orada. Bu bölüm yalnızca yürüyen işin durumunu tutar.

## Kullanıcının bu turdaki kararları (yeniden sorma)

| Konu | Karar |
|---|---|
| Panel modları | **2 mod:** mevcut çok panelli sistem (korunur) + **Sohbet** (grup sohbeti). Ayarlar → "Arayüz" bölümünden seçilir. |
| Sohbet görünümü | WhatsApp *gibi* (grup sohbeti) ama WhatsApp *teması* DEĞİL; tema token'larıyla çizilir. Referans: `docs/Screenshot_…jpg`. Ajanlar kendi aralarında konuşur (delegasyon + sonuç), kullanıcı `@ajan` ile araya girer. **Footer'a özen**: çip satırı + durum satırı + ipucu satırı. |
| Skill dışlaması | Kütüphane `claudiva` geçen yolu dışlıyordu; **daraltılacak**: yalnız `CLAUDIVA_AGENT=1` ortam değişkeni taşıyan ajan oturumları dışlanır. |
| Kütüphane skill'leri | Proje `.claude/skills` altına junction ile (`skill-baglan.ps1 -Profil claudiva`). Pakete girmez. |
| find-skills | Yalnız **boss** ve **tech-lead** rollerine (`agents/<rol>/skills/find-skills`), pakete girer. |
| 3D ofis | **Sona bırakıldı.** Değerlendirmesi ANALIZ.md'de. three.js eklemeden önce kullanıcıya sor. |
| Repo klasörü | Kullanıcı EN SON `claude-manager` → `claudiva` yapacak. Kontrol listesi aşağıda. |
| Commit | Yalnız istenirse ve `Co-Authored-By` satırı OLMADAN. |

## İlerleme (2026-11-23 sonu: §1-§5 BİTTİ, commit EDİLMEDİ)

- [x] **§1 `.claude-manager` → `.claudiva`.** Yapılanlar:
  - `paths.ts` `migrateLegacyDir()`: yeni yoksa ve eski varsa eski yeniden adlandırılır; kilitliyse eski adla devam edilir; ikisi birden varsa yeni kazanır.
  - Ortam değişkenleri `CLAUDIVA_HOME` / `CLAUDIVA_PROJECT` (eskileri yedek olarak okunur).
  - localStorage `claudiva.*` (eski anahtarlar `web/index.html` satır içi betiğinde, bundle'dan ÖNCE taşınır).
  - `lang="tr"`. `.gitignore`, `.gitattributes` (bayat `bin/claude-manager.js` referansı), README, PRODUCT, YAYIN, CLAUDE.md güncellendi.
  - **Ölçüldü** (scratchpad kopyalarıyla; gerçek `~/.claude-manager`'a DOKUNULMADI): ev ve proje taşındı; iki klasör birden varken yeni kullanıldı.
  - **DİKKAT:** gerçek `~/.claude-manager` ve bu reponun `.claude-manager`'ı sunucu ilk açıldığında taşınacak. Bu bilerek böyle; kullanıcıya söylendi.
- [x] **§2 Roller.**
  - Türkçe unvanlar (`agents/*/config.json` ve `personality.md` başlıkları) ve tek kalıpta açıklamalar. `AgentForm` rol açıklamaları netleşti, `Terminal` içindeki yinelenen `ROLE_LABEL` silindi.
  - `server/src/agentUpgrade.ts`: var olan kurulumlarda ad ve açıklama yalnız 0.1.x değerine BİREBİR eşitse yenilenir; yeni paket skill'leri `.seeded-skills` manifestiyle eklenir, silinen skill geri gelmez.
  - **Ölçüldü:** eski ad güncellendi, elle değiştirilmiş ad korundu, silinmiş find-skills ve test-yaz geri gelmedi.
  - `find-skills` (MIT, LICENSE ile) → `agents/boss` ve `agents/tech-lead`. İkisinin personality'sine "kurmadan önce kullanıcıya sor" satırı eklendi.
- [x] **§3 Skill kütüphanesi.**
  - `claudeBackend.ts` SDK `env`ine `CLAUDIVA_AGENT=1` eklendi (`process.env`in tamamı taşınıyor; `env` verilince SDK ortamı devralmıyor).
  - Kütüphanede dışlama yalnız bu değişkene bakıyor (3 yer).
  - Profil `D:\Claude\skills-library\_sistem\profiller\claudiva.txt`; 11 skill `.claude/skills` altına junction olarak bağlandı. `.skills-profile` dosyası `.git/info/exclude` içinde.
  - **Doğrulanmadı:** hook'un ajan-DEĞİL yolu test dizinlerinde iki durumda da boş çıktı verdi, yani yalnız "ajan oturumunda sessiz" yarısı kanıtlı.
- [x] **§4 Sohbet modu.** Dosyalar:
  - Yeni: `web/src/uiMode.ts`, `brief.ts`, `permissions.ts`, `agentSend.ts`, `chatFeed.ts`
  - Yeni: `components/chat/ChatShell.tsx`, `ChatMessage.tsx`, `ChatComposer.tsx`, `chatFormat.ts`
  - Değişen: Ayarlar → **Arayüz** bölümü; `App.tsx` mod dallanması ve komut paletinde "Sohbet/Panel moduna geç".
  - **Canlı doğrulandı** (4610, kopya veri):
    - Ayarlardan mod değişti ve yenilemede kaldı.
    - Geçmiş veri doğru çizildi: devir kartları, teslim kartları, katlanan araçlar, gün ayıracı.
    - `@ara` önerisi gerçek gönderimle sınandı: cevap geldi, "yazıyor" göstergesi çıktı, durum satırı süre saydı.
    - DM yolu ve okunmamış sayacı tabanı çalıştı.
    - `@container` 900/600px kırılmaları doğrulandı, yatay taşma yok.
    - Panellere dönüşte yerleşim kaydı birebir aynı kaldı.
  - **Bu sırada bulunan ve düzeltilen 4 hata:**
    1. Önizleme sınıfı `.chat`, sohbet ızgarasını miras aldı (`.center` tuzağının aynısı) → `mp-chat`.
    2. `@container` öğenin kendisini ölçemez → `.chat-wrap` sarmalayıcısı.
    3. İki efekt eski `seen`i okuyup birbirini eziyordu → işlevsel `markSeen`.
    4. **Eski sunucu hatası:** resume geri düşüşü mesajı dökümde İKİ KEZ yazıyordu → `send(..., { replay: true })`.
- [x] **§5** ANALIZ.md §10-13: ofis videoları, panel modları, 3D/Blender, repo rename.

- [x] **Yanıtlama (WhatsApp tarzı alıntı)**, 2. tur. Dosyalar: `web/src/reply.ts`, `ChatMessage` (↩ düğmesi + `Quote`), `ChatComposer` (yanıt şeridi, Esc iptal), `ChatShell` (`reply`/`jump`).
  - **Canlı doğrulandı:** yanıt gönderildi, ajan bağlamı anladı; alıntıya tıklayınca mesaja kaydırdı ve vurguladı.
  - Bulunan hata: tıklanamaz alıntı `disabled` düğme olarak soluk çiziliyordu → `div`.
- **Ölçüm, "Teknik Lider çok token yiyor":** Teknik Lider'e özgü bir durum yok.
  - Her YENİ oturum sabit bağlamı önbelleğe YAZAR. Ölçüm: "5+5" turu = girdi 2, çıktı 3, **önbellek yazımı 37.043 token = $0.22**.
  - Bu repoda bağlam dökümü 52.7k token. En büyük kalem proje `CLAUDE.md`, ajan başına **20.2k token** (hafıza dosyası). Geri kalanı CLI sistem istemi (11.2k) ve sistem araçları (13.6k).
  - Sonnet, haiku'nun ~3-5 katı fiyatlı.
  - Aynı oturumdaki sonraki turlar önbellekten OKUR (≈1/10 fiyat).
  - Öneri (kullanıcı kararı bekliyor): `CLAUDE.md`yi geliştirici notları (`docs/DEV-NOTES.md`) + kısa dizin diye böl.
- **DİKKAT:** inceleme için açılan bir sunucu bu reponun `.claude-manager` klasörünü `.claudiva`ya TAŞIDI (beklenen davranış, veri eksiksiz). Gerçek `~/.claude-manager` HÂLÂ taşınmadı.
- `docs/*.mp4` `.gitignore`'a eklendi (~18 MB ikili dosya git geçmişine girmesin).

- [x] **Token: CLAUDE.md bölündü** (kök 5.4 KB + `server/CLAUDE.md` + `web/CLAUDE.md`). Ölçüldü: ajan bağlamı yeni oturum başına 52.7k → **35.0k** (hafıza dosyaları 20.9k → 3.4k).
- [x] Sohbet gönder düğmesi tek satırda tam ortada (ölçüldü: 778.2 = 778.2), çok satırda altta.
- [x] **GitHub:** 6 commit `claudiva-sohbet` dalında, push edildi. `main`e birleştirme kullanıcı kararı. **npm publish EN SONA** (kullanıcı isteği); commit/push npm'i etkilemez.
- Rakip ürün ekran görüntüsü (`docs/Screenshot_…jpg`) bilerek commit edilmedi.

## Çok dil (i18n) — ARAYÜZ BİTTİ, ajan tarafı bekliyor

- [x] Altyapı + TR + EN: `web/src/i18n/` (kurallar `web/CLAUDE.md` → "Arayüz dili").
  Ayarlar → Arayüz'de dil seçici, komut paletinde "Dili değiştir".
  Bütün paneller, sohbet modu, terminal kabuğu, modallar çevrildi; canlı
  doğrulandı (EN'de sohbet ve panel modu). Eksik çeviri derlemeyi kırıyor (ölçüldü).
- [ ] **Kalan arayüz metni:** `web/src/localCommands.ts` içindeki `/status`,
  `/doctor`, `/usage`, `/context`… ÇIKTI metinleri (~100 satır; komut
  açıklamaları ve etiketler çevrildi). Sunucudan gelen hata metinleri
  (`server/src/api/routes.ts`, ~21 dizge) de Türkçe.
- [ ] **Ajan tarafı:** kullanıcı skill'lerin İngilizceye çevrilmesini istedi
  (token tasarrufu gerekçesiyle) ama tokeni az kaldığı için ERTELEDİ — "iş bitince
  bana tekrar sor". 54 skill + 8 personality, ~54 KB. Açmadan önce sor.

## (eski) Çok dil önerisi

- **İki ayrı dil var, karıştırma:**
  - (1) **arayüz dili**: düğmeler, etiketler, paneldeki metinler;
  - (2) **ajan dili**: `personality.md`, skill'ler, `brief.ts`, görev kuyruğunun ajana yazdığı metin, otomatik model hatırlatması.
  - İkisi bağımsız seçilebilmeli: İngilizce arayüzle Türkçe çalışan ekip mümkün olmalı.
- **Arayüz:** kütüphane yok. `web/src/i18n/tr.ts` kaynak sözlük; `en.ts` aynı anahtarları `typeof tr` ile TİPLİ taşır (eksik anahtar derlemede yakalanır). `useLocale()` mevcut `uiMode.ts` deseniyle kurulur, `t('chat.send')` biçiminde kullanılır.
- **Sunucu:** hata metinleri kod döndürür, metni arayüz çevirir.
- **Ajan:** `agents/<id>/personality.<dil>.md` ve skill'in `SKILL.<dil>.md` sürümü; dil ajan ayarında tutulur.
- **Kapsam (ölçüldü, alt sınır):**
  - Arayüzde Türkçe karakter taşıyan en az 227 dizge (32 dosya; gerçek sayı muhtemelen 2-3 katı).
  - Sunucuda 21 dizge.
  - Ajan tarafında 8 personality + 54 skill, yaklaşık 54 KB metin.
  - Toplam: kademeli 3-4 iş oturumu.

## Sıradaki adımlar (öneri sırası)

1. Kullanıcı isterse **commit** (Co-Authored-By satırı YOK).
2. `impeccable audit` → sohbet modu (yapılmadı; build, kontrast ve lint temiz).
3. Sohbet kartında Raporlar'daki **kanıt rozeti** (N dosya / dosya yok) henüz yok. `/api/reports` kök görevleri döndürüyor; alt görev için `Touch` sayımı gerekecek.
4. **Plan: onaylı** kipi yalnız prompt ile çalışıyor (yeni araç yok). Liderin gerçekten beklediği canlı ekip işiyle sınanmadı.
5. Üçüncü mod "Akış" (SVG, `chatFeed` veri kaynağı) → ANALIZ §11.
6. 3D ofis → ANALIZ §12 (three.js eklemeden önce SOR).
7. Repo klasörü rename → aşağıdaki liste.

## Repo klasörünü `claudiva` yapmadan önce

Kodda repo yoluna bağlı bir şey yok. Yola bağlı **dış durum** ise var:

1. `~/.claude/projects/D--SoftwareProject-claude-manager/` (hafıza ve oturum geçmişi) → yeni `D--SoftwareProject-claudiva/` klasörüne KOPYALA.
2. `~/.claude.json` proje girdisi: yeni yol bir kez yeniden güven ister.
3. Ajan SDK oturumları cwd'ye bağlı → resume tutmaz. Geri düşüşle yeni oturum açılır, dökümler korunur.
4. `npm install`, çünkü workspace bağlantıları mutlak yol taşıyabilir.
5. `graphify update .`
6. `.claude/settings.local.json`'da eski mutlak yolla yazılmış bir izin satırı var (zararsız).
7. Bu oturum ve sunucu KAPALIYKEN yeniden adlandır (açık süreçler klasörü kilitler).

---

# Önceki iş: panel revizyonu (4 fazlı) — BİTTİ

**Son güncelleme:** 2026-08-15 · **Durum:** Faz 1, 2 ve 3 BİTTİ, üstüne iki ek
iş yapıldı (sözdizimi renklendirme + skill katalogu). **Faz 4 (ikinci
sağlayıcı) sırada — ama kullanıcı onu bilerek ertelemişti; açmadan önce sor.**
(Not: aşağıdaki "commit edilmedi" notları eski; o işler 0.1.1 ile yayımlandı.)

## Ek iş (Faz 3 sonrası, kullanıcı isteği) — BİTTİ ✅

### 0) Browser paneli WS ile tazeleniyor (yoklama kalktı)
`BrowserSession.onChange` → `hub.broadcast({type:'browser_state'})` →
`useStore.browserState` → `<Browser pushed=…>`. "Takip" kutusu ve 2sn'lik
`setInterval` KALDIRILDI: yoklama yanlış taraftaydı — ajan sürerken panel
hiçbir istek atmıyor, dolayısıyla panelin varlık sebebi olan durum (ajan bir
sayfa açtı) tam da varsayılan hâlde görünmez kalıyordu.

Yayını yapan `changed()`; `state()` ve `screenshot()` yayın YAPMAZ (panelin
kendi okuması kendine yankı olarak dönerdi). `close()` da yayınlar — `state()`
çökmüş sayfayı görünce oraya düştüğü için panel kapanışı bu yolla da öğrenir.
HTTP yanıtı panelde hâlâ uygulanıyor: aynı durumun iki kez uygulanması zararsız
ve WS kopukken panel çalışır kalıyor.

Doğrulandı: WS istemcisi hiç yoklamadan `navigate` ve `close` için birer
`browser_state` karesi aldı; canlı panelde (panele DOKUNMADAN, dışarıdan curl
ile sürülerek) adres/başlık/görüntü kendiliğinden geldi, `close` ile
kendiliğinden "Tarayıcı kapalı"ya döndü.

**Bilinen sınır:** sayfa kendi kendine değişirse (gecikmeli yönlendirme, canlı
içerik) yeni kare gelmez — kare, durumu DEĞİŞTİREN eyleme bağlı. Eski "takip"
kutusu bunu yakalardı; geri istenirse yoklama değil, sayfa olaylarına
(`framenavigated`) bağlı bir yayın doğru yol olur.

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
