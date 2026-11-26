# Masaüstü notları (desktop/)

Kökteki `CLAUDE.md` her oturumda, bu dosya yalnız `desktop/` altında çalışırken yüklenir.

## Ne olduğu (kullanıcı kararları, 2026-11-26, yeniden sorma)

- **Tauri kabuğu, panelin yeniden yazımı DEĞİL.** Kabuk npm paketindeki
  sunucuyu (`bin/claudiva.js`) alt süreç olarak başlatır ve pencereyi
  `http://localhost:<port>/`a götürür. Panel CLI'daki panelin birebir aynısı.
- **Sunucu sistemdeki Node ile çalışır** (20+). Node gömülmez; yoksa açılış
  ekranı "Node kur" der. Gömülü Node seçeneği ~60-100 MB eklerdi.
- **Açılış ekranı** (`launcher/index.html`): Klasör seç + son projeler. Aynı
  anda tek proje.
- **Windows başlık çubuğu ve yerel menü YOK** (`decorations: false`, kullanıcı
  kararı "kendi çubuğumuz"). Açılış ekranında üst şerit `data-tauri-drag-region`
  + pencere düğmeleri; panelde üst çubuk (`web/src/desktop.ts`,
  `WindowControls.tsx`): boş yere basınca sürükler, çift tık büyütür, sağda
  Proje değiştir + küçült/büyüt/kapat. Komut paletinde de "Proje değiştir".
- Aynı depoda, ayrı dal (`feat/desktop`). npm'e girmez: kök `package.json`
  `files` alanı yalnız `bin, agents, server/dist, web/dist`. Kök `workspaces`a
  `desktop` EKLENMEZ (her `npm install` Tauri CLI'ını da kurardı).

## Çalıştırma

- Geliştirme: `cd desktop && npm run dev` (önce kökte `npm run build`, sonra
  `tauri dev`). Debug derlemede sunucu kökü DEPONUN KENDİSİ
  (`CARGO_MANIFEST_DIR/../..`), yani `server/dist` taze olmalı (kök kural).
- Paket: `cd desktop && npm run build` → `src-tauri/target/release/bundle/nsis/*.exe`.
  `tauri.bundle.json` yalnız burada birleşir: `beforeBuildCommand`
  `scripts/prepare-app.mjs` + `resources` (`build/app/` → `app/`).
  **Kaynak eşlemesi ana yapılandırmada OLAMAZ:** tauri-build kaynakları debug
  derlemede de kopyalar, `build/app` yokken `cargo build` düşerdi.
- `prepare-app.mjs`: kök derleme → `npm pack` (npm kullanıcısının aldığı
  dosyaların AYNISI) → aç → `workspaces/devDependencies/scripts` sil (paketlenmiş
  package.json `workspaces` taşıyor, server/ web/ kaynakları pakette yok) →
  `npm install --omit=dev`.

## Ölçülmüş davranışlar

- **Sunucu kapanışı stdin borusuyla.** Windows'ta alt sürece SIGINT
  gönderilemez, zorla öldürmek tamponlu yazımları (tasks.json 500ms, döküm
  300ms) kaybettirir. Kabuk `CLAUDIVA_DESKTOP=1` ile başlatır, boruyu kapatınca
  `bin/claudiva.js` `process.emit('SIGINT')` ile sunucunun kendi kapanışını
  çağırır. Ölçüldü: pencere kapatma 0,2 sn; kabuğu `Stop-Process -Force` ile
  öldürmek de 0,2 sn (boru kapanıyor, sunucu öksüz kalmıyor). 6 sn içinde
  kapanmazsa `taskkill /T /F` (ajan süreçleri ağacın içinde).
- **Açılış ekranı adresi `setup`ta okunamaz**: o an boş dönüyor, "Proje
  değiştir" sessizce hiçbir şey yapmıyordu. `open_project` içinde (sayfa kesin
  yüklüyken) okunur. Windows'ta `http://tauri.localhost/`.
- **Yerel menü kısayolları panelde çalışmıyordu** (klavye WebView2'nin kendi
  sürecine gidiyor; Ctrl+Shift+O denendi). Menü bu yüzden de kaldırıldı;
  Ctrl+R'yi WebView2 kendisi işliyor.
