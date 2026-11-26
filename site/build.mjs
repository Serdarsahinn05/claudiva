/**
 * Tanıtım sitesini `_site/`e toplar (GitHub Pages bunu yayımlar).
 *
 *   node site/build.mjs         # sonra: npx serve _site
 *
 * Ekran görüntüleri ve logo depoda TEK yerde durur (docs/screenshots,
 * docs/brand); burada kopyalanır, site klasöründe ikinci kopyaları tutulmaz.
 * README ile site aynı görselleri gösterir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SITE, '..');
const OUT = path.join(ROOT, '_site');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of ['index.html', 'style.css', 'main.js']) {
  fs.copyFileSync(path.join(SITE, f), path.join(OUT, f));
}
fs.cpSync(path.join(SITE, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'docs', 'screenshots'), path.join(OUT, 'assets', 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets', 'brand'), { recursive: true });
for (const f of ['claudiva-favicon.svg', 'claudiva-app-icon-1024.png']) {
  fs.copyFileSync(path.join(ROOT, 'docs', 'brand', f), path.join(OUT, 'assets', 'brand', f));
}
// Jekyll'in alt çizgili/özel dosyaları atlamasını kapat.
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log('site -> _site');
