# Sürüm çıkarma

Bu belge Claudiva'nın npm'e nasıl yayınlandığını, sürümün nasıl yükseltildiğini
ve `npx` / global kurulum / `npm link` arasındaki farkı tanımlar. Buradaki
uyarılar varsayım değil; her biri en az bir kez üretimde karşılaşılıp ölçülmüş
durumlardır.

## Paket

| | |
|---|---|
| npm | [`claudiva`](https://www.npmjs.com/package/claudiva) |
| Komut | `claudiva` (`package.json` → `bin`) |
| İlk yayın | 0.1.0 · 2026-08-15 |
| Lisans | MIT |

---

## Üç kurulum yolu

| Yol | Komut | Davranış |
|---|---|---|
| **npx** | `npx claudiva` | Kurulum yapmaz; paketi geçici önbelleğe indirip çalıştırır. Komut PATH'e **girmez** — sonrasında düz `claudiva` çağrısı "is not recognized" verir. Bu bir hata değil, npx'in tanımıdır. |
| **Global** | `npm i -g claudiva` | `claudiva` komutu her dizinde tanınır. Kalıcı. |
| **Link** | proje kökünde `npm link` | Komutu yayınlanan sürüme değil **çalışma kopyasına** bağlar. Geliştirme için: `npm run build` sonrası değişiklik doğrudan çalışır. |

Global kurulum ve link aynı anda bulunamaz; ikisi de aynı komut adını ister.
Geçiş:

```bash
npm rm -g claudiva
npm i -g claudiva          # veya: cd <proje-kökü> && npm link
```

Kurulu olanı görmek için `npm ls -g --depth=0`.

> Paket adı değiştiğinde eski `npm link` kaydı kendiliğinden temizlenmez. Proje
> `claude-manager`'dan `claudiva`'ya geçtiğinde global listede
> `claude-manager@npm:claudiva -> ...` biçiminde bir kalıntı kaldı; elle
> kaldırmak gerekti.

---

## Yayınlama

```bash
npm login
npm whoami                 # hesabı doğrula
npm publish
```

`prepublishOnly` betiği `npm run build`i kendisi çalıştırır; `server/dist` ve
`web/dist` her zaman taze gider, elle derlemeye gerek yoktur.

> `npm login` ve 2FA soran `npm publish` **etkileşimlidir**: tarayıcı adresi
> basar ve girdi bekler. Etkileşimsiz bir kabukta (IDE terminalleri, betikler,
> ajan oturumları) çıktı görünmez ve komut askıda kalır. Gerçek bir terminal
> kullanın.

### Sürüm yükseltme

Yayınlanmış bir sürüm değiştirilemez; aynı numara yeniden yüklenemez. Güncelleme
her zaman yeni bir sürüm numarası demektir.

```bash
npm version patch          # 0.1.0 -> 0.1.1  (commit + git tag)
npm version minor          # 0.1.0 -> 0.2.0
npm version major          # 0.1.0 -> 1.0.0
npm publish
```

`npx claudiva` `latest` etiketini çeker, ancak npx yerel önbellek tuttuğu için
kullanıcı eski bir sürümü çalıştırabilir. Kesin sonuç için `npx claudiva@latest`.

### Projeyi bırakma

```bash
npm deprecate claudiva "Artık geliştirilmiyor."    # geri alma: mesajı "" yap
```

Paket yerinde kalır, ad korunur, kuranlar uyarı görür, mevcut kullanıcılar
kırılmaz.

> `npm unpublish` kullanılmamalıdır. 72 saatten sonra zaten mümkün değildir;
> mümkün olduğu durumda bile **ad kalıcı olarak bloke olur** ve bir daha
> kullanılamaz. "Bırak ama adı koru" isteğinin karşılığı `deprecate`'tir.

---

## Pakete ne giriyor

`package.json` → `files` bir beyaz listedir; orada yazmayan hiçbir şey
yayınlanmaz.

```json
"files": ["bin", "agents", "server/dist", "web/dist"]
```

Buna ek olarak npm her zaman `README.md`, `LICENSE` ve `package.json` ekler.

Pakete **girmeyenler**: `.claudiva/` (görev geçmişi, oturumlar, dökümler) ·
`.claude/` · `graphify-out/` · `memory/` · `CLAUDE.md` · `PRODUCT.md` ·
`DESIGN.md` · `server/src` · `web/src` · `node_modules` · `docs/`

Yayından önce içeriği görmek için: `npm pack --dry-run`

---

## Bilinen tuzaklar

**Çalışma zamanı bağımlılıkları kök `package.json`'da olmalıdır.** Yayınlanan
paket kök pakettir; `server/package.json`'a yazılan bir bağımlılık tarball'a
girmez ve kullanıcıda `Cannot find module 'express'` hatası verir. Bu hata depo
içinde test edilerek yakalanamaz: npm workspace kurulumu bağımlılıkları kök
`node_modules`'a topladığı için geliştirmede her şey çalışır.

**Yayından önce gerçek bir tüketici testi yapılmalıdır.** Güvenilir tek yöntem
paketi boş bir dizine kurup çalıştırmaktır:

```bash
npm pack
mkdir /tmp/test && cd /tmp/test
npm init -y && npm i <yol>/claudiva-x.y.z.tgz
node node_modules/claudiva/bin/claudiva.js --port 4711 --no-open
```

Sunucu ayağa kalkıyor ve `/` ile `/api/budget` 200 dönüyorsa paket sağlamdır.

**`web/public/` içindeki her şey pakete girer.** Vite `public/`i `web/dist`e
kopyalar, `files` da `web/dist`i gönderir. README ekran görüntüsü bir süre orada
durduğu için paket 1.0 MB'den 2.1 MB'ye çıkmıştı; uygulamanın hiç servis etmediği
bir görsel her kurulumda iniyordu. Depoya ait görseller `docs/` altında tutulur.

**`optionalDependencies` "isteğe bağlı indirme" anlamına gelmez.** npm bu
bağımlılıkları yine kurar, yalnızca kurulum başarısız olursa tüm kurulumu
düşürmez. `playwright-core` bu nedenle oradadır: indirmeyi azaltmak için değil,
kurulamadığı platformlarda uygulamanın Browser paneli hariç çalışmaya devam
etmesi için.

**Depo yeniden adlandırma bağlantıları kırmaz.** Ölçüldü: web isteği 301 ile
yönleniyor, `git ls-remote` eski URL ile çalışıyor, `raw.githubusercontent.com`
eski yolla 200 dönüyor. Ancak yönlendirme, eski adla yeni bir depo açılırsa
kaybolur. `package.json`'daki `repository` alanı yine de güncellenmelidir: npm,
README'deki göreli görsel yollarını o alana bakarak çözer.

---

## Yayın öncesi kontrol listesi

- [ ] `git status` temiz
- [ ] `npm run build` geçiyor
- [ ] `cd web && node scripts/contrast.mjs` çıkış kodu 0
- [ ] `npm pack --dry-run` — beklenmedik dosya yok, boyut ~1 MB
- [ ] `agents/` altında kişisel içerik yok (bu klasör pakete dahildir)
- [ ] Sürüm numarası yükseltildi
- [ ] `npm whoami` doğru hesabı gösteriyor
