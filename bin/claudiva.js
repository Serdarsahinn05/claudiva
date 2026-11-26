#!/usr/bin/env node
/**
 * Claudiva CLI.
 *
 *   cd D:/YeniProjem
 *   claudiva
 *
 * Ajanlar komutun çalıştırıldığı dizinde çalışır; ekip ~/.claudiva/agents
 * altından gelir. Ortam değişkenleri sunucu import edilmeden ÖNCE ayarlanmalı,
 * çünkü paths.ts yolları modül yüklenirken çözer.
 *
 * Dil: sunucudaki `server/src/i18n.ts` ile AYNI kural (LC_ALL/LANG, yoksa
 * Intl). Bu dosya derlenmeden çalıştığı için o modülü içe aktaramaz.
 */
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const argv = process.argv.slice(2);

function detectLocale() {
  let tag = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '';
  if (!tag) {
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      tag = '';
    }
  }
  return tag.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const T = {
  tr: {
    help: `
  Claudiva — çok ajanlı Claude Code yönetim paneli

  Kullanım:
    claudiva [seçenekler]

  Seçenekler:
    --dir <yol>     Ajanların çalışacağı proje dizini (varsayılan: bulunduğun dizin)
    --port <no>     Sunucu portu (varsayılan: 4600)
    --no-open       Tarayıcıyı otomatik açma
    -h, --help      Bu yardım

  Ekip tanımları:  ~/.claudiva/agents   (eski ~/.claude-manager açılışta taşınır)
  Proje verisi:    <proje>/.claudiva
`,
    portBusy: (p) =>
      `\n  Port ${p} kullanımda. Başka bir port seçin (--port 4700) ya da o portu\n  tutan süreci kapatın.\n`,
    noFreePort: (a, b) => `\n  ${a}-${b} aralığında boş port bulunamadı.\n`,
    portMoved: (p, n) => `\n  Port ${p} doluydu, ${n} kullanılıyor.`,
    noDir: (d) => `Dizin bulunamadı: ${d}`,
    notBuilt: 'Sunucu derlenmemiş. Paket dizininde bir kez `npm install && npm run build` çalıştır.',
  },
  en: {
    help: `
  Claudiva — multi-agent control panel for Claude Code

  Usage:
    claudiva [options]

  Options:
    --dir <path>    Project directory the agents work in (default: the current one)
    --port <n>      Server port (default: 4600)
    --no-open       Don't open the browser
    -h, --help      This help

  Team definitions:  ~/.claudiva/agents   (an old ~/.claude-manager is moved on startup)
  Project data:      <project>/.claudiva
`,
    portBusy: (p) =>
      `\n  Port ${p} is in use. Pick another port (--port 4700) or stop the process\n  holding it.\n`,
    noFreePort: (a, b) => `\n  No free port found between ${a} and ${b}.\n`,
    portMoved: (p, n) => `\n  Port ${p} was taken, using ${n}.`,
    noDir: (d) => `Directory not found: ${d}`,
    notBuilt: 'The server is not built. Run `npm install && npm run build` once in the package directory.',
  },
}[detectLocale()];

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(T.help);
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
    console.error(T.portBusy(port));
    process.exit(1);
  }
  // Port belirtilmediyse sessizce bir sonraki boş porta kay — çoğu zaman bu,
  // kapanmamış eski bir claudiva süreci demek.
  let next = port;
  while (next < wantedPort + 20 && !(await portFree(next))) next++;
  if (next >= wantedPort + 20) {
    console.error(T.noFreePort(wantedPort, next));
    process.exit(1);
  }
  console.log(T.portMoved(port, next));
  port = next;
}

if (!fs.existsSync(projectDir)) {
  console.error(T.noDir(projectDir));
  process.exit(1);
}

const entry = path.join(ROOT, 'server', 'dist', 'index.js');
if (!fs.existsSync(entry)) {
  console.error(T.notBuilt);
  process.exit(1);
}

process.env.CLAUDIVA_PROJECT = projectDir;
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

// Masaüstü kabuğu (desktop/) sunucuyu stdin borusuyla başlatır ve kapatmak
// için boruyu kapatır: Windows'ta alt sürece SIGINT gönderilemiyor, zorla
// öldürmek de tamponlanmış yazımları (görevler, döküm) kaybettirir. Kabuk
// çökerse de boru kapanır; sunucu öksüz kalmaz. `emit`, sunucunun kendi
// SIGINT dinleyicisini (düzgün kapanış) çağırır.
if (process.env.CLAUDIVA_DESKTOP === '1') {
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    process.emit('SIGINT');
  };
  process.stdin.on('end', close);
  process.stdin.on('error', close);
  process.stdin.resume();
}

await import(new URL('file://' + entry.replace(/\\/g, '/')).href);
