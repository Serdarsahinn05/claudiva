# Sonraki işler: stil temaları ve JEV yönlendiricisi

**Kayıt tarihi:** 2026-11-23. Bu belge kullanıcıyla yapılan beyin fırtınasının
sonucudur. Kullanıcı bir sonraki oturumda buradan başlayacak. Önce "Karar
bekleyen" bölümünü sor, sonra seçilen işe geç.

## Karar bekleyen (oturum başında sor)

1. ~~Hangisiyle başlanacak~~ → 2026-11-24: §1 adım 1-2 (token + Stüdyo) BİTTİ.
   Sırada: Atölye / Sade stilleri, gök haritasının Stüdyo karşılığı ya da JEV (§2).
2. ~~Skill'lerin İngilizceye çevrilmesi~~ → 2026-11-24 BİTTİ (bkz. HANDOFF.md).
3. Panel paketi 500 KB uyarısı veriyor (521 KB, gzip 158 KB). Bölünsün mü?

---

## 1. Stil temaları: renk değil, tasarım dili

### Sorun

Bugünkü 6 tema yalnızca **renk** değiştiriyor. Yazı tipi (italik Bodoni
başlıklar), keskin köşeler, tane dokusu ve "gök plakası" dünyası her temada
aynı kalıyor. Açık "Gündüz" teması bile uzay gibi hissettiriyor. Kullanıcı
"herkese hitap etmiyor" dedi. İstenen: SaaS gibi, startup gibi ve sohbet gibi
hissettiren ayrı tasarım dilleri. Referans: `docs/` altındaki videolar ve
ekran görüntüsü.

### Model: iki eksen

- **Stil (biçim):** yazı tipleri, başlık biçimi, köşe yuvarlaklığı, gölge,
  boşluk/yoğunluk, doku, süsleme.
- **Renk:** palet, her stilin açık ve koyu sürümüyle.
- Seçim yine Ayarlar → Arayüz'den. Stil `data-style`, renk mevcut
  `data-theme` üzerinden; ikisi ayrı tutulur.

### Önerilen stiller

| Stil | His | Biçim |
|---|---|---|
| **Gözlemevi** (bugünkü) | uzay, gravür | Bodoni italik, keskin köşe, tane dokusu |
| **Stüdyo** | gerçek bir SaaS (Linear, Vercel gibi) | açık zemin, sade sans-serif, 8px köşe, yumuşak gölge, doku yok |
| **Atölye** | startup, sıcak | krem zemin, 14px yuvarlak köşe, hap düğmeler, canlı tek vurgu |
| **Sade** | hiç bilmeyen kullanıcı | büyük yazı, geniş boşluk, az panel; Sohbet moduyla varsayılan olabilir |

### Uygulama sırası

1. **Biçimi token'a çevir** (bir oturum). `index.css` içinde sabit yazılmış
   şunlar var: başlıklarda `font-family: var(--font-display); font-style: italic`
   (`.plate-title`, `.chat-head h2`, `.mode-card-label`…), doku, gök süslemeleri.
   Bunlar `--title-font`, `--title-style`, `--title-weight`, `--density`,
   `--shadow-*`, `--texture` gibi token'lara bağlanır.
   - **Zaten token olanlar:** renk, `--radius`, `--border-w`, `--font-*`, `--glow-a`.
2. **Stüdyo**: ilk yeni stil, "herkese hitap" isteğini en çok o karşılar.
3. **Atölye** ve **Sade**: 1. adım bittikten sonra ucuz.

### Dikkat

- **Pahalı kısım "Genel Durum" ekranı.** `Survey.tsx` ve `Sky.tsx` (gökyüzü
  haritası) uzaya özgü. Stüdyo stilinde aynı veri durum kartları ya da bir
  akış olarak görünmeli. Bileşen tarafında asıl iş burada.
- **Fontlar paketten gelir** (çevrimdışı kuralı, bkz. `web/CLAUDE.md`). Her
  stilin fontu yalnız o stil seçilince yüklenmeli (dinamik CSS import). Yoksa
  paket şişer.
- **Kontrast her palette ölçülür:** `node web/scripts/contrast.mjs`. Yeni plaka
  için betikteki `plates` dizisine bir satır eklenir.
- **Varsayılan tema iki yerde** (`web/index.html` satır içi betik +
  `themes.ts` `DEFAULT_THEME`). Stil için de aynı tuzak olur; ikisini birlikte
  değiştir.
- **Tasarım otoritesi:** `PRODUCT.md` görsel kimliğin bağlayıcı olmadığını
  söylüyor. Yeni stiller için `web/DESIGN.md` güncellenmeli (stil başına bölüm).
