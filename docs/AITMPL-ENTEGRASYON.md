# aitmpl.com (Claude Code Templates) entegrasyonu

**Kayıt tarihi:** 2026-11-25. Durum: **1. adım (skill'ler) ve 2. adım
(ajan şablonları) YAPILDI 2026-11-26**; 3 (komutlar) ve 4 (MCP) bekliyor.

> **Ölçüldü 2026-11-26: aitmpl.com Türkiye'den AÇILMIYOR.** Yerel DNS
> `www.aitmpl.com` için 213.14.227.50 (Türk Telekom) veriyor, bağlantı zaman
> aşımı; dış DNS ve DoH da engelli. Aynı dosyalar GitHub deposunda
> (`dashboard/public/api/v1/`) duruyor ve `raw.githubusercontent.com` açık.
> Kod önce aitmpl.com'u (6 sn zaman aşımı), olmazsa GitHub kopyasını dener;
> çalışan adres süreç boyunca önce denenir (yenileme 6.3 sn → 0.96 sn).
Kaynaklar: https://www.aitmpl.com/ · https://github.com/davila7/claude-code-templates
(MIT, ~34k yıldız, aktif). Aşağıdaki sayılar ve alanlar uçlar doğrudan okunarak
doğrulandı.

## Ne var

2.028 bileşen (`version.json`, 2026-11-25):

| Tür | Sayı | Claudiva için |
|---|---|---|
| skills | 948 | Evet (1. adım) |
| agents | 424 | Evet, dönüştürerek (2. adım) |
| commands | 288 | Evet, Promptlar'a (3. adım) |
| mcps | 148 | Onayla (4. adım) |
| settings | 87 | Hayır |
| hooks | 64 | Hayır |
| mods | 51 | Hayır |
| loops | 18 | Hayır |

## Kararlı uçlar (anahtar yok, CORS açık)

Site yalnız `/api/v1/` için kararlılık sözü veriyor. `components.json`,
`search-index.json` gibi diğer dosyalar haber vermeden değişebilir; kodda
KULLANMA.

- `https://www.aitmpl.com/api/v1/version.json`: `sha256`, `generatedAt`, tür başına sayı.
- `https://www.aitmpl.com/api/v1/catalog/{tür}.json`: `{ schemaVersion, generatedAt, count, components: [...] }`.
  Ölçüldü: agents 942 KB, skills 1.3 MB.
- `https://www.aitmpl.com/component-content/{tür}/{kategori}/{ad}.json`: `{ content, meta, ... }`;
  `content` dosyanın kendisi (frontmatter + gövde).
- Şema: `/api/v1/schema.json`, OpenAPI: `/openapi.json`, değişiklik günlüğü:
  depoda `docs/catalog-api/CHANGELOG.md`.
- Site, önce `version.json`'a bakıp kataloğu yalnız `sha256` değişince
  indirmeyi öneriyor. 5 dakikadan sık yoklamak bir şey kazandırmıyor.
- Site, isteklerde iletişim adresi taşıyan bir User-Agent istiyor (bkz.
  "Açık karar").

## Kayıt şekli

```
id          "agents/accessibility/accessibility-tester"   kalıcı, tekil anahtar
type, name, category, path, description
author, repo, version, license      depo içi bileşenlerde null
downloads
install     { command: "npx claude-code-templates@latest --agent <kat>/<ad>", args }
urls        { page, source (GitHub), content (component-content uç) }
files       skill dizinindeki ek dosyalar
scan        { tool: "skillspector", severity: LOW|MEDIUM|HIGH|CRITICAL, score 0-100, scannedAt }
source      dış skill'lerde { repo, path, sabitlenmiş commit, lisans }; diğerlerinde null
```

- `name` kategoriler arasında tekil DEĞİL; anahtar olarak `id` kullan.
- Skill ve mod dizin; diğer türler tek dosya.

## Dikkat edilecekler (ölçüldü)

1. **Güvenlik taraması:** 948 skill'in 81'i CRITICAL, 61'i HIGH, 199'u MEDIUM,
   607'si LOW. Site bunu kesin hüküm değil "risk ipucu" olarak sunuyor. Hook,
   MCP ve mod'lar yerelde kod çalıştırıyor; site kurmadan önce okunmasını istiyor.
2. **Lisans:** depo içindeki bileşenlerde `license` null (deponun MIT lisansı
   altında). Skill lisansları: null 711, MIT 189, "LICENSE.txt'de" 23,
   Apache-2.0 11, CC-BY-4.0 4, **Proprietary 10**. Lisans gösterilmeli,
   Proprietary olan ayrıca uyarılmalı.
3. **Ajan biçimi farklı:** aitmpl ajanı tek bir `.md` dosyası (Claude Code
   subagent: frontmatter `name`, `description`, isteğe bağlı `tools`/`model` +
   sistem istemi). Claudiva ajanı `config.json` + `personality.md` + skill'ler;
   doğrudan kopyalanamaz, dönüştürülür. `description` çoğu zaman uzun ve
   `<example>` blokları içeriyor.
4. **Skill biçimi aynı:** `SKILL.md` dizini. Depo içi yol
   `cli-tool/components/skills/<kategori>/<ad>/`; dış skill'ler
   `source.repo` + sabitlenmiş commit yolunda.

## Önerilen adımlar

### 1. Skill'ler → Skills → Keşfet'e yeni kaynak

- Altyapı hazır: Keşfet kipi, toplu kurulum, "kurulu mu" eşleşmesi
  (bkz. `server/CLAUDE.md` → "Skill katalogu").
- Bugünkü kaynaklar GitHub ağacını tarıyor; aitmpl için kaynak **katalog
  API'sinden** okunur (açıklama, kategori, indirme sayısı, tarama ve lisans
  hazır geliyor, GitHub kotası harcanmıyor).
