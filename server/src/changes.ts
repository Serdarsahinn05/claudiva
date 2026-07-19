/**
 * Dosya değişikliği atfı: hangi dosyaya hangi ajan, hangi görev sırasında dokundu.
 *
 * git "ne değişti"yi bilir ama "kim değiştirdi"yi bilmez — çalışma ağacındaki
 * değişiklikler anonimdir. Bu modül ajanların araç çağrılarını dinleyerek o
 * eksik yarıyı doldurur. İkisi `GET /api/changes`'te birleşir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PROJECT_DIR } from './paths.js';

const CHANGES_FILE = path.join(DATA_DIR, 'changes.json');

/** Dosya yazan araçlar. Read/Grep/Glob gibi salt-okunur araçlar atfa girmez. */
const WRITING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

export interface Touch {
  agentId: string;
  taskId?: string;
  ts: number;
  tool: string;
}

interface ChangesFile {
  /** proje-göreli yol → o yola yapılan son dokunuşlar (yeniden eskiye). */
  touches: Record<string, Touch[]>;
}

/** Bir dosya için tutulan dokunuş sayısı; geçmiş sonsuza kadar büyümesin. */
const MAX_TOUCHES_PER_FILE = 20;

export class ChangeLog {
  private data: ChangesFile = { touches: {} };
  private saveTimer: NodeJS.Timeout | null = null;

  init(): void {
    try {
      const raw = fs.readFileSync(CHANGES_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ChangesFile;
      if (parsed && typeof parsed === 'object' && parsed.touches) this.data = parsed;
    } catch {
      // Dosya yok ya da bozuk — boş başla, atıf kritik veri değil.
    }
  }

  /**
   * Bir tool_use olayından dosya yolu çıkarır.
   *
   * `input` transcript'e JSON olarak ve 2000 karakterde KIRPILMIŞ yazılıyor
   * (session.ts TRUNCATE_INPUT), o yüzden JSON.parse başarısız olabilir.
   * Bu durumda düz metin araması yapılır — file_path pratikte hep başta.
   */
  private extractPath(input: string | undefined): string | null {
    if (!input) return null;
    try {
      const obj = JSON.parse(input) as { file_path?: string; notebook_path?: string };
      const p = obj.file_path ?? obj.notebook_path;
      if (typeof p === 'string') return p;
    } catch {
      const m = /"(?:file_path|notebook_path)"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(input);
      if (m) {
        try {
          return JSON.parse(`"${m[1]}"`) as string;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /** Mutlak ya da göreli yolu proje-göreli, ileri eğik çizgili biçime getirir. */
  private normalize(raw: string): string | null {
    const abs = path.resolve(PROJECT_DIR, raw);
    const root = path.resolve(PROJECT_DIR);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null; // proje dışı
    return path.relative(root, abs).replace(/\\/g, '/');
  }

  /** Ajanın bir araç çağrısını kaydeder. Yazma aracı değilse yok sayılır. */
  record(agentId: string, toolName: string | undefined, input: string | undefined, taskId?: string): void {
    if (!toolName || !WRITING_TOOLS.has(toolName)) return;
    const raw = this.extractPath(input);
    if (!raw) return;
    const rel = this.normalize(raw);
    if (!rel) return;

    const list = this.data.touches[rel] ?? [];
    list.unshift({ agentId, taskId, ts: Date.now(), tool: toolName });
    this.data.touches[rel] = list.slice(0, MAX_TOUCHES_PER_FILE);
    this.persist();
  }

  /** Bir dosyaya dokunanlar (yeniden eskiye). */
  touchesFor(relPath: string): Touch[] {
    return this.data.touches[relPath] ?? [];
  }

  /** Geri alınan dosyanın geçmişi de anlamını yitirir. */
  forget(relPath: string): void {
    delete this.data.touches[relPath];
    this.persist();
  }

  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CHANGES_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch {
        // Atıf kaybı panelin çalışmasını engellemez.
      }
    }, 500);
  }
}
