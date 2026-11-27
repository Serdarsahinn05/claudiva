/**
 * Masaüstü paketine girecek sunucuyu hazırlar: `desktop/build/app/`.
 *
 * İçerik npm kullanıcısının aldığıyla BİREBİR aynı (`npm pack`, kök
 * package.json'daki `files` alanı: bin, agents, server/dist, web/dist) +
 * yalnız üretim bağımlılıkları. Ayrı bir dosya listesi tutulmaz; npm'e ne
 * gidiyorsa masaüstüne de o gider.
 *
 * `tauri build` bunu `beforeBuildCommand` olarak çalıştırır
 * (`src-tauri/tauri.bundle.json`). Elle: `node scripts/prepare-app.mjs`.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(DESKTOP, '..');
const OUT = path.join(DESKTOP, 'build');
const APP = path.join(OUT, 'app');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });

// CLI `server/dist`i çalıştırır, kaynağı değil: derlemesiz paket eski sunucuyu taşır.
run('npm run build', ROOT);

const packed = execSync(`npm pack --silent --pack-destination "${OUT}"`, { cwd: ROOT })
  .toString()
  .trim()
  .split(/\r?\n/)
  .pop();
const tgz = path.join(OUT, packed);
run(`tar -xzf "${tgz}" -C "${APP}" --strip-components=1`, OUT);
fs.rmSync(tgz);

// Paketlenmiş package.json hâlâ `workspaces` taşıyor; server/ ve web/ kaynak
// klasörleri pakette olmadığı için npm install onları arayıp düşerdi.
const pkgPath = path.join(APP, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
delete pkg.workspaces;
delete pkg.devDependencies;
delete pkg.scripts;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

run('npm install --omit=dev --no-audit --no-fund --no-package-lock', APP);

// SDK'nın gömülü Claude Code ikilisi (Windows'ta ~250 MB, paketin büyük
// kısmı) taşınmaz: sunucu kullanıcının kendi `claude`unu bulur
// (server/src/agents/claudeExecutable.ts). `--omit=optional` kullanılmadı,
// çünkü başka paketlerin isteğe bağlı bağımlılıklarını da düşürürdü.
const scope = path.join(APP, 'node_modules', '@anthropic-ai');
for (const name of fs.existsSync(scope) ? fs.readdirSync(scope) : []) {
  if (name.startsWith('claude-agent-sdk-')) {
    fs.rmSync(path.join(scope, name), { recursive: true, force: true });
    console.log(`  removed bundled binary package: @anthropic-ai/${name}`);
  }
}

function size(dir) {
  let bytes = 0;
  let files = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const s = size(p);
      bytes += s.bytes;
      files += s.files;
    } else {
      bytes += fs.statSync(p).size;
      files++;
    }
  }
  return { bytes, files };
}
const s = size(APP);
console.log(`\n  desktop/build/app: ${s.files} files, ${(s.bytes / 1048576).toFixed(1)} MB\n`);
