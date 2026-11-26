# Claudiva logosu: Çekirdek

Dışta ekibin çerçevesi (sivri tepeli altıgen), içte 30° dönük dolu altıgen,
yani lider. Dönüş farkı iki katmanı ayırır: ekip lideri sarar, lider ekibin
içinde ama ondan farklı duruşta.

Harf içermez (kullanıcı kararı, 2026-11-26). Seçilen konsept üç altıgen
konseptinden biri; diğerleri (Hücre, Kovan) ve elenen yönler (yörünge, örgü,
gözlemevi, formasyon) bu klasörde tutulmuyor.

## Dosyalar

| Dosya | Ne zaman |
|---|---|
| `claudiva-mark-dark.svg` | **Ana sürüm.** Koyu zeminde: turkuaz halka, açık çekirdek |
| `claudiva-mark-light.svg` | Açık zeminde: yeşil halka, mürekkep çekirdek |
| `claudiva-mark-black.svg` / `-white.svg` | Tek renk baskı, kabartma, çıkartma |
| `claudiva-mark-small-dark.svg` | 16-32 px: kalın halka, büyük çekirdek |
| `claudiva-app-icon.svg` / `-1024.png` | Uygulama simgesi (koyu karo); Tauri simgeleri bundan |
| `claudiva-favicon.svg` | Tarayıcı sekmesi (`web/public/favicon.svg` bunun kopyası) |
| `build-logo.py` | Hepsini üretir: `python docs/brand/build-logo.py` |

**Uygulamada nerede:** Tauri simgeleri (`desktop/src-tauri/icons/`), favicon,
açılış ekranı (`desktop/launcher/index.html`, satır içi) ve panelin üst
çubuğu (`web/src/components/BrandMark.tsx`). Son ikisi küçük çizimi kullanır
ve renklerini paletten alır: halka `--accent`, çekirdek `--fg`. Yani panelde
işaret seçili stilin vurgusunu taşır (Cam turkuaz/yeşil, Gözlemevi camgöbeği,
Stüdyo mor, Fosfor limon); marka rengi sabit olan yerler simge ve favicon.

Logo değişirse: betiği çalıştır, `web/public/favicon.svg`ı kopyala, 1024 PNG'yi
yeniden üret ve `cd desktop && npx tauri icon ../docs/brand/claudiva-app-icon-1024.png`
(oluşan `android/`, `ios/` klasörlerini sil). Açılış ekranındaki satır içi SVG
(`desktop/launcher/index.html`) ve `BrandMark.tsx` küçük çizimin yollarını
taşır; ikisini de güncelle.

## Renkler

Panelin Cam stilinden (`web/src/themes.css`), ayrı bir marka paleti yok.

| Ad | HEX | Kaynak |
|---|---|---|
| Turkuaz (halka, koyu zemin) | `#3EE0C0` | grove `--accent` |
| Açık (çekirdek, koyu zemin) | `#E8F3EF` | grove `--fg` |
| Karo | `#0D1B17` | grove `--surface` |
| Yeşil (halka, açık zemin) | `#0A7852` | mist `--accent` |
| Mürekkep (çekirdek, açık zemin) | `#121A1C` | mist `--fg` |

Turkuaz açık zeminde metin/işaret olarak OKUNMAZ (yaklaşık 1,6:1); açık
zeminde her zaman yeşil sürüm.

## Kurallar

- **Boşluk:** işaretin çevresinde en az halka kalınlığının iki katı boş alan.
- **En küçük boyut:** 16 px (yalnız küçük çizimle); standart çizim 48 px ve üstü.
- **Yapma:** halkayı ve çekirdeği aynı açıya çevirme (iki katman ayrımı kaybolur,
  somun gibi okunur); çekirdeği halkaya değdirme; gölge, degrade, kontur ekleme;
  renkleri yer değiştirme (çekirdek turkuaz, halka beyaz değil).
- Halka altı parçaya bölünmez; o ayrı bir konseptti (Hücre).

## Bilinen risk

Altıgen içinde altıgen, somun ya da cıvata başına benzetilebilir. 30° dönüş ve
iki renk bunu azaltır. Marka tescil araştırması yapılmadı.