- **Kullanılabilecek skill'ler:** impeccable (tasarım ve denetim),
  ui-ux-pro-max (palet ve font önerisi; `DESIGN.md`'yi ezmez). İkisi de
  `.claude/skills` altında bağlı.

---

## 2. JEV: ucuz karar katmanı ve model yönlendirici

### Ne olduğu (kullanıcının açıklaması)

Basit işler için koca LLM'i çağırmamak. Küçük bir model ya da kural, evet/hayır,
0/1 veya küçük/büyük gibi tek kelimelik kararlar verir. İşleri hızlandırır ve
token tasarrufu sağlar. Yani bir **token yönlendiricisi**: büyük iş büyük
modele, küçük iş küçük modele. Videodaki ("Claude Code Subagents") karşılığı:
emin olunan karar **kodda** verilir, emin olunmayan durumda büyük modele
**yükseltilir**.

### Bugünkü durum (koddan)

- Otomatik model seçimi modelin **kendi** kararı. `ClaudeBackend.send()` her
  mesajın başına "[Hatırlatma: …]" ekliyor, model `mcp__self__set_model`
  çağırıyor, tur bitince temel modele dönülüyor (`session.ts`).
- Sorunlar:
  - Her turda hatırlatma tokeni harcanıyor.
  - Kararı zaten pahalı olan model veriyor.
  - Karar hiç ölçülmüyor.
- Eşleme ("haiku basit / sonnet orta / opus zor") üç yerde kopya:
  `selfTools.ts`, `claudeBackend.ts` (iki yer).

### A. Model yönlendirici (basit sürüm)

Mesaj ajana gitmeden ÖNCE çalışır: `AgentSession.send()` → `backend.send()`
arasında. Kod `server/src/router/` altında olur.

1. **Kural katmanı (0 token):** `/komut`; "oku, listele, göster, özetle"
   kalıpları; mesaj uzunluğu; görev türü (zincir adımı, araştırma, düzeltme,
   mimari); ajanın rolü. Kararların çoğu burada verilir.
2. **Sınıflandırıcı (yalnız kural emin değilse):** Haiku'ya tek satırlık soru,
   cevap tek kelime (`KÜÇÜK | ORTA | BÜYÜK`).
3. **Güvenlik payı:**
   - Kararsızsa Sonnet seçilir.
   - Ajan işin ortasında zor bir şeyle karşılaşırsa `set_model` ile yine
     yükselebilir.
   - Ajan başına kapatılabilir (mevcut `autoModel` alanı).
4. Yönlendirici açıkken her mesaja eklenen **hatırlatma kaldırılır**.

### B. Evet/hayır kararları (aday listesi)

| Karar | Bugün | JEV ile |
|---|---|---|
| Bu mesaj soru mu, görev mi? | Sohbette elle seçilen Görev/Soru çipi | Kendiliğinden seçilir |
| Bu tur görevi bitirdi mi? | `GRACE_MS` 90 sn yedek zamanlayıcı | Tek evet/hayır sorusu |
| Lidere mi, doğrudan uzmana mı? | Hep lidere brif | Basit iş doğrudan uzmana |
| Aynı hata iki kez mi? | yok | **Model gerekmez**, `BackendEvent`lerden kodla saptanır (danışman tetiği, `docs/ANALIZ.md` §7) |

**Güvenlik kuralı:** izin kararları ("bu komut güvenli mi?") küçük modele
BIRAKILMAZ. Model en fazla "reddet / kullanıcıya sor" diyebilir, onay veremez.

### İLK İŞ: maliyeti ölç (varsayma)

Ajanlar Claude Code **aboneliğiyle** çalışıyor, ayrı API anahtarı yok.
Sınıflandırıcı da aynı yoldan çağrılmak zorunda: Agent SDK `query()`, model
haiku, `systemPrompt` düz dizge (preset DEĞİL), araç yok,
`settingSources: []` (CLAUDE.md ve skill yüklenmesin).

- Tek bir sorunun gerçek token maliyeti ölçülmeli. Ölçüm yolu: `usage` alanı
  ya da `/api/agents/:id/inspect`.
- **Karşılaştırma:** yeni bir ajan oturumunun açılışı ~35k token tutuyor
  (2026-11-23'te ölçüldü). Sınıflandırıcı birkaç yüz token tutarsa kazanç büyük.
  Eğer CLI kendi sistem yükünü ekleyip binlerce token tutuyorsa, sınıflandırıcı
  yerine yalnız kural katmanı kullanılmalı.

### ÖLÇÜLDÜ (2026-11-24) — `node server/scripts/measure-router.mjs A|B|C`

**A) Sınıflandırıcı** (haiku, düz sistem istemi, araç yok, `settingSources: []`,
6 örnek mesaj, ortalama):

| Ayar | Girdi | Çıktı | Maliyet | Süre |
|---|---|---|---|---|
| Düşünme AÇIK (varsayılan) | 859 | 441 | $0.0037 | 6.7 sn |
| Düşünme KAPALI + mesaj `<istek>` ile sarılı | 570 | 7 | **$0.0006** | **2.3 sn** |

- **Düşünme kapatılmak ZORUNDA** (`thinking: { type: 'disabled' }`): tek kelimelik
  cevap için 300-600 gizli çıktı tokeni ve 4 sn fazladan gecikme.
- **Mesaj veri olarak sarılmak ZORUNDA:** çıplak gönderilen "README'yi özetle"
  görev sanıldı, model sınıf yerine cevap yazmaya çalıştı.
- CLI'ın kendi sistem yükü küçük (~570 girdi). Yani "binlerce token" korkusu boşa.
- **Asıl bedel gecikme:** 2.3 sn'nin çoğu her çağrıda yeni CLI süreci açmak.
  Mesajın önüne bu kadar bekleme eklemek hissedilir.
- Doğruluk kusursuz değil: "login hatasını düzelt" KÜÇÜK dendi (ORTA olmalıydı).

**B) Ajan oturumu açılışı** (tech-lead kişiliği + skill'ler + kullanıcı/proje
ayarları, tek "5+5" turu; gerçek oturumdan biraz düşük, team/self/task MCP yok):

