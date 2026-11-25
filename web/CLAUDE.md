# Arayüz notları (web/)

Kökteki `CLAUDE.md` her oturumda, bu dosya yalnız `web/` altında çalışırken yüklenir.

## CSS ve hareket (proje gerçekleri)

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

## Arayüz dili (i18n)

- **Kütüphane YOK.** `web/src/i18n/tr.ts` KAYNAK sözlük, `en.ts` `Dict` tipine
  bağlı: anahtar eksik, fazla ya da parametre imzası farklıysa `tsc -b` KIRILIR
  (ölçüldü: `en.ts`ten bir anahtar silmek TS2741 verdi). Yeni dil = yeni dosya +
  `i18n/index.ts`teki `LOCALES`/`DICTS`e birer satır + `index.html`deki betikte dil kodu.
- **Parametreli metin FONKSİYONDUR** (`L.chat.typing(ad)`); `{name}` gibi yer
  tutucu ayrıştırma yok, çoğul İngilizcede fonksiyonun içinde çözülür.
- **Dil değişimi SAYFAYI YENİLER** (`setLocale`). Bu yüzden `L` modül yüklenirken
  bir kez çözülür ve her yerde sabit gibi okunur: modül seviyesindeki tablolar
  (`ROLE_LABEL`, `STATUS_LABEL`, `PANELS`, tema adları) da dili izler. Bunu
  "canlı" yapmaya kalkmak her tabloyu fonksiyona çevirmeyi gerektirir; değmez.
- **Kod içi kimlikler ÇEVRİLMEZ**, yalnız görünen etiket: tema `group` değeri
  (`'Plakalar'`) filtre anahtarı olarak kalır, ekranda `L.themePicker.groups[g]`.
  Aynı şekilde `BRIEF_MARKER`, `⟪yanıt:` ve görev kuyruğunun `# Görev (id:`
  öneki sabittir — eski dökümleri tanımak için.
- **Ekip talimatı (`L.brief`) arayüz diliyle gider**: İngilizce isteğin altına
  Türkçe çerçeve eklenirse ajanın cevap dili karışırdı. Ajanların kişilik ve
  skill dosyaları AYRI konu: 2026-11-24'ten beri İngilizce (token), ajan
  kullanıcının dilinde cevap verir (bkz. `server/CLAUDE.md`).
- Tarih/saat biçimi `dateLocale` ile (`'tr-TR'` yazma). Belge dili ve açılış
  perdesi metni `index.html`deki satır içi betikte, `detect()` ile AYNI kuralla.
- Yeni metin eklerken: önce `tr.ts`e, sonra `en.ts`e; derleme eksik olanı söyler.
  **JSX'e düz metin YAZMA** (`<h2>Harcama</h2>`, `title="Kapat"`): Türkçe karakter
  taşımayan kaçaklar ("Kadir", "Toplam") ancak JSX metin düğümü taramasıyla
  bulundu (2026-11-25, ~35 kaçak `L.extra`ya taşındı).
- **Ajan adı/açıklaması dile göre** (`agentI18n.ts`): paket ajanları
  `config.json`da `i18n: { tr, en }` taşır. `useStore.refreshAgents` store'a
  girerken BİR KEZ `localizeAgent` uygular (75 gösterim yeri `config.name`
  okumaya devam eder). Çeviri yalnız alan hâlâ `i18n.tr` değerine eşitse
  kullanılır; kullanıcının verdiği ad her dilde aynı kalır. **Disk hep `tr`
  taşır:** `AgentForm` kaydederken `delocalize` uygular, yoksa EN arayüzde formu
  kaydetmek adı diske İngilizce yazar ve TR'ye dönünce çeviri bir daha tutmazdı.
  Ölçüldü: sıfır kurulum, eski kurulum ("Boss" → paket adı → çeviri) ve elle
  değiştirilmiş ad üçü de doğru. Yeni paket ajanı = `config.json`a `i18n` ekle.
