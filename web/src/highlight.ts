/**
 * Sözdizimi renklendirme — Prism, TEMBEL yüklenir.
 *
 * Bu dosya projede bilerek alınmış bir kararı geri alıyor, o yüzden gerekçesi
 * burada duruyor. Eskiden Kod paneli renklendirmiyordu; sebep "hiçbir highlight
 * kütüphanesi taşımıyoruz, en küçüğü bile paneli paketin en büyük parçası
 * yapardı" idi. Bu ÖLÇÜLDÜ ve doğru çıkmadı (esbuild, minify + gzip):
 *
 *   Prism      (core + 21 dil)   35 KB min → 12.8 KB gzip
 *   highlight.js (core + 9 dil)  62 KB min → 19.8 KB gzip
 *   Shiki      (yalnız 4 dil)  1044 KB min →  309 KB gzip
 *   —— karşılaştırma: mevcut uygulama JS'i           129 KB gzip
 *
 * Shiki (VS Code'un TextMate gramerleri) en doğrusu ama uygulamanın tamamının
 * 2.4 katı; bir salt-okunur panel için orantısız. Prism seçildi çünkü hem en
 * küçüğü hem de burada asıl belirleyici olan şeyi yapıyor: çıktısı CSS SINIFI,
 * satır içi renk DEĞİL. Shiki hex renk basardı ve 6 tema plakasını hiç
 * dinlemezdi — Kırmızı Fener'de mavi anahtar sözcükler çıkardı, ki o plakanın
 * tek kuralı "mavi yok" (gece görüşü).
 *
 * İKİ TASARIM KARARI:
 *
 * 1. `Prism.tokenize()` kullanılıyor, `Prism.highlight()` DEĞİL. İkincisi HTML
 *    dizgesi döndürür ve `dangerouslySetInnerHTML` gerektirir. Panelin okuduğu
 *    şey diskteki rastgele dosyalar; oraya bir HTML enjeksiyon yüzeyi açmanın
 *    hiçbir gerekçesi yok. Token ağacı düzleştirilip React düğümü olarak
 *    çiziliyor — metin metin olarak kalıyor.
 *
 * 2. Prism DİNAMİK import ile geliyor. Kod paneli 12 panelden biri; açılmadığı
 *    sürece 12.8 KB'ın maliyeti sıfır. Yükleme bir kez olur ve önbelleklenir.
 */

/** Prism'in kendi tipleri; `prism-core` alt yolundan geldiği için elle daraltıldı. */
interface PrismToken {
  type: string;
  content: string | PrismToken | (string | PrismToken)[];
  alias?: string | string[];
}
interface PrismLike {
  languages: Record<string, unknown>;
  tokenize(text: string, grammar: unknown): (string | PrismToken)[];
}

/** Renklendirilmiş bir parça: metin + tek bir sınıf kovası (boş = düz metin). */
export interface Span {
  text: string;
  cls: string;
}

/**
 * Uzantı → Prism dil kimliği.
 *
 * Liste bilerek kapalı: her dil pakete bayt ekliyor ve dinamik `import()` ile
 * dil başına ayrı yığın üretmek 290 küçük yığın demek olurdu. Buradaki set bu
 * deponun kendisini (ts/tsx/css/json/md/yaml/sh) ve bir kod panelinde makul
 * sıklıkta açılacak dilleri kapsıyor. Yeni dil eklemek iki satır: aşağıdaki
 * eşleme + `load()` içindeki import.
 */
const BY_EXT: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'json',
  json5: 'json5',
  css: 'css',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
};

/** Uzantısı olmayan ama tanınan dosya adları. */
const BY_NAME: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'makefile',
  '.gitignore': 'bash',
  '.env': 'bash',
  '.npmrc': 'ini',
  '.editorconfig': 'ini',
};

/** Yol → dil kimliği; tanınmıyorsa null (düz metin çizilir). */
export function langOf(filePath: string): string | null {
  const base = filePath.split(/[/\\]/).pop()?.toLocaleLowerCase('en') ?? '';
  if (BY_NAME[base]) return BY_NAME[base];
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  return BY_EXT[base.slice(dot + 1)] ?? null;
}

