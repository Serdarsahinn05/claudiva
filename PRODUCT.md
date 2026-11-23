# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Birincil kullanıcı: kendi projelerinde aynı anda birden fazla Claude ajanı çalıştıran
geliştirici. Kendi makinesinde, kendi deposunda çalışıyor; ajanlara iş dağıtırken hepsinin
nerede olduğunu tek yerden görmek istiyor.

Ürün herkese açık dağıtılacak (npm paketi; `package.json` içinde `bin` ve `files` alanları
bunun için hazır). Bu yüzden ikinci bir kullanıcı sınıfı var: **projeyi hiç bilmeyen ilk
kullanıcı.** Panelin kendini anlatması gerekiyor; kurulum ve ilk açılış, yazarın kafasındaki
modeli bilmeyen birine anlaşılır olmalı.

## Product Purpose

Çok ajanlı Claude yönetim sistemi ve paneli. Bir proje üzerinde birden fazla ajanı
çalıştırmak, izlemek ve koordine etmek için tek bir yer.

Başarı ölçütü, kullanıcının kendi ifadesiyle: **paneli açar açmaz projenin şu an hangi
aşamada olduğunu görebilmek.** Panelin ilk işi rapor vermek değil, durum bildirmek.

## Positioning

Komşu bir ürünün dürüstçe kopyalayamayacağı mekanizmalar:

- **Ajan tanımı global, iş verisi projeye ait.** Tanımlar `~/.claudiva/agents`,
  çalışma verisi `<proje>/.claudiva/data`. Aynı ajan iki farklı projede ayrı oturum
  yürütür; tanımı taşımak veri taşımaz.
- **Sağlayıcıdan bağımsız oturum katmanı.** `AgentSession` SDK'yı hiç bilmez; SDK'ya özel
  her şey `AgentBackend` arkasındadır. Döküm, bütçe, görev korelasyonu, izin bekletme ve
  durum makinesi normalleştirilmiş olaylar üzerinde çalışır.
- **Gerçek paralel delegasyon.** `delegate_tasks` bir dizi görevi hepsini birden dağıtır;
  duvar saati en uzun görev kadardır, görevlerin toplamı kadar değil. Doğrulama önce yapılır:
  bir hedef geçersizse hiçbiri dağıtılmaz.
- **Bağımlılıklı görev zincirleri.** Adımlar `pending` doğar; başarısızlık aşağı yayılır, bir
  adım başarısızsa sonraki eksik girdiyle çalışıp yanıltıcı sonuç üretmez.

## Operating Context

- CLI olarak başlatılır: `claudiva` → `server/dist`i çalıştırır, varsa `web/dist`i
  servis eder. Varsayılan port 4600. Panel tarayıcıda açılır.
- Geliştirme: `npm run dev` (sunucu `tsx --watch` + vite). Vite `/api`yi sabit
  `localhost:4600`e proxy'ler.
- Roller: boss/patron ve worker'lar. Worker'lar `team` MCP sunucusunu almaz.
- Kullanıcının güvendiği yerleşim: **solda çalışan ajanlar, sağda görevler.** Sağdaki bölme
  sekmeyle değişir (rapor, graphify, hafıza). İlk ekran projenin genel durumunu gösterir.

## Capabilities and Constraints

- **Görev kapanışı turdan türetilemez.** `send()` ile sonuç 1:1 değildir. Kapanış birincil
  olarak ajanın kendi bildirimidir (`mcp__task__complete_task`, her role verilir); yedek
  olarak son turdan 90sn sonra açık görevler son turun metniyle kapatılır.
- **`session.usage` tümel toplamdır**, açılışta diskten geri yüklenir. Pencereli bütçe
  hesapları `usage.json` içindeki günlük pencereden, önceki değerle fark alınarak türetilir.
- **Bütçe kapısı `send()` ve `TaskQueue.dispatch()` içindedir**, çünkü `send()` ölü oturumu
  kendiliğinden yeniden başlatır; "ajanı durdur" biçiminde bir yaptırım tek başına yetmez.