- Sonnet soğuk: önbelleğe **39.434 token yazma, $0.237**. Haiku soğuk: 26.890, $0.054.
- Aynı önek 5 dk içinde tekrar: önbellekten okunur, **$0.003** (haiku).
- **Çevirinin kazancı küçük:** Türkçe dosyalarla 27.160, İngilizceyle 26.900 token
  (**−260, ~%1**). Skill'lerin yalnız adı + açıklaması açılışa giriyor, gövdesi
  çağrılınca; yükün büyüğü CLI'ın sistem istemi ve araçları.

**C) Oturum İÇİNDE model değişimi** (haiku → haiku → sonnet → haiku):

| Tur | Model | Önbellek oku / yaz | Maliyet |
|---|---|---|---|
| 1 | haiku | 26.890 / 0 | $0.003 |
| 2 | haiku | 0 / 28.511 | $0.057 |
| 3 | **sonnet** | **0 / 39.491** | **$0.237** |
| 4 | haiku | 28.511 / 1.303 | $0.006 |

- **Önbellek modele özgü:** başka modele geçmek, o modelin önbelleği soğuksa
  bütün öneki yeniden yazar. Bir turluk "Sonnet'e çık" ≈ $0.24 ≈ 400 sınıflandırıcı.
- Geri dönmek ucuz (eski modelin önbelleği 5 dk içinde hâlâ sıcak).
- **Açıklanamadı:** 2. turda model aynı kaldığı hâlde okuma 0, yazma 28.511.
  Tekrar ölçülmeli (CLI'ın önbellek kırılma noktası ilk turdan sonra mı kayıyor?).

**Gerçek kullanım (usage-history.json, 11 tur):** 8 sonnet + 3 haiku, $1.67;
oturum içi model değişimi 0 (örnek küçük). 11 turda **238.820 token önbellek
yazma** → maliyetin çoğu yeni oturum açılışlarından geliyor.

### UYGULANDI (2026-11-24)

Aşağıdaki tasarım `server/src/router/` olarak uygulandı (ayrıntı `server/CLAUDE.md`
→ "JEV model yönlendiricisi"). Açık kalanlar:
- Mesajlaşma yüzeyleri (sohbet, terminal) yönlendirilmiyor; yalnız görevler.
- Sınıflandırıcı gecikmesi (~2.3-4 sn) için sürekli açık tek oturum denenmedi.
- §B'deki evet/hayır kararları (soru mu görev mi, tur bitti mi, lidere mi
  uzmana mı) henüz yok.
- Ajanın kendi `set_model` yükseltmesinin sıklığı hâlâ ölçülmedi.

### Ölçümden çıkan tasarım (yukarıdaki A/B planını DÜZELTİR)

1. **Yönlendirme MESAJ başına değil GÖREV/OTURUM başına.** Model bir oturum
   açılırken seçilir ve oturum boyunca sabit kalır. Oturum ortasında model
   değiştirmek soğuk önbellek demek ($0.24/geçiş, sonnet). Bugünkü
   `set_model` yükseltmesi bu yüzden kendi başına pahalı olabilir; ne sıklıkta
   tetiklendiği ölçülmeli (geçmişte veri yok).