- Rozetler: tarama sonucu (renkli), lisans, indirme sayısı. Kategori filtresi.
- **CRITICAL ve HIGH varsayılan GİZLİ**; "riskli olanları da göster" anahtarıyla
  açılır, kurulumda ayrı onay.
- Kurulum mevcut `installFromGitHub` ile: depo içi skill için
  `davila7/claude-code-templates` + `cli-tool/components/skills/<kat>/<ad>`;
  dış skill için `source.repo` + **sabitlenmiş commit** (kurulan içerik
  taranan içerikle aynı olsun; `main` değil).
- Kapsam sorusu bugünkü gibi bir kez (genel / proje / ajan).

### 2. Ajanlar → "Şablondan ajan oluştur"

- Ajan kataloğu (`AgentCatalog.tsx`) ya da ajan formuna bir seçici: kategori +
  arama + tarama rozeti.
- Dönüştürme:
  - gövde → `personality.md` (başına "kullanıcının dilinde cevap ver" satırı
    eklenir; paket ajanlarındaki kural)
  - `description`ın ilk cümlesi → ajan açıklaması (`<example>` blokları atılır)
  - `name` → ajan adı (kullanıcı değiştirebilir), id çakışırsa sonek
  - `model`: `opus`/`sonnet`/`haiku` aynen, `inherit` ya da yok → varsayılan
  - rol: `worker` (dağıtamaz; kullanıcı formda değiştirebilir)
  - `tools` listesi: Claudiva'da karşılığı yok; personality'ye not olarak
    yazılmaz, yok sayılır (yanıltmasın). Gerekirse ileride.
- Oluşturmadan önce önizleme: dönüştürülmüş ad, açıklama, model, ilk satırlar.
- Kaynak kimliği (`id`) `config.json`'a yazılır (`template: "agents/..."`),
  ileride "şablon güncellendi" kontrolü için.

### 3. Komutlar → Promptlar kütüphanesi

- 288 komut düz metin; Promptlar'a "aitmpl'den ekle" olarak alınır. Risksiz,
  ucuz. Komutun `$ARGUMENTS` gibi yer tutucuları korunur.

### 4. MCP → ajan formunda "MCP ekle" (en son)

- Çoğu API anahtarı istiyor ve kod çalıştırıyor. Eklemeden önce JSON
  yapılandırması gösterilir; ortam değişkeni alanları boş bırakılır,
  kullanıcı doldurur; açık onay.

### Alınmayacaklar

- settings, hooks, mods, loops: kullanıcının Claude Code ayarlarına ve
  makinesine dokunuyor; Claudiva'nın işi değil.

## Teknik çerçeve

