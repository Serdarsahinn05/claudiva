/**
 * Prism çekirdeği + dil gramerleri — TEK yığın.
 *
 * Neden ayrı bir dosya: bu import'lar `highlight.ts` içinde tek tek
 * `await import()` olarak duruyordu ve Vite her birine AYRI yığın üretti
 * (ölçüldü: 28 dosya). Kod paneli açılınca 28 ayrı istek atılıyordu — hepsi
 * birlikte ve aynı anda gereken şeyler için anlamsız bir gecikme.
 *
 * Buradaki import'lar STATİK, dolayısıyla tek bir yığında toplanıyorlar;
 * `highlight.ts` yalnızca bu dosyayı dinamik import ediyor. Sonuç: panel
 * açılmadan 0 bayt, açılınca 1 istek.
 *
 * SIRA ÖNEMLİDİR ve tesadüf değil: dil dosyaları global `Prism`e kaydoluyor
 * ve birbirini genişletiyor (typescript → javascript → clike, tsx → jsx +
 * typescript). ESM statik import'ları bildirim sırasıyla değerlendirir, o
 * yüzden bu sıralama sözleşmedir — karıştırılırsa `Prism.languages.extend`
 * tanımsız bir gramer üstüne yazmaya çalışır.
 *
 * `prism-core` en başta: `window.Prism.manual` bayrağını okuyan o
 * (bkz. `highlight.ts`, bayrak import'tan önce yazılıyor).
 */
import 'prismjs/components/prism-core.js';

import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';

import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';

import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-json5.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-toml.js';
import 'prismjs/components/prism-ini.js';

import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-powershell.js';
import 'prismjs/components/prism-docker.js';
import 'prismjs/components/prism-makefile.js';

import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-ruby.js';
import 'prismjs/components/prism-php.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-csharp.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-diff.js';
