/**
 * Sohbet akışı: ajan dökümlerini, görevleri ve izin isteklerini TEK bir
 * zaman sıralı mesaj listesine çevirir. Saf fonksiyonlar, React yok.
 *
 * Yeni sunucu verisi GEREKMİYOR — hepsi panelde zaten var:
 *  · ajanın sözleri ve araç çağrıları → `transcripts[agentId]`
 *  · "kim kime iş verdi"              → `Task.assignedBy` / `assignedTo` / `prompt`
 *  · "iş bitti, sonuç ne"             → `Task.status` / `Task.result`
 *  · onay bekleyen işlem              → `permissions`
 *
 * Sohbetin "konuşma" hissi buradan geliyor: bir tur (kullanıcı/görev mesajı →
 * `result`) tek balona katlanır; araç çağrıları balonun içinde "N araç"
 * altında saklanır. Döküm satır satır gösterilseydi sohbet değil terminal
 * olurdu.
 */
import type { AgentSnapshot, PermissionRequestInfo, Task, TranscriptEvent } from './types';
import { stripBrief } from './brief';
import { parseReply, type ReplyRef } from './reply';
import { L } from './i18n';

export interface ToolCall {
  name: string;
  input?: string;
  result?: string;
  isError?: boolean;
}

export type ChatItem =
  | {
      type: 'user';
      id: string;
      ts: number;
      /** Mesajın gittiği ajan. */
      agentId: string;
      text: string;
      /** Lidere ekip talimatıyla mı gitti (ekibe verilmiş iş)? */
      briefed: boolean;
      /** Bir mesaja yanıtsa alıntısı (bkz. reply.ts). */
      reply: ReplyRef | null;
    }
  | {
      type: 'turn';
      id: string;
      ts: number;
      agentId: string;
      texts: string[];
      tools: ToolCall[];
      /** Tur hâlâ sürüyor (henüz `result` gelmedi). */
      live: boolean;
      costUSD?: number;
      error?: string;
    }
  | { type: 'delegation'; id: string; ts: number; task: Task }
  | { type: 'result'; id: string; ts: number; task: Task }
  | { type: 'permission'; id: string; ts: number; agentId: string; req: PermissionRequestInfo }
  | { type: 'note'; id: string; ts: number; agentId: string; text: string; tone: 'local' | 'error' };

/** Görev kuyruğunun çalışana yazdığı mesaj — delegasyon kartının kopyası. */
const TASK_PREFIX = '# Görev (id:';

/** Bir ajanın dökümünü balonlara çevirir. */
export function itemsForAgent(agentId: string, events: TranscriptEvent[]): ChatItem[] {
  const out: ChatItem[] = [];
  let turn: Extract<ChatItem, { type: 'turn' }> | null = null;

  const openTurn = (e: TranscriptEvent) => {
    if (!turn) {
      turn = { type: 'turn', id: `${agentId}:${e.id}`, ts: e.ts, agentId, texts: [], tools: [], live: true };
      out.push(turn);
    }
    return turn;
  };
  const closeTurn = () => {
    if (turn) turn.live = false;
    turn = null;
  };

  for (const e of events) {
    switch (e.kind) {
      case 'user': {
        // Yeni bir mesaj yeni bir tur başlatır. Görev mesajı balon olarak
        // GÖSTERİLMEZ (delegasyon kartı onu zaten söylüyor) ama turu açar.
        closeTurn();
        const text = e.text ?? '';
        if (text.startsWith(TASK_PREFIX)) break;
        // Sıra önemli: brif yanıt bloğunun ALTINA eklenir, önce o kesilir.
        const { text: own, briefed } = stripBrief(text);
        const { reply, text: body } = parseReply(own);
        out.push({ type: 'user', id: `${agentId}:${e.id}`, ts: e.ts, agentId, text: body, briefed, reply });
        break;
      }
      case 'text':
        if (e.text?.trim()) openTurn(e).texts.push(e.text);
        break;
      case 'tool_use':
        openTurn(e).tools.push({ name: e.toolName ?? L.chat.tool, input: e.input });
        break;
      case 'tool_result': {
        const t = openTurn(e);
        const pending = [...t.tools].reverse().find((c) => c.result === undefined);
        if (pending) {
          pending.result = e.text ?? '';
          pending.isError = !!e.meta?.isError;
        }
        break;
      }
      case 'result': {
        const t = openTurn(e);
        // `result` metni çoğunlukla son `text`in kopyası; yalnız tur hiç
        // konuşmadıysa (yalnız araç) onu göster.
        if (!t.texts.length && e.text?.trim()) t.texts.push(e.text);
        const cost = e.meta?.costUSD;
        if (typeof cost === 'number') t.costUSD = cost;
        closeTurn();
        break;
      }
      case 'error':
        if (turn) {
          (turn as Extract<ChatItem, { type: 'turn' }>).error = e.text ?? L.chat.error;
          closeTurn();
        } else {
          out.push({ type: 'note', id: `${agentId}:${e.id}`, ts: e.ts, agentId, text: e.text ?? L.chat.error, tone: 'error' });
        }
        break;
      case 'local':
        out.push({ type: 'note', id: `${agentId}:${e.id}`, ts: e.ts, agentId, text: e.text ?? '', tone: 'local' });
        break;
      // 'thinking' ve 'system' sohbette gösterilmez (terminal görünümünde var).
    }
  }
  return out;
}