2. **Kural katmanı önce** (0 token, 0 ms). Sınıflandırıcı yalnız kural emin
   değilse ve yalnız YENİ bir görev/oturum başlarken: $0.0006 maliyet önemsiz,
   2.3 sn gecikme önemli. Gecikmeyi düşürmek için sürekli açık tek bir
   sınıflandırıcı oturumu (akış girişli `query`) denenebilir; ölçülmedi.
3. **En büyük kazanç kapısı oturum açılışı:** delegasyonda alt görev zaten yeni
   bir oturumda başlıyor; ucuz işi Haiku'da açmak açılışı $0.237 → $0.054 yapar
   (~4.4 kat). Yönlendiricinin asıl yeri `delegate_task(s)` → alt ajanın
   oturum modeli.
4. Sınıflandırıcı çağrısında `thinking: disabled` ve `<istek>` sarmalayıcısı şart.

### Ölçüm ve gösterim

- Her yönlendirici kararı `usage-history.json`a yazılır. Alanlar: `routedModel`,
  `reason` (kural mı, sınıflandırıcı mı) ve sınıflandırıcı maliyeti.
- Harcama panelinde "yönlendirici tasarrufu" gösterilir: yönlendirilmiş turun
  maliyeti ile aynı turun Sonnet'teki tahmini maliyeti arasındaki fark.
  Ölçülmüş sayı, uydurma yüzde değil.

### Büyüklük

Basit sürüm (kural katmanı + Haiku sınıflandırıcı + ölçüm) tek oturumluk iş.
Sunucu değişikliğinden sonra `npm run build` şart (CLI `server/dist`i çalıştırır).
Sonra panel tarafında `npm install -g .` yeniden gerekmez, `npm run build`
yeterli.

---

## 3. İleride değerlendirilecek: masaüstü uygulaması (Tauri)

**Karar: sunucu Rust'a ÇEVRİLMEZ** (2026-11-23 değerlendirmesi). Gerekçeler:

- **Node zaten zorunlu.** Agent SDK, Claude Code CLI'ını çalıştırıyor ve CLI bir
  Node programı. Rust'ın "tek ikili dosya, bağımlılık yok" vaadi boşa düşer.
- **Resmî Rust Agent SDK'sı yok** (yalnız TS ve Python). CLI'ın `stream-json`
  protokolünü, süreç içi MCP sunucularını (`team`, `task`, `self`, `browser`),
  `canUseTool` izin kapısını ve resume akışını elle yeniden yazmak gerekirdi.
  Protokol değişirse kod sessizce kırılır.
- **Darboğaz sunucu değil, model.** Bir tur saniyeler sürüyor; Rust burada
  kullanıcının hissetmeyeceği milisaniyeler kazandırır.
- **Playwright'ın resmî Rust sürümü yok** (`chromiumoxide` / CDP ile yapılır,
  ölçülmüş incelikler yeniden kurulur).
- **Kodun çoğu React arayüzü.** Paylaşılan tipler iki ayrı dilde yaşamaya başlar.
- **npm dağıtımı karmaşıklaşır.** Platform başına derlenmiş paket ve CI hattı
  gerekir; bugün `npm publish` tek komut.

**Rust'ın gerçekten işe yarayacağı yer: Tauri ile masaüstü uygulaması.**

- Mevcut React paneli olduğu gibi Tauri penceresine girer.
- Node sunucusu **sidecar** olarak yanında çalışır, Rust'a çevrilmez.
- Boyut ~10 MB (Electron ~150 MB; Orkas Electron kullanıyor).
- Kazanç:
  - sistem tepsisi ikonu;
  - "izin bekliyor" / "görev bitti" için yerel bildirim;
  - otomatik güncelleme;
  - çift tıkla açılan uygulama.
  "Terminal bilmeyen kullanıcı" hedefine (Sohbet modu, Sade stil) doğrudan hizmet eder.
- **Açık sorular:**
  - Sidecar Node'u uygulamayla mı paketlenir, yoksa kullanıcının Node'u mu kullanılır? (Claude Code CLI için Node yine gerekli.)
  - Windows/macOS imzalama maliyeti.
  - npm dağıtımı mı kalır, yoksa ikisi birlikte mi?
- **Ne zaman:** stil temaları ve JEV'den sonra; npm yayını ile çakışmasın.

---

## Hatırlatmalar (bu iki işten bağımsız)

- ~~Kalan çeviri~~ → 2026-11-25 BİTTİ (`L.cmdOut`, `L.apiErrors`).
- **npm publish EN SONA** (kullanıcı kararı). `main`e push npm'i etkilemez.
- Kullanıcı yeni sürümü yerelde `npm run build` + `npm install -g .` ile kullanıyor.
- Repo klasörünü `claudiva` yapma kontrol listesi: `HANDOFF.md`.
- Commit'te `Co-Authored-By` satırı YOK.
