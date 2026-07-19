/**
 * Oturum sürekliliği deposu.
 *
 * İki ayrı şeyi kalıcı kılar, ikisi de sunucu yeniden başlayınca gerekir:
 *
 *  1. **sessionId** — SDK'ya `resume` olarak geri verilir, model konuşmayı
 *     hatırlar. Proje bazlı tutulur (`DATA_DIR`), çünkü SDK oturum geçmişini
 *     cwd'ye göre saklıyor (`~/.claude/projects/<cwd>/<sid>.jsonl`). Ajan
 *     tanımları global; aynı ajan iki ayrı projede ayrı oturum yürütür.
 *
 *  2. **transcript** — panelin gördüğü olay dökümü. SDK'nın kendi JSONL'i
 *     kullanılmaz: belgelenmemiş iç format ve panelin ürettiği `local`
 *     olaylarını (ör. /usage çıktısı) içermiyor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';
import type { TranscriptEvent } from '../types.js';

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const TRANSCRIPT_DIR = path.join(DATA_DIR, 'transcripts');

/** Panelde tutulan olay sayısıyla aynı olmalı (session.ts MAX_TRANSCRIPT). */
const KEEP_EVENTS = 500;
/** Bu satır sayısını aşınca dosya son KEEP_EVENTS satırla yeniden yazılır. */
const COMPACT_AT = KEEP_EVENTS * 3;

interface SessionRecord {
  sessionId: string;
  updatedAt: string;
}

export class SessionStore {
  private ids: Record<string, SessionRecord> = {};
  private saveTimer: NodeJS.Timeout | null = null;
  /** Ajan başına yazılmayı bekleyen satırlar; syscall fırtınasını önler. */
  private buffers = new Map<string, string[]>();
  private flushTimer: NodeJS.Timeout | null = null;

  init(): void {
    try {
      this.ids = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as Record<string, SessionRecord>;
    } catch {
      this.ids = {}; // yok ya da bozuk — sıfırdan başla, kritik veri değil
    }
    fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  }

  // ------------------------------------------------------------ sessionId

  getSessionId(agentId: string): string | undefined {
    return this.ids[agentId]?.sessionId;
  }

  setSessionId(agentId: string, sessionId: string): void {
    const cur = this.ids[agentId];
    if (cur?.sessionId === sessionId) return;
    this.ids[agentId] = { sessionId, updatedAt: new Date().toISOString() };
    this.persistIds();
  }

  /** Resume başarısız olduğunda çağrılır: bozuk id bir daha denenmesin. */
  clearSessionId(agentId: string): void {
    if (!this.ids[agentId]) return;
    delete this.ids[agentId];
    this.persistIds();
  }

  private persistIds(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(this.ids, null, 2), 'utf-8');
      } catch {
        // Kayıp olursa yalnızca "hatırlama" özelliği kaybolur, panel çalışır.
      }
    }, 300);
  }

  // ----------------------------------------------------------- transcript

  private fileFor(agentId: string): string {
    // Ajan id'leri slug (a-z0-9-) ama yine de yol ayracı sızmasın.
    return path.join(TRANSCRIPT_DIR, `${agentId.replace(/[^a-zA-Z0-9çğıöşü_-]/gi, '_')}.jsonl`);
  }

  appendEvent(agentId: string, event: TranscriptEvent): void {
    const buf = this.buffers.get(agentId) ?? [];
    buf.push(JSON.stringify(event));
    this.buffers.set(agentId, buf);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 300);
  }

  /** Kapanışta çağrılır; tamponda kalanı kaybetmemek için. */
  flush(): void {
    for (const [agentId, lines] of this.buffers) {
      if (!lines.length) continue;
      try {
        fs.appendFileSync(this.fileFor(agentId), lines.join('\n') + '\n', 'utf-8');
      } catch {
        // yazılamadıysa bu partiyi düşür; sonraki olaylar yine denenecek
      }
    }
    this.buffers.clear();
  }

  /**
   * Son olayları okur. Bozuk (yarım yazılmış) satırlar sessizce atlanır —
   * append sırasında süreç ölürse son satır eksik kalabilir.
   */
  loadTranscript(agentId: string): TranscriptEvent[] {
    const file = this.fileFor(agentId);
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf-8');
    } catch {
      return [];
    }
    const lines = raw.split('\n').filter((l) => l.trim());
    const events: TranscriptEvent[] = [];
    for (const line of lines.slice(-KEEP_EVENTS)) {
      try {
        events.push(JSON.parse(line) as TranscriptEvent);
      } catch {
        // yarım satır
      }
    }
    // Dosya şişmişse sadeleştir; sonsuza kadar büyümesin.
    if (lines.length > COMPACT_AT) {
      try {
        fs.writeFileSync(file, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
      } catch {
        // sadeleştirme başarısız olsa da okuma çalıştı
      }
    }
    return events;
  }

  clearTranscript(agentId: string): void {
    this.buffers.delete(agentId);
    try {
      fs.rmSync(this.fileFor(agentId), { force: true });
    } catch {
      // dosya yoksa sorun değil
    }
  }
}