export interface FeedInput {
  /** Sohbetin katılımcıları (grup için takım, DM için tek ajan). */
  agents: AgentSnapshot[];
  transcripts: Record<string, TranscriptEvent[]>;
  tasks: Task[];
  permissions: PermissionRequestInfo[];
}

/**
 * Bir konuşmanın tüm akışı. Görev mesajları yalnız İKİ ucundan biri
 * katılımcıysa girer: grup sohbetinde takım içi delegasyonlar, DM'de o
 * ajanın verdiği ya da aldığı işler.
 */
export function buildFeed({ agents, transcripts, tasks, permissions }: FeedInput): ChatItem[] {
  const ids = new Set(agents.map((a) => a.config.id));
  const items: ChatItem[] = [];

  for (const id of ids) items.push(...itemsForAgent(id, transcripts[id] ?? []));

  for (const t of tasks) {
    // Kullanıcının panelden açtığı görev bir "konuşma" değil; o yüzden
    // yalnız ajandan ajana devirler mesaj olur.
    if (t.assignedBy === 'user') continue;
    if (!ids.has(t.assignedBy) && !ids.has(t.assignedTo)) continue;
    items.push({ type: 'delegation', id: `d:${t.id}`, ts: t.createdAt, task: t });
    if ((t.status === 'done' || t.status === 'failed') && t.finishedAt) {
      items.push({ type: 'result', id: `r:${t.id}`, ts: t.finishedAt, task: t });
    }
  }

  for (const p of permissions) {
    if (ids.has(p.agentId)) items.push({ type: 'permission', id: `p:${p.id}`, ts: p.ts, agentId: p.agentId, req: p });
  }

  // Aynı zaman damgasında sıra kararlı kalsın (React anahtarı sabit, balonlar
  // yer değiştirip zıplamasın).
  return items.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
}

/** Listede gösterilecek kısa önizleme. */
export function previewOf(item: ChatItem | undefined, nameOf: (id: string) => string): string {
  if (!item) return L.chat.noMessages;
  switch (item.type) {
    case 'user':
      return L.chat.previewYou(oneLine(item.text));
    case 'turn':
      return `${nameOf(item.agentId)}: ${oneLine(item.texts.at(-1) ?? L.chat.usedTools(item.tools.length))}`;
    case 'delegation':
      return `${nameOf(item.task.assignedBy)} → ${nameOf(item.task.assignedTo)}: ${oneLine(item.task.title)}`;
    case 'result':
      return L.chat.previewDone(nameOf(item.task.assignedTo), item.task.status === 'done', oneLine(item.task.title));
    case 'permission':
      return L.chat.previewWaiting(nameOf(item.agentId));
    case 'note':
      return oneLine(item.text);
  }
}

function oneLine(s: string): string {
  const flat = s.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? flat.slice(0, 79) + '…' : flat;
}

/** Kullanıcı dışındaki (okunacak) mesajlar — okunmamış sayacı bunları sayar. */
export function isIncoming(item: ChatItem): boolean {
  return item.type !== 'user';
}
