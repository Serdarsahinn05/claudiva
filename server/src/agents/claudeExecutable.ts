import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Ajan oturumlarının çalıştıracağı Claude Code ikilisi.
 *
 * SDK kendi kopyasını platform paketinden (`@anthropic-ai/claude-agent-sdk-<os>-<cpu>`,
 * Windows'ta ~250 MB) arar. Masaüstü paketi bu paketi TAŞIMAZ (kurulum 447 MB →
 * ~60 MB); o zaman kullanıcının kendi kurduğu `claude` kullanılır. Sıra:
 *   1. `CLAUDIVA_CLAUDE_PATH` (elle verilen yol)
 *   2. SDK'nın kendi kopyası (varsa: sürümü SDK ile birebir uyumlu)
 *   3. Sistemdeki `claude` (PATH + bilinen kurulum yerleri)
 * Hiçbiri yoksa `missing`; oturum açılınca SDK hatası yerine anlaşılır bir
 * "Claude Code bulunamadı" mesajı gösterilir.
 */
export interface ClaudeExecutable {
  /** SDK'ya verilecek yol; `undefined` = SDK kendi kopyasını kullanır. */
  path: string | undefined;
  source: 'env' | 'bundled' | 'system' | 'missing';
}

const require = createRequire(import.meta.url);
const EXE = process.platform === 'win32' ? '.exe' : '';

function sdkPackageJson(): string | null {
  try {
    return require.resolve('@anthropic-ai/claude-agent-sdk/package.json');
  } catch {
    // Paket `package.json`u dışa aktarmıyor; giriş dosyasından yürü.
    try {
      return path.join(path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk')), 'package.json');
    } catch {
      return null;
    }
  }
}

/** SDK'nın platform paketindeki ikili (SDK'nın kendi aramasıyla aynı adlar). */
function bundledBinary(): string | null {
  const pj = sdkPackageJson();
  if (!pj) return null;
  const req = createRequire(pj);
  const base = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
  const names = process.platform === 'linux' ? [base, `${base}-musl`] : [base];
  for (const n of names) {
    try {
      const p = req.resolve(`${n}/claude${EXE}`);
      if (fs.existsSync(p)) return p;
    } catch {
      // sıradaki
    }
  }
  return null;
}

/**
 * Sistemdeki `claude`. Windows'ta npm'in global kabuğu `claude.cmd`dir ve
 * kabuksuz başlatılamaz; asıl ikili onun yanındaki paketin içinde durur.
 */
function systemBinary(): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  dirs.push(path.join(os.homedir(), '.local', 'bin')); // yerel kurulum aracı
  for (const dir of dirs) {
    const candidates = [
      path.join(dir, `claude${EXE}`),
      path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', `claude${EXE}`),
    ];
    for (const c of candidates) {
      try {
        if (fs.statSync(c).isFile()) return c;
      } catch {
        // yok
      }
    }
  }
  return null;
}

/** `2.1.332 (Claude Code)` → [2,1,332]. */
function parseVersion(s: string): number[] | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(s);
  return m ? m.slice(1, 4).map(Number) : null;
}

function older(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Sistemdeki ikili SDK'nın beklediğinden eskiyse konsola uyarı yazar. */
function warnIfOld(bin: string): void {
  try {
    const pj = sdkPackageJson();
    const want = pj ? parseVersion(JSON.parse(fs.readFileSync(pj, 'utf-8')).claudeCodeVersion ?? '') : null;
    const have = parseVersion(execFileSync(bin, ['--version'], { timeout: 10_000, encoding: 'utf-8' }));
    if (want && have && older(have, want)) {
      console.warn(
        `  Claude Code ${have.join('.')} is older than the ${want.join('.')} this build expects; ` +
          `if agents misbehave, update it (claude update).`,
      );
    }
  } catch {
    // sürüm okunamadı: oturum açılışı asıl sınavdır
  }
}

let cached: ClaudeExecutable | null = null;

export function claudeExecutable(): ClaudeExecutable {
  if (cached && cached.source !== 'missing') return cached;
  const env = process.env.CLAUDIVA_CLAUDE_PATH;
  if (env && fs.existsSync(env)) return (cached = { path: env, source: 'env' });
  if (bundledBinary()) return (cached = { path: undefined, source: 'bundled' });
  const sys = systemBinary();
  if (sys) {
    warnIfOld(sys);
    return (cached = { path: sys, source: 'system' });
  }
  // Önbelleğe alınmaz: kullanıcı Claude Code'u kurup sunucuyu kapatmadan
  // yeniden denediğinde bulunabilsin.
  return (cached = { path: undefined, source: 'missing' });
}
