/**
 * Plaka kontrast ölçer.
 *
 * PRODUCT.md'deki eşikler göz kararıyla değil ÖLÇÜLEREK doğrulanır:
 *   fg ≥ 7:1 · muted ≥ 4.5:1 · dim/accent/ok/warn/err/aux ≥ 3:1
 * Ölçüm yüzeyi plaka gövdesidir (--surface-rgb), en dış zemin değil:
 * metin çoğunlukla plakanın üstünde durur. Zemin (--bg-rgb) ikinci
 * ölçüm olarak raporlanır — yıldız listesi ve indeks orada yaşıyor.
 *
 * Çalıştır:  node scripts/contrast.mjs
 * Çıkış kodu 1 → en az bir eşik tutmuyor.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const THRESHOLDS = {
  fg: 7,
  muted: 4.5,
  dim: 3,
  accent: 3,
  ok: 3,
  warn: 3,
  err: 3,
  aux: 3,
};

/**
 * Sözdizimi kovaları (Kod paneli) — AYRI ölçülür, çünkü zemini ayrı.
 *
 * Arayüz metni plakanın üstünde durur (--surface); kod gövdesi ekranın
 * içindedir (--void). İkisi aynı plakada bile farklı parlaklıkta, o yüzden
 * arayüz ölçümünden geçmiş bir renk burada düşebilir.
 *
 * Eşik 4.5 ve hepsi için aynı: bunların hiçbiri dekoratif değil, dokuzu da
 * OKUNAN metin. 3:1 (büyük/grafik eşiği) 12px mono için yanlış eşik olurdu.
 */
const SYNTAX_MIN = 4.5;
const SYNTAX_ROLES = [
  'syn-com',
  'syn-key',
  'syn-str',
  'syn-num',
  'syn-fn',
  'syn-typ',
  'syn-var',
  'syn-op',
  'syn-pun',
];

/** `--foo-rgb: 1 2 3;` çiftlerini bir blok metninden toplar. */
function tokensIn(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)-rgb:\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*;/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

/**
 * Bir seçicinin BÜTÜN bloklarını okur ve token'larını belge sırasıyla birleştirir.
 *
 * Aynı seçici birden fazla blokta geçebilir: premium plakalar önce ortak bir
 * listede ("obsidian, carbon, aurora { … }"), sonra kendi bloklarında görünür.
 * İlk eşleşmeyi almak YANLIŞ SONUÇ VERİR ve sessizce verir — aurora ölçümü bir
 * kez "gece" değerlerini raporlayıp yine de "tüm eşikler tutuyor" dedi.
 *
 * Eskiden buna karşı EN ÇOK renk token'ı taşıyan blok seçiliyordu. Bu da
 * yetmiyor ve neden yetmediği ölçüldü: ortak bloğa sözdizimi kanalları
 * eklendiğinde o blokta 9, plakanın kendi bloğunda 15 token oluyor; "en çok"
 * kuralı plakanın bloğunu seçip ORTAK bloktaki 9 kanalı tümüyle düşürüyor.
 * Aynı sessiz düşüş, sadece başka kapıdan.
 *
 * Doğrusu seçmek değil BİRLEŞTİRMEK: CSS'in kendi kuralı da bu. `indexOf`
 * belge sırasıyla ilerlediği için sonraki blok öncekini ezer — tarayıcıda ne
 * oluyorsa ölçümde de o oluyor.
 */
function tokensForSelector(css, selectorFragment) {
  const merged = {};
  for (let i = css.indexOf(selectorFragment); i !== -1; i = css.indexOf(selectorFragment, i + 1)) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const close = css.indexOf('\n}', open);
    Object.assign(merged, tokensIn(css.slice(open, close === -1 ? undefined : close)));
  }
  return merged;
}

function relLum([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const indexCss = readFileSync(join(src, 'index.css'), 'utf8');
const themesCss = readFileSync(join(src, 'themes.css'), 'utf8');

const base = tokensForSelector(indexCss, ":root, [data-theme='night']");

/**
 * Bir plakanın kendi renklerini gerçekten bulduğumuzu doğrular.
 *
 * Sessiz düşüş bu betiğin en tehlikeli hata biçimi: blok bulunamazsa plaka
 * `base`e (gece) düşer, ölçüm YAPILIR ve "tüm eşikler tutuyor" der — oysa
 * ölçülen şey o plaka değildir. Bir kez tam olarak bu oldu (aurora). Renk
 * ezmesi olmayan bir plaka tanımı anlamsız olduğuna göre, boş bir sonuç
 * hatadır.
 */
function plate(name, css, selector) {
  const own = tokensForSelector(css, selector);
  if (Object.keys(own).length === 0) {
    console.error(`\nHATA: "${name}" plakasının renk bloğu bulunamadı (${selector}).`);
    process.exit(2);
  }
  return [name, { ...base, ...own }];
}
const plates = [
  ['night', base],
  plate('redlight', themesCss, "[data-theme='redlight']"),
  plate('day', themesCss, "[data-theme='day']"),
  // Premium aile — aynı eşikler geçerli, ayrıcalık yok.
  plate('obsidian', themesCss, "[data-theme='obsidian']"),
  plate('carbon', themesCss, "[data-theme='carbon']"),
  plate('aurora', themesCss, "[data-theme='aurora']"),
];

let failed = 0;
for (const [name, t] of plates) {
  console.log(`\n── ${name} ────────────────────────────────`);
  for (const ground of ['surface', 'bg']) {
    const groundRgb = t[ground];
    if (!groundRgb) {
      console.log(`  (${ground} tanımsız)`);
      continue;
    }
    console.log(`  zemin: --${ground}-rgb ${groundRgb.join(' ')}`);
    for (const [role, min] of Object.entries(THRESHOLDS)) {
      const rgb = t[role];
      if (!rgb) {
        console.log(`    ${role.padEnd(7)} —  (tanımsız)`);
        continue;
      }
      const r = ratio(rgb, groundRgb);
      const ok = r >= min;
      if (!ok) failed++;
      console.log(
        `    ${role.padEnd(7)} ${r.toFixed(2).padStart(6)}:1  eşik ${String(min).padStart(3)}  ${ok ? 'ok' : 'DÜŞÜK'}`,
      );
    }
  }

  // Sözdizimi: zemin --void (kod gövdesinin altı), arayüz zeminleri değil.
  const voidRgb = t['void'];
  if (!voidRgb) {
    console.log('  (void tanımsız — sözdizimi ölçülemedi)');
    continue;
  }
  console.log(`  zemin: --void-rgb ${voidRgb.join(' ')}  (kod gövdesi)`);
  for (const role of SYNTAX_ROLES) {
    const rgb = t[role];
    if (!rgb) {
      console.error(`    ${role.padEnd(7)} —  TANIMSIZ`);
      failed++;
      continue;
    }
    const r = ratio(rgb, voidRgb);
    const ok = r >= SYNTAX_MIN;
    if (!ok) failed++;
    console.log(
      `    ${role.padEnd(7)} ${r.toFixed(2).padStart(6)}:1  eşik ${SYNTAX_MIN}  ${ok ? 'ok' : 'DÜŞÜK'}`,
    );
  }
}

console.log(
  failed === 0
    ? '\nTüm eşikler tutuyor.\n'
    : `\n${failed} ölçüm eşiğin altında.\n`,
);
process.exit(failed === 0 ? 0 : 1);