- **Paylaşılan tipler iki yerde elle çoğaltılmıştır** (`server/src/types.ts` ve
  `web/src/types.ts`). Şema değişikliği ikisine birden dokunmak zorundadır.
- **`ProviderId` şu an tek üyeli (`claude`).** Soyutlama katmanı var, ikinci sağlayıcı yok.
  Bu bir eksiklik değil, kayıtlı bir durum.
- **Store'lar JSON dosyalarını yalnızca `init()`te okur.** Sunucu çalışırken dosyayı elle
  düzenlemek etkisizdir.
- **Doğrulama `npm run build` ile yapılır.** CLI kaynağı değil `server/dist`i çalıştırır ve
  `web/tsconfig.json` bir çözüm dosyasıdır; `tsc --noEmit` hiçbir şeyi denetlemez.
- Hafıza paneli `.claudiva/memory/<ajanId|shared>/*.md` dosyalarını okur; kenarlar
  `[[link]]` eşlemesiyle istemcide türetilir, çalışma anında AI gerekmez.
- **Bilinen açık sorun:** ajan `complete_task`ı çağırmadan önce `ToolSearch` ile yüklemek
  zorunda; fazladan bir tur maliyeti var, işlevi bozmuyor.

## Brand Commitments

Ad: **claudiva**. Depo: github.com/Serdarsahinn05/claudiva.

Bağlayıcı bir görsel kimlik **yok.** Mevcut görünüm kullanıcı tarafından açıkça
reddedilmiştir: yerleşim ve temalar değiştirilecek. Depodaki
`.agents/skills/futuristic/DESIGN.md` bir tasarım skill'idir, onaylanmış ürün kimliği
değildir; sonraki görsel çalışmada otorite sayılmaz.

## Evidence on Hand

- Çalışan sistem ve git deposu; `README.md`.
- Ölçülmüş mimari kararlar ve tuzaklar `CLAUDE.md` içinde kayıtlı.
- **Yok:** referans/müşteri görüşü, kıyaslama sayısı, kullanıcı sayısı, fiyatlandırma,
  lisans iddiası, indirme istatistiği. Bunlar mevcut değildir ve sonraki çalışma bunları
  uydurmamalıdır.

## Product Principles

1. **Panelin ilk işi durum bildirmektir.** Açıldığı anda projenin hangi aşamada olduğu
   okunabilmeli; bunu bulmak için tıklamak gerekiyorsa panel görevini yapmamıştır.
2. **Hepsi tek yerde.** Ajan durumu, görevler, çıktı, değişiklikler ve maliyet ayrı araçlara
   dağılmaz; birini görmek için diğerini kaybetmek gerekmez.
3. **Tanım taşınabilir, veri projeye aittir.** Bu ayrım ürünün temel vaadidir; arayüz de
   hangi şeyin nereye ait olduğunu belirsizleştirmemelidir.
4. **Sağlayıcı bağımsızlığı korunur.** SDK'ya özel hiçbir şey oturum katmanına sızmaz;
   arayüz de tek bir sağlayıcının diline göre isimlendirilmez.
5. **Dağıtılan bir araçtır.** Kurulum ve ilk açılış, projeyi bilmeyen birine kendini
   anlatmalı; yoğunluk uzman kullanıcı için korunurken giriş noktası acemiyi boğmamalı.

## Accessibility & Inclusion

Bu projede kontrast eşikleri **ölçülür, göz kararı yapılmaz.** Yüzeye karşı yürürlükteki
eşikler: `fg` ≥ 7:1, `muted` ≥ 4.5:1, `dim` / `accent` / `err` / `ok` / `warn` ≥ 3:1.

Bu kural deneyle konmuştur: ölçüm üç ayrı temada gözden kaçmış hata bulmuştur
(`spaceship` dim 2.52, `nord` err 2.46, `brutal` warn 2.79). Yayımlanmış paletler bile bu
arayüzde eşiği tutmayabilir. Yeni tema veya renk kararı ölçülmeden onaylanmaz.