- **Yerel komut çıktısı (`/status`, `/doctor`…) `L.cmdOut`ta.** Bu metni model
  değil panel yazar, kullanıcının yazdığı dile UYMAZ; yalnız SDK'ya giden komutlar
  (`/compact`, skill'ler) modelin dilinde döner. `/resume` iki dilde de
  `yeniden` ve `restart` argümanını kabul eder.
- **Sunucu hataları KOD taşır:** `routes.ts` `ApiError(code, metin)` →
  `{ error, code }`; `api.ts` `L.apiErrors[code]`ı gösterir, tanımadığı kodda
  ya da kodsuz hatada (SDK, git, dosya sistemi) sunucu metnine düşer. Yeni
  hata eklerken `ApiError` kullan ve kodu iki sözlüğe ekle.

## Paket bölme

- **Varsayılan ekranda görünmeyen her şey `lazy()`** (App.tsx): Sohbet ve Pano
  kabukları, Ofis/Harcama/Kod/Raporlar/Skill/Tarayıcı/Değişiklikler/Hafıza/
  Promptlar panelleri, Ayarlar ve Görünüm. Ölçüldü: ana paket 579 → 340 KB,
  500 KB uyarısı gitti. **Bu modüllerden birini App.tsx dışındaki eager bir
  modülden statik import ETME**: yığın sessizce ana pakete döner, uyarı da geri
  gelir. Paneller `renderPanel` içinde `Suspense fallback={null}` ile sarılı.

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

## Arayüz modları (Paneller / Sohbet)

- **Mod yalnız GÖRÜNÜMDÜR.** `uiMode.ts` (`claudiva.uiMode`, localStorage);
  `App.tsx` başlık ve modalları ortak tutup `.layout`+`Orchestrator` ile
  `ChatShell` arasında dallanır. Sunucu hangi kabukta olunduğunu bilmez;
  sohbet için YENİ UÇ YOK.
- **`chatFeed.ts` saf akış kurucudur** (React yok). Döküm, görev ve izin listesini
  zaman sıralı `ChatItem[]`e çevirir; bir tur (`user` → `result`) tek balon olur,
  araçlar balonun içinde katlanır. Görev kuyruğunun çalışana yazdığı `# Görev (id:`
  mesajı BASTIRILIR, çünkü delegasyon kartı onu zaten söylüyor. Üçüncü bir
  mod ("Akış") gelirse veri kaynağı yine bu dosya.
- **Ekip talimatı `brief.ts`te ve `BRIEF_MARKER` ile başlar.** Sohbet, liderin
  dökümündeki kullanıcı mesajını bu işaretten keser (`stripBrief`); eski
  işaretsiz brifler (`
---

Bu bir EKİP İŞİDİR.`) de tanınır. İşareti
  değiştirmek eski dökümlerde brif metnini sohbete döker.
- **Tek ajana gönderim tek yoldan geçer: `agentSend.ts` (`sendToAgent`).** Yerel
  komut / SDK ayrımı terminal ve DM için ortak; iki yerde ayrı yazılırsa biri
  yeni bir yerel komutu tanımaz ve komut modele düz metin olarak gider.
  İzin yanıtı da tek yerde: `permissions.ts` (`answerPermission`).
- **İki ölçülmüş tuzak (ikisi de bu modu yazarken bulundu):**
  - `.chat` sohbet kabuğunun ızgara sınıfıdır. Ayarlar'daki önizleme
    `mode-prev chat` adını alınca ızgarayı miras aldı (`.center` tuzağının
    aynısı). Önizleme sınıfları bu yüzden `mp-` önekli.
  - **`@container` bir öğenin KENDİSİNİ ölçemez**, yalnız atasını. Kap `.chat`in
    kendisiyken ızgara hiç kırılmıyordu → `.chat-wrap` sarmalayıcısı.
- **Yanıt (alıntı) ilişkisi mesaj METNİNDE taşınır** (`reply.ts`): ilk satır
  `⟪yanıt:<öğe kimliği>⟫`, ardından `> Yazar: alıntı`. Ajan alıntıyı bağlam
  olarak görür (ölçüldü: "Dört."e "rakamla yaz" yanıtı → "4"); ilişki dökümde
  kalıcı, ayrı depo ya da uç yok. Öğe kimliği `chatFeed`in kararlı kimliği ve
  `data-item` özniteliği; alıntıya tıklamak oraya kaydırır. Brif yanıt bloğunun
  ALTINA eklenir, bu yüzden `stripBrief` önce, `parseReply` sonra çalışır.
  `/komut` yanıt bloğuyla SARILMAZ (CLI yalnız ilk karakter `/` ise komut sayar).
  Ajan mesajına yanıt o ajana gider; kendi mesajına yanıt hedefi değiştirmez.
- **Teslim kartında kanıt rozeti** (`N dosya` / `dosya yok`): `GET
  /api/tasks/evidence` (sonuçlanmış HER görev, alt ağaç dahil; `/reports` yalnız
  kökleri döndürdüğü için oradan okunamazdı). Raporlar ile aynı `evidenceIndex`
  yardımcısı, sayılar birebir tutar (ölçüldü). Yalnız sonuçlanan görev kümesi
  değişince yeniden okunur.
- Erişilebilirlik (2026-11-25 denetimi): ileti bölgesi `role="log"`
  (`aria-relevant="additions"`: akan metin duyurulmaz, yeni balon duyurulur),
  Görev/Soru ve Plan çipleri `aria-pressed`, yazı alanı `aria-label`.
- Okunmamış sayacı `claudiva.chat.seen`. İlk ziyarette mevcut geçmiş "görülmüş"
  sayılır. Güncelleme İŞLEVSEL olmak zorunda (`markSeen`): aynı karede iki
  efekt yazıyor, eski durumu okuyan ikincisi birincinin yazdığını eziyordu.

## Terminal dökümü: sade / ayrıntılı

- **Varsayılan SADE** (`toolDetail.ts`, `claudiva.toolDetail`; durum satırındaki
  "ayrıntılar" kutusu). Kod bilmeyen kullanıcı için `mcp__team__delegate_task({...})`
  satırları gürültüydü (kullanıcı geri bildirimi). Sade görünümde art arda araç
  adımları tek katlanmış satıra iner, okunur etiketle (`toolFriendly.ts`,
  `L.friendly`; tanınmayan araç uydurma açıklama almaz, `mcp__x__` öneki atılmış
  adıyla kalır); görev kuyruğunun `# Görev (id:` mesajı başlığına iner. Açılınca
  ham hâl AYNI skin bileşenleriyle çizilir, bilgi kaybolmaz.
- Ardışık aynı sistem satırları iki görünümde de tek satır + `×N`.
- Sohbet modu zaten araçları katlıyor (`cm-tools`); orası ayrı.

## Pano modu (üçüncü arayüz modu)

- `uiMode` = `board`. Kabuk `components/board/BoardShell.tsx`, widget'lar
  `widgets.tsx` (14 tür), galeri `WidgetGallery.tsx`, saf yerleşim modeli
  `board.ts` (`claudiva.board.v2`). Sohbet gibi yalnız GÖRÜNÜM: aynı store,
  yeni uç yok. Takım kapsamı üst çubuktaki takım sekmesinden gelir.
- **12 sütun × SABİT satır (`ROW_PX` 56, `GAP_PX` 16); widget `w` (2-12) ve
  `h` (2-12) taşır.** İlk sürümde yükseklik içerikten geliyordu, kartlar
  arasında düzensiz boşluk kaldı ("hizalamak çok zor"). Sabit satırla aynı
  sıradaki kartlar eşit boyda, içerik `.bw-body` içinde kayar. Varsayılan
  dizilim satırları tam doldurur; v1 kaydı bu yüzden TAŞINMAZ.
- **Taşıma: işaretçi (pointer) olaylarıyla, HTML5 sürükle-bırak DEĞİL.**
  HTML5 yolu sentetik olaylarla hiç tetiklenmedi ve dokunmatikte çalışmaz.
  Tutamak (⠿) → imlecin altındaki kart `elementsFromPoint` ile bulunur
  (sürüklenen hariç), yarısına göre önüne/arkasına CANLI yerleşir; bırakma
  anı da değerlendirilir (hızlı hareket son yarıya varmadan bitiyordu).
  Ölçüm: 20 ara adımlı sürükleme kartı tam hedefin sağına koydu; test
  aracının kaba sürüklemesi yanıltıcıydı.
- **Boyut: sağ alt köşeden**, imleç farkı sütun/satır birimine yuvarlanır;
  sürerken `w×h` rozeti görünür. Klavye: tutamak odaklıyken ← → taşı,
  Shift + oklar boyutlandır. Ayrı "düzenle" kipi YOK.
- **Galeri önizlemesi gerçek widget'ı çizmez** (ağ isteği, ölçü): `Thumb`
  token renkli ilkellerle biçimi taklit eder. Her tür panoda en fazla bir kez.
- **Gönderim/izin tek yoldan:** "Ekibe yaz" = `buildBrief` + `api.sendMessage`
  (Orchestrator ile aynı); onay = `answerPermission`; "Son mesajlar" =
  `buildFeed` + `previewOf` (sohbetle aynı akış).
- **Buzlu cam ancak arkasında renk varsa okunur:** `.board` zemininde tema
  token'larından üç ışık lekesi, kartlar `backdrop-filter`. Her stilde çalışır.
- **İki ölçülmüş tuzak:** kartın sınıfı `w-<tür>`, `bw-<tür>` DEĞİL
  (`bw-stats`/`bw-agents` içerideki ızgaralar). Kart başlığı `div`, `header`
  DEĞİL (genel header kuralı bant çekti).
- **Stil önizlemesi (ThemePicker) kendi paletinde çizilir:** `.style-prev`
  `data-theme={STYLE_DEFAULT_THEME[stil]}` taşır; yoksa üç kart da o anki
  paletle boyanıyor, stilin rengi görünmüyordu.

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
- Yerleşim `localStorage`'da (`claudiva.layout.v1`), 250ms gecikmeli
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
  mürekkep, tane): Gece · Gündüz. *Premium* işlenmiş bir yüzeyi
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
- **Plakalar gerçek bir gözlem koşulu:** Gece · Gündüz (basılı plaka,
  `--glow-a: 0`). **Kırmızı Fener (`redlight`) 2026-11-25'te kullanıcı isteğiyle
  KALDIRILDI;** kayıtlı seçimi olan Obsidyen'e düşer (`themes.ts` `isKnown` +
  `index.html` betiği, ikisi aynı kural). Bu dosyadaki eski "Kırmızı Fener"
  notları tarihçedir (Prism'in sınıf seçme gerekçesi hâlâ geçerli).
- **Fontlar paketten gelir** (çevrimdışı da aynı görünsün): Bodoni Moda italik
  (gravür başlıkları), Archivo (arayüz), JetBrains Mono (koordinat/okuma).
- Yerleşim gerçeği: solda plaka indeksi, ortada plaka, Genel Durum'da sağda efemeris
  okumaları. Ekip listesi yalnızca Terminal plakasında — Ajanlar plakasında liste
  sayfanın kendisidir, ikinci bir kopya aynı adları tekrarlıyordu.

## Stil katmanı (renkten ayrı eksen)

- **İki eksen:** `data-theme` = palet (`themes.css`), `data-style` = tasarım dili
  (`styles.css`: yazı tipi, başlık biçimi, köşe, doku, gök süsü, etiket tonu).
  Varsayılan stil `observatory` (Gözlemevi) index.css'in kendisidir, blok almaz.
  Şu an ikinci stil `studio` (Stüdyo).
- **Stil ve palet TEK yerden seçilir: Görünüm menüsü** (`ThemePicker`: Stil →
  paletler → Terminal tipi). Önce stil Ayarlar'daydı ve iki menü birbirinin
  üstüne yazıyordu (Stüdyo + Obsidyen gibi yarım karışımlar; kullanıcı fark etti).
  Her stilin palet grupları `appStyle.ts` `STYLE_GROUPS`; Görünüm yalnız onları
  gösterir. Uyumsuz kayıt açılışta düzeltilir: `syncPalette` (main.tsx import)
  + `index.html` satır içi betik, ikisi AYNI kural.
- **Stil seçicisi `:root[data-style=…]` (0,2,0) OLMAK ZORUNDA:** premium temalar
  da köşe/doku/yıldız alanı yazıyor (`[data-theme]`, 0,1,0); stil onları yenmeli.
  Türetilmiş ad (`--label-fg`) için ikinci seçici `:root[data-style] [data-theme]`,
  yoksa tema önizlemesi Gözlemevi etiketini yeniden türetir.
- **Başlık biçimi token:** `--title-style` (italik/normal), `--title-weight`;
  etiket rengi `--label-fg`. Yeni başlık/etiket kuralında `font-style: italic`
  ya da etikete `color: var(--hud)` YAZMA, token'ı kullan; yoksa Stüdyo'da
  sentetik italik Segoe çıkar (ölçüldü: `.phase-line em`, `.chat-list-head`,
  açılış perdesi bu yüzden kaçmıştı).
- **Stüdyo'nun referansı `docs/Screenshot_…jpg`** (beyaz kart, açık gri kenar,
  hap rozet, büyük harf yok, koyu birincil düğme, mor vurgu). İlk sürüm (çivit,
  büyük harf etiketler, mono meta, koyu Grafit varsayılanı) kullanıcı tarafından
  "aşırı kötü" bulundu. Bunu sağlayan token'lar: `--upper`/`--track`/`--caps-scale`
  (büyük harf kuralları `calc(Npx * var(--caps-scale))`), `--font-meta` (sohbet
  meta yazısı; kod/araç/terminal `--font-mono` KALIR), `--chip-radius`,
  `--bubble-tail`, `--event-*`, `--live-border`, `--status-tint`/`--status-border`.
  Son grup kural içinde `var(--x, varsayılan)` ile okunur; Gözlemevi değişmez.