/**
 * Prism token tipi → bizim sınıf kovamız.
 *
 * Prism 100'den fazla tip üretir; hepsine ayrı renk vermek hem CSS'i hem de
 * altı tema plakasını yönetilemez yapardı (ve 6 plaka × 100 renk kimsenin
 * ölçemeyeceği bir yüzey olurdu). Dokuz kova, okumayı taşıyan ayrımların
 * tamamını veriyor. Eşlenmemiş tip sınıfsız kalır — yani düz `--fg`, ki bu
 * yanlış renk vermekten iyidir.
 */
const BUCKET: Record<string, string> = {
  comment: 'com',
  prolog: 'com',
  cdata: 'com',
  doctype: 'com',
  blockquote: 'com',

  keyword: 'key',
  atrule: 'key',
  important: 'key',
  'at-rule': 'key',
  selector: 'key',
  rule: 'key',
  directive: 'key',
  'directive-hash': 'key',

  string: 'str',
  char: 'str',
  regex: 'str',
  'template-string': 'str',
  'attr-value': 'str',
  url: 'str',
  'template-punctuation': 'str',

  number: 'num',
  boolean: 'num',
  constant: 'num',
  symbol: 'num',
  unit: 'num',
  hexcode: 'num',
  color: 'num',

  function: 'fn',
  'function-variable': 'fn',
  method: 'fn',
  'function-name': 'fn',
  title: 'fn',
  bold: 'fn',

  'class-name': 'typ',
  'maybe-class-name': 'typ',
  'known-class-name': 'typ',
  builtin: 'typ',
  namespace: 'typ',
  tag: 'typ',
  'class': 'typ',
  interface: 'typ',
  generic: 'typ',

  variable: 'var',
  property: 'var',
  'attr-name': 'var',
  parameter: 'var',
  'property-access': 'var',
  'literal-property': 'var',
  key: 'var',

  operator: 'op',
  entity: 'op',
  arrow: 'op',
  spread: 'op',
  'interpolation-punctuation': 'op',

  /**
   * BOŞ dize kasıtlı ve `??` ile birlikte anlam taşıyor: boş dize nullish
   * DEĞİL, o yüzden zinciri hemen kesiyor ve miras almayı durduruyor.
   *
   * Gerekli, çünkü ölçüldü: `` `değer: ${n + 1}` `` ifadesinde üst token
   * `template-string` → 'str'. `interpolation` eşlenmemiş bırakılırsa üstünü
   * miras alır ve süslü parantezin İÇİNDEKİ kod dizge rengiyle boyanır —
   * oysa orası dizge değil, ifade.
   */
  interpolation: '',

  punctuation: 'pun',
  'script-punctuation': 'pun',

  inserted: 'ins',
  deleted: 'del',

  /**
   * Markdown ayrı bir grup çünkü ölçüm onu zayıf buldu: yalnız bu eşlemelerle
   * bir `.md` dosyasının parçalarının %61'i sınıfsız kalıyor ve üç kova
   * kullanılıyordu. Bu depoda markdown az değil (CLAUDE.md, HANDOFF.md,
   * PRODUCT.md, bütün SKILL.md'ler) — kod kadar okunuyor.
   *
   * `content` bilerek eşlenmedi: o bir SARMALAYICI (bağlantı metni, kalın
   * metnin içi). Eşlense üstünün rengini bastırırdı; miras alması doğru.
   */
  'code-snippet': 'str',
  list: 'op',
  hr: 'op',
  strike: 'com',
  italic: 'var',
  'table-header': 'fn',
  'table-line': 'pun',
};

let prism: PrismLike | null = null;
let loading: Promise<PrismLike | null> | null = null;

/**
 * Prism'i bir kez yükler.
 *
 * `window.Prism = { manual: true }` import'tan ÖNCE yazılmak zorunda:
 * `prism-core.js` kendi `manual` bayrağını `_self.Prism && _self.Prism.manual`
 * diye okuyor (satır 51) ve bayrak yoksa DOMContentLoaded'da bütün sayfayı
 * kendi kendine tarayıp `<pre><code>` bloklarını boyuyor. Bu panelde döküm,
 * terminal ve komut çıktısı da `<pre>` — Prism'i serbest bırakmak onların
 * hepsine dokunurdu.
 *
 * Diller yan etkili import'lardır ve SIRASI ÖNEMLİDİR: her biri kendinden
 * öncekini genişletiyor (typescript → javascript → clike; tsx → jsx + ts).
 */
