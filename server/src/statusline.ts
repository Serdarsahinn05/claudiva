import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE_USER_DIR } from './paths.js';

/**
 * Claude Code'un durum çubuğu (`statusLine`) ajan terminallerinde.
 *
 * Kullanıcının `~/.claude/settings.json` içindeki `statusLine.command`'ı,
 * Claude Code'un verdiği biçime yakın bir JSON stdin ile çalıştırılır; çıktı
 * (ANSI renkli, çok satırlı olabilir) panelde terminalin altında gösterilir.
 * Kurma ekranı YOK: Claude Code'un `/statusline` komutu kurar, biz okuruz.
 *
 * YALNIZ kullanıcı kapsamı okunur, proje `.claude/settings.json`u DEĞİL: panel
 * herhangi bir klasörde açılabiliyor; projeden gelen komutu sormadan çalıştırmak
 * depoyu açanın makinesinde kod çalıştırmak olurdu.
 */
const TIMEOUT_MS = 3000;
const MAX_OUT = 64 * 1024;

export function statusLineCommand(): string | null {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(CLAUDE_USER_DIR, 'settings.json'), 'utf-8'));
    const sl = cfg?.statusLine;
    return sl && sl.type === 'command' && typeof sl.command === 'string' && sl.command.trim() ? sl.command : null;
  } catch {
    return null;
  }
}

/** Komutu çalıştırır; çıktı yoksa, hata ya da zaman aşımında null. */
export function runStatusLine(command: string, input: object, cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    let out = '';
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    // Komut bir kabuk satırı (ör. `node "C:/…/statusline.js"`), Claude Code da
    // kabukla çalıştırır.
    const child = spawn(command, { shell: true, cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => {
      if (out.length < MAX_OUT) out += d.toString('utf-8');
    });
    child.on('error', () => finish(null));
    child.on('close', () => finish(out.trimEnd() || null));
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input));
  });
}
