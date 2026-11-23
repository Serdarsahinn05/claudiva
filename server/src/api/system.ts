import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_DIR, HOME_DIR, INSTALL_ROOT } from '../paths.js';

/** Köprü ekranının gösterdiği sistem telemetrisi. */
export interface SystemInfo {
  host: {
    platform: string;
    release: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    /** Son bir dakikalık ortalama yük; Windows'ta 0 döner. */
    loadAvg: number;
    memTotal: number;
    memFree: number;
    uptimeSec: number;
    nodeVersion: string;
  };
  project: {
    dir: string;
    name: string;
    fileCount: number;
    sizeBytes: number;
    /** Tarama sınıra takıldıysa sayılar alt sınırdır. */
    truncated: boolean;
    gitBranch: string | null;
  };
  claude: {
    sdkVersion: string;
    teamDir: string;
    installRoot: string;
  };
}

/** Taramada atlanacak dizinler — büyük projelerde ölçüm dakikalar sürerdi. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache', 'target',
  'vendor', '__pycache__', '.venv', 'venv', '.claudiva', '.claude-manager', 'graphify-out',
]);

const MAX_ENTRIES = 20_000;

function walkProject(root: string): { fileCount: number; sizeBytes: number; truncated: boolean } {
  let fileCount = 0;
  let sizeBytes = 0;
  let truncated = false;
  const stack = [root];

  while (stack.length) {
    if (fileCount >= MAX_ENTRIES) {
      truncated = true;
      break;
    }
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // izin yok / kilitli
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.isDirectory() && !SKIP_DIRS.has(e.name)) continue;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(path.join(dir, e.name));
      } else if (e.isFile()) {
        fileCount++;
        try {
          sizeBytes += fs.statSync(path.join(dir, e.name)).size;
        } catch {
          // dosya bu arada silinmiş olabilir
        }
      }
    }
  }
  return { fileCount, sizeBytes, truncated };
}

/** .git/HEAD'den dal adını okur; git komutu çalıştırmadan. */
function gitBranch(root: string): string | null {
  try {
    const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf-8').trim();
    const m = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    return m ? m[1] : head.slice(0, 7); // detached HEAD
  } catch {
    return null;
  }
}

/**
 * SDK sürümü. Paket "package.json"u dışa aktarmadığı için require ile
 * okunamıyor; kurulum kökünden dosya olarak okunur.
 */
function sdkVersion(): string {
  const candidates = [
    path.join(INSTALL_ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json'),
    path.join(INSTALL_ROOT, 'server', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json'),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8')).version ?? 'bilinmiyor';
    } catch {
      // sıradakini dene
    }
  }
  return 'bilinmiyor';
}

/**
 * Proje taraması pahalı olduğu için kısa süre önbelleklenir; köprü ekranı
 * saniyede bir yenilense bile disk dövülmez.
 */
let cache: { at: number; value: SystemInfo } | null = null;
const TTL_MS = 15_000;

export function systemInfo(): SystemInfo {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const cpus = os.cpus();
  const proj = walkProject(PROJECT_DIR);

  const value: SystemInfo = {
    host: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model?.trim() ?? 'bilinmiyor',
      cpuCount: cpus.length,
      loadAvg: os.loadavg()[0] ?? 0,
      memTotal: os.totalmem(),
      memFree: os.freemem(),
      uptimeSec: os.uptime(),
      nodeVersion: process.version,
    },
    project: {
      dir: PROJECT_DIR,
      name: path.basename(PROJECT_DIR),
      fileCount: proj.fileCount,
      sizeBytes: proj.sizeBytes,
      truncated: proj.truncated,
      gitBranch: gitBranch(PROJECT_DIR),
    },
    claude: {
      sdkVersion: sdkVersion(),
      teamDir: path.join(HOME_DIR, 'agents'),
      installRoot: INSTALL_ROOT,
    },
  };

  cache = { at: Date.now(), value };
  return value;
}