async function load(): Promise<PrismLike | null> {
  if (prism) return prism;
  if (loading) return loading;

  loading = (async () => {
    try {
      const w = window as unknown as { Prism?: PrismLike & { manual?: boolean } };
      // Bayrak import'tan ÖNCE yazılmak zorunda (yukarıdaki not).
      w.Prism = { ...(w.Prism ?? {}), manual: true } as PrismLike & { manual: boolean };

      // Çekirdek + bütün diller tek yığında; sıralaması orada sözleşme.
      await import('./prismLangs');

      // Diller kendilerini global örneğe kaydeder, dolayısıyla doğru örnek
      // modülün dışa verdiği değil `window.Prism`dir.
      const P = w.Prism as PrismLike;
      if (!P?.tokenize) return null;

      prism = P;
      return P;
    } catch {
      // Yığın yüklenemezse panel çalışmaya DEVAM eder, yalnızca renksiz olur.
      return null;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/** Prism'i şimdiden getirir (panel açılırken çağrılır; sonucu önemsiz). */
export function preload(): void {
  void load();
}

/**
 * Token ağacını düz bir parça listesine indirir.
 *
 * Prism iç içe token üretir (`template-string` > `interpolation` > `punctuation`).
 * İç içe `<span>` çizmek yerine EN İÇTEKİ tip kazanır: göze anlam taşıyan
 * parça odur. Bir token'ın içindeki DÜZ metin ise üstünün tipini alır —
 * böylece `keyword` gibi tek parçalı token'lar rengini kaybetmez.
 */
function flatten(nodes: (string | PrismToken)[], inherited: string, out: Span[]): void {
  for (const n of nodes) {
    if (typeof n === 'string') {
      if (n) out.push({ text: n, cls: inherited });
      continue;
    }
    const alias = Array.isArray(n.alias) ? n.alias[0] : n.alias;
    const cls = BUCKET[n.type] ?? (alias ? BUCKET[alias] : undefined) ?? inherited;

    if (typeof n.content === 'string') {
      if (n.content) out.push({ text: n.content, cls });
    } else if (Array.isArray(n.content)) {
      flatten(n.content, cls, out);
    } else {
      flatten([n.content], cls, out);
    }
  }
}

/**
 * Tokenize etme maliyeti metin uzunluğuyla büyür ve ANA İŞ PARÇACIĞINI bloklar.
 * Panel zaten ilk 4000 satırı çiziyor; bunun üstüne bir bayt tavanı konuyor ki
 * tek satırlık üretilmiş bir dosya (minify edilmiş bundle, gömülü veri) paneli
 * kilitlemesin. Sınırı aşan dosya renksiz ama ANINDA açılır.
 */
const MAX_HIGHLIGHT_BYTES = 400_000;

/**
 * Metni renklendirir. Prism henüz yüklenmediyse, dil tanınmıyorsa ya da dosya
 * çok büyükse tek parçalık düz metin döner — çağıran taraf iki durumu ayırmak
 * zorunda kalmasın diye çıktı biçimi hep aynı.
 */
export function highlight(text: string, lang: string | null): Span[] {
  const plain: Span[] = [{ text, cls: '' }];
  if (!lang || !prism || text.length > MAX_HIGHLIGHT_BYTES) return plain;

  const grammar = prism.languages[lang];
  if (!grammar) return plain;

  try {
    const out: Span[] = [];
    flatten(prism.tokenize(text, grammar), '', out);
    return out.length ? out : plain;
  } catch {
    // Bozuk/yarım bir dosyada gramer patlarsa okumayı engellemesin.
    return plain;
  }
}

/** Prism yüklendi mi? (Panel yükleme bitince yeniden çizmek için sorar.) */
export function ready(): boolean {
  return prism !== null;
}

/** Yükleme bitince bir kez çağrılır; hazırsa hemen. */
export function whenReady(cb: () => void): void {
  if (prism) {
    cb();
    return;
  }
  void load().then(() => cb());
}