- **Kâğıt'ta çalışıyor (aux) turuncu, onay bekliyor (warn) kehribar:** ilk
  denemede ikisi aynı tona düştü, durumlar ayrışmalı.
- **Varsayılan stil İKİ YERDE** (tema ile aynı tuzak): `index.html` satır içi
  betik + `appStyle.ts` `DEFAULT_STYLE`.
- **Stil değişince palet stilin varsayılanına çekilir** (Stüdyo → `paper`,
  Gözlemevi → `obsidian`), yalnız mevcut palet o stile uymuyorsa.
- **Stüdyo fontu SİSTEM yığını** (Segoe UI Variable / SF): 0 bayt, çevrimdışı.
  Paket fontu (Inter) istenirse yalnız o stil seçilince yüklenmeli.
- **Stil önizleme kartı kendi `data-style`ını taşıyamaz** (token kökte yaşar);
  `.style-prev-*` yazıyı ve köşeyi satır içi örnekler.
- Bilinen eksik: Genel Durum'daki gökyüzü haritası (`Sky.tsx`) Stüdyo'da da
  gök çizimi; doku/yıldız alanı kapalı ama harita aynı.
- **Üçüncü stil `phosphor` (Fosfor)**, referans `docs/` altındaki "Drop Cloude"
  videosu (gece yarısı ürün sayfası): grafit-siyah + limon, kalın Archivo başlık
  + **yalnız son kelime** italik Bodoni (`--em-font/--em-style/--em-color`),
  küçük harf mono etiket (`--upper: lowercase`, `--caps-font`), hap düğme
  (`--btn-radius`), düğmeler küçük harfe dönmez (`--btn-case: none`). Fontlar
  zaten pakette, yeni yükleme yok. Kendi paleti `phosphor` (grup `Fosfor`).
- **Stil yalnız token değil, BİLEŞEN de değiştirebilir:** Fosfor'da Genel Durum
  gökyüzü haritası yerine `PhosphorHero.tsx` çizer (mono durum rozeti, başlık,
  iki gerçek eylem, son devirler akış kartı; hepsi gerçek veri). Dal
  `Survey.tsx`'te `useAppStyle() === 'phosphor'`; CSS `.survey.px` altında,
  öteki stiller görmez. Yeni stil eklerken: `AppStyle` türü + `APP_STYLES` +
  `STYLE_GROUPS`/`STYLE_DEFAULT_THEME` + `index.html` betiğindeki `own`/`dflt`
  tabloları + `isKnown`.