- Sunucu tarafında `server/src/aitmpl.ts`: `version.json` → değiştiyse
  `catalog/{tür}.json` indir, `~/.claudiva/cache/aitmpl/` altında sakla.
  Yoklama en fazla günde bir (ya da kullanıcı "yenile" deyince).
- Panel yalnız kendi sunucusuna konuşur (yeni uçlar
  `GET /api/aitmpl/{tür}`, kurulum/oluşturma için `POST`); tarayıcıdan dış
  siteye doğrudan istek yok.
- Ağ yoksa ya da site düşükse önbellekteki katalog kullanılır, panel "son
  güncelleme: …" yazar.
- Sunucu hataları `ApiError` koduyla, panel metinleri `L.*` ile (kurallar
  `web/CLAUDE.md`, `server/CLAUDE.md`).

## Kararlar (2026-11-26, kullanıcı)

- **User-Agent:** `claudiva/<sürüm> (+https://github.com/Serdarsahinn05/claudiva/issues)`;
  sürüm kök `package.json`dan okunur. Yalnız aitmpl/katalog isteklerinde.
- Sıra: 1 (skill'ler) → 2 (ajanlar) → 3 → 4.

## 1. adımda yapılan (ölçüldü, test sunucusu 4631, scratch proje)

- Yerleşik kaynak `aitmpl.com` (`kind: 'aitmpl'`), gizlenebilir. 948 skill,
  38'i dış depoda sabit commit'le; 142 yüksek/kritik, 10 Proprietary.
- `version.json` sha256 önbellekte (`aitmplSha`); aynıysa katalog indirilmez.
  Ağ yoksa önbellekteki satırlar korunur, hata kaynağın yanında yazılır.
- Kurulum `installFromGitHub` + yeni `ref` (contents API `?ref=`); kilit
  girdisine `ref` yazılır. Depo içi (`agent-management`) ve dış
  (`illos-library` @699eaa3) kuruldu, "kurulu" rozeti döndü.
- Panel: kategori seçici, "Riskli olanları da göster" (varsayılan kapalı,
  948 → 806), tarama/lisans/indirme/sabit commit rozetleri, aitmpl sayfası
  bağlantısı. Riskli ya da özel lisanslı seçimde kurulum penceresi listeler ve
  "Okudum, yine de kur" işaretlenmeden Kur kapalı (tarayıcıda denendi).

## 2. adımda yapılan (ölçüldü, aynı test düzeni)

- Yeni ajan formunun ilk bölümü **Şablon** (`AgentTemplates.tsx`; yalnız yeni
  ajanda, düzenlemede yok: kişiliği sessizce ezerdi). Arama + kategori +
  tarama rozeti; satıra tıklamak formu doldurur ve Kimlik'e geçer. Ajan
  OLUŞTURULMAZ: form önizlemedir, kullanıcı Oluştur der.
- Uçlar: `GET /api/aitmpl/agents` (önbellek, `DATA_DIR/aitmpl-agents.json`),
  `POST /api/aitmpl/agents/refresh`, `GET /api/aitmpl/agents/draft?id=`.
  Taslak yalnız katalogdaki kimlikten üretilir; dosya yolu istemciden değil
  katalogdan gelir (`../../etc` → 400 "Template not in the catalog").
- Dönüştürme (`agentDraft`): ad `accessibility-tester` → "Accessibility Tester";
  açıklama `<example>` öncesi ilk cümle (≤220; 424'ünde `<example>` sızan 0,
  boş 2); model frontmatter'dan, yoksa `null` ve form varsayılanı (Sonnet)
  kalır (15 örnekte ham dosyayla birebir); gövde → personality + sonuna paket
  ajanlarıyla AYNI dil satırı; rol `worker`; `tools` alınmaz.
- `config.json`a `template: "agents/<kat>/<ad>"` yazılır. Aynı şablon ikinci
  kez oluşturulunca kimlik `-2` soneki alır (yalnız şablonla; elle oluşturmada
  eski hata davranışı). Ajan dosyası hep GitHub ham adresinden okunur (424'ünün
  hepsi depo içi, `source` yok).
- Katalog tazeleme 6.5 sn (aitmpl.com zaman aşımı + GitHub); 424 şablon,
  3'ü yüksek/kritik (rozet + formda uyarı; gizlenmez).