- **Panelin Tauri izinleri dar** (`capabilities/panel.json`, `remote`
  `http://localhost:*/*`): pencere düğmeleri, sürükleme, `is_maximized`,
  olaylar ve `switch_project`. `build.rs` `AppManifest::commands` ile her
  komut için izin üretir ve komutları varsayılan-açık olmaktan çıkarır.
  Ölçüldü: panelden `open_project` ve `recent_projects` "not allowed" ile
  reddediliyor. Yeni komut = `build.rs` listesi + ilgili yetenek dosyası.
- **`data-tauri-drag-region` panelde kullanılmaz**: yalnız özniteliği taşıyan
  öğenin KENDİSİNDE çalışıyor; çubuktaki kapsayıcı ve metinlerde değil.
  `onTitleBarMouseDown` düğme/sekme/alan dışındaki her yerde `startDragging`.
  Ölçüldü (gerçek fare): şerit ve üst çubuk sürüklemesi birebir, sağ kenardan
  boyutlandırma ve çift tıkla büyütme çalışıyor.
- **Açılış ekranında `setBusy` yalnız `main button`ları kapatır**: pencere
  düğmeleri Node yokken de çalışmalı (yoksa uygulama kapatılamazdı).
- **Test tuzağı:** `playwright` `connectOverCDP` sayfayı varsayılan olarak
  AÇIK renk şemasına zorluyor; Windows koyuyken bağlanıp kopmak renk geçişini
  yarıda yakalatıp gri satır gösterdi. Gerçek hata değil.
- **Port**: 4600'den başlayıp ilk boş port; IPv4 VE IPv6 ayrı denenir (CLI'daki
  ölçülmüş tuzak). Port `--port` ile verilir; CLI dolu portta kaymaz, hata verir.
- **Yetki**: `capabilities/default.json` yalnız `main` penceresindeki YEREL
  sayfaya (açılış ekranı) uygulanır. Panel localhost'tan gelir ve Tauri API'sine
  erişemez; bilerek böyle.
- Sunucu günlüğü: `%LOCALAPPDATA%\dev.claudiva.desktop\logs\server.log`
  (her açılışta sıfırlanır). Son projeler: `%APPDATA%\dev.claudiva.desktop\recent.json`.

- **Açılış ekranında son projeler ızgarası `minmax(0, 1fr)` taşır.** Yoksa
  ızgara sütunu içeriğin en kısa genişliğine kilitlenir, `nowrap` yol kartı
  yolun tam boyuna uzatıp ekrandan taşırıyordu (kullanıcı ekran görüntüsü).
  Ölçüm betiği: kart sağ kenarı ≥ en geniş satırın sağ kenarı, koyu/açık,
  1440 ve 620 px.
- `recent.json` okunurken BOM atılır: PowerShell 5 ile yazılan dosyada serde
  düşüp listeyi sessizce boşaltıyordu.

## Test yöntemi (GUI'siz)

- `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` ile
  başlat, `playwright-core` `connectOverCDP` ile bağlan. Klasör diyaloğunu
  atlamak için `window.__TAURI__.core.invoke('open_project', { dir })`.
- **`#pick`e tıklama**: yerel diyalog açılır ve CDP onu kapatamaz.
- Yerel menüye tıklamak için betik DPI farkında olmalı (`SetProcessDPIAware`);
  ekran %150 ölçekli, sanal koordinatla tıklama menüyü ıskalıyordu.
- `SetForegroundWindow` Windows'ta engellenir; pencereyi öne almak için
  başlık çubuğuna fareyle tıkla.
- Test sırasında `CLAUDIVA_HOME`u geçici bir klasöre ayarla; kabuk ortamı
  sunucuya aynen geçirir, gerçek `~/.claudiva` kirlenmez.

## Açık işler

- ~~Uygulama simgesi~~ → 2026-11-26: logo "Çekirdek" (`docs/brand/`),
  `src-tauri/icons/` ondan üretildi, açılış ekranında küçük çizim satır içi.
- Panelden açılan dış bağlantılar (`target=_blank`) WebView2'nin kendi
  penceresinde açılır, sistem tarayıcısında değil. Denenmedi.
- Kod imzalama yok: SmartScreen "tanınmayan yayımcı" uyarısı verir.
- macOS/Linux denenmedi (kod platformdan bağımsız yazıldı, `taskkill` yalnız Windows'ta).
