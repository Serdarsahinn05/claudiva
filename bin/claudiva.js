#!/usr/bin/env node
/**
 * Claudiva CLI.
 *
 *   cd D:/YeniProjem
 *   claudiva
 *
 * Ajanlar komutun çalıştırıldığı dizinde çalışır; ekip ~/.claude-manager/agents
 * altından gelir. Ortam değişkenleri sunucu import edilmeden ÖNCE ayarlanmalı,
 * çünkü paths.ts yolları modül yüklenirken çözer.
 */
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const argv = process.argv.slice(2);

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`
  Claudiva — çok ajanlı Claude Code yönetim paneli

  Kullanım:
    claudiva [seçenekler]

  Seçenekler:
    --dir <yol>     Ajanların çalışacağı proje dizini (varsayılan: bulunduğun dizin)
    --port <no>     Sunucu portu (varsayılan: 4600)
    --no-open       Tarayıcıyı otomatik açma
    -h, --help      Bu yardım

  Ekip tanımları:  ~/.claude-manager/agents
  Proje verisi:    <proje>/.claude-manager
`);
  process.exit(0);
}

const projectDir = path.resolve(flag('dir', process.cwd()));
const portGiven = argv.some((a) => a === '--port' || a.startsWith('--port='));
const wantedPort = Number(flag('port', process.env.PORT ?? '4600'));

/**
 * Port dinlemeye açık mı? (EADDRINUSE'u sunucu kalkmadan önce yakalamak için)
 *
 * Host BELİRTİLMEZ: sunucu da `listen(port)` ile çift yığın (`::`) dinliyor.
 * Probu `0.0.0.0`a bağlamak IPv6'da tutulan bir portu boş gösteriyordu.
 */
function portFree(p) {
  return new Promise((resolve) => {
    const probe = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(p);
  });
}

let port = wantedPort;
if (!(await portFree(port))) {
  if (portGiven) {
    console.error(
      `\n  Port ${port} kullanımda. Başka bir port seçin (--port 4700) ya da o portu\n` +
        `  tutan süreci kapatın.\n`
    );
    process.exit(1);
  }
  // Port belirtilmediyse sessizce bir sonraki boş porta kay — çoğu zaman bu,
  // kapanmamış eski bir claudiva süreci demek.
  let next = port;
  while (next < wantedPort + 20 && !(await portFree(next))) next++;
  if (next >= wantedPort + 20) {
    console.error(`\n  ${wantedPort}-${next} aralığında boş port bulunamadı.\n`);
    process.exit(1);
  }
  console.log(`\n  Port ${port} doluydu, ${next} kullanılıyor.`);
  port = next;
}

if (!fs.existsSync(projectDir)) {
  console.error(`Dizin bulunamadı: ${projectDir}`);
  process.exit(1);
}

const entry = path.join(ROOT, 'server', 'dist', 'index.js');
if (!fs.existsSync(entry)) {
  console.error(
    'Sunucu derlenmemiş. Paket dizininde bir kez `npm install && npm run build` çalıştır.'
  );
  process.exit(1);
}

process.env.CLAUDE_MANAGER_PROJECT = projectDir;
process.env.PORT = String(port);

const url = `http://localhost:${port}`;

if (!argv.includes('--no-open')) {
  // Sunucu dinlemeye başlayınca aç; erken açılırsa boş sayfa gelir.
  setTimeout(() => {
    const cmd =
      process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [url], { shell: process.platform === 'win32', stdio: 'ignore', detached: true }).unref();
  }, 1200);
}

await import(new URL('file://' + entry.replace(/\\/g, '/')).href);
