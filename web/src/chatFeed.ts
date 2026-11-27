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
import { isTaskMessage } from './taskMessage';
import type { AgentSnapshot, PermissionRequestInfo, Task, TranscriptEvent } from './types';
import { stripBrief } from './brief';
import { readConvTag } from './convTag';
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


/**
 * Bir öğenin ait olduğu sohbet: `dm:<ajan>`, `group:<anahtar>`, `group:*`
 * (etiketsiz eski brif: her grup) ya da `*` (bilinmiyor: her yer).
 */
type Conv = string;

/**
 * Dökümde bir kullanıcı/görev mesajıyla başlayan dilim. Ajanın cevabı ve o
 * sırada verdiği görevler dilimin sohbetine aittir. Görev mesajının sohbeti
 * görevi verenin o anki diliminden gelir (zincir boyunca çözülür).
 */
interface Seg {
  ts: number;
  conv?: Conv;
  taskId?: string;
}

const TASK_ID = /^# (?:Task|Görev) \(id: ([^)\s]+)\)/;

function userConv(agentId: string, text: string): Seg['conv'] | { taskId: string } {
  if (isTaskMessage(text)) {
    const id = TASK_ID.exec(text)?.[1];
    return id ? { taskId: id } : '*';
  }
  const { text: rest, group } = readConvTag(text);
  if (group !== null) return `group:${group}`;
  return stripBrief(rest).briefed ? 'group:*' : `dm:${agentId}`;
}

/** Bir ajanın dökümünü balonlara çevirir. */
export function itemsForAgent(agentId: string, events: TranscriptEvent[]): ChatItem[] {
  return parsedAgent(agentId, events).items;
}

function parseAgent(agentId: string, events: TranscriptEvent[]) {
  const out: ChatItem[] = [];
  const segs: Seg[] = [];
  const segOf = new Map<ChatItem, Seg>();
  let seg: Seg | null = null;
  const push = (item: ChatItem) => {
    out.push(item);
    if (seg) segOf.set(item, seg);
  };
  let turn: Extract<ChatItem, { type: 'turn' }> | null = null;

  const openTurn = (e: TranscriptEvent) => {
    if (!turn) {
      turn = { type: 'turn', id: `${agentId}:${e.id}`, ts: e.ts, agentId, texts: [], tools: [], live: true };
      push(turn);
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
        const c = userConv(agentId, text);
        seg = typeof c === 'string' ? { ts: e.ts, conv: c } : { ts: e.ts, taskId: c?.taskId };
        segs.push(seg);
        // Görev kuyruğunun çalışana yazdığı mesaj — delegasyon kartının kopyası.
        if (isTaskMessage(text)) break;
        // Sıra önemli: sohbet etiketi en sonda, brif yanıt bloğunun ALTINDA;
        // önce etiket, sonra brif, en son yanıt bloğu kesilir.
        const { text: own, briefed } = stripBrief(readConvTag(text).text);
        const { reply, text: body } = parseReply(own);
        push({ type: 'user', id: `${agentId}:${e.id}`, ts: e.ts, agentId, text: body, briefed, reply });
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
          push({ type: 'note', id: `${agentId}:${e.id}`, ts: e.ts, agentId, text: e.text ?? L.chat.error, tone: 'error' });
        }
        break;
      case 'local':
        push({ type: 'note', id: `${agentId}:${e.id}`, ts: e.ts, agentId, text: e.text ?? '', tone: 'local' });
        break;
      // 'thinking' ve 'system' sohbette gösterilmez (terminal görünümünde var).
    }
  }
  return { items: out, segs, segOf };
}

/**
 * Ayrıştırma döküm dizisine göre önbellekli: sohbet kabuğu her grup ve her
 * ajan için ayrı akış kuruyor, görev sohbeti de başka ajanların dökümüne
 * bakıyor. Store dökümü değişince yeni dizi verir, önbellek kendiliğinden düşer.
 */
const parseCache = new WeakMap<TranscriptEvent[], Map<string, ReturnType<typeof parseAgent>>>();
const EMPTY: TranscriptEvent[] = [];

function parsedAgent(id: string, events: TranscriptEvent[] = EMPTY) {
  let byAgent = parseCache.get(events);
  if (!byAgent) parseCache.set(events, (byAgent = new Map()));
  let p = byAgent.get(id);
  if (!p) byAgent.set(id, (p = parseAgent(id, events)));
  return p;
}

/** Bütün dökümlerden sohbet çözücüsü: öğe, görev ve an → sohbet. */
function convResolver(transcripts: Record<string, TranscriptEvent[]>, tasks: Task[]) {
  const get = (id: string) => parsedAgent(id, transcripts[id]);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, Conv>();

  /** Ajanın `ts` anındaki dilimi (son kullanıcı/görev mesajı). */
  const segAt = (agentId: string, ts: number): Seg | null => {
    const segs = get(agentId).segs;
    let found: Seg | null = null;
    for (const s of segs) {
      if (s.ts > ts) break;
      found = s;
    }
    return found;
  };
  const ofSeg = (s: Seg | null | undefined, depth: number): Conv => {
    if (!s) return '*';
    if (s.conv) return s.conv;
    return s.taskId ? ofTask(s.taskId, depth + 1) : '*';
  };
  // Panelden kullanıcının açtığı görev bir sohbete ait değil: her yerde görünür.
  const ofTask = (taskId: string, depth = 0): Conv => {
    const hit = memo.get(taskId);
    if (hit) return hit;
    const t = byId.get(taskId);
    const conv = !t || t.assignedBy === 'user' || depth > 20 ? '*' : ofSeg(segAt(t.assignedBy, t.createdAt), depth);
    memo.set(taskId, conv);
    return conv;
  };
  return {
    agent: get,
    ofItem: (agentId: string, item: ChatItem) => ofSeg(get(agentId).segOf.get(item), 0),
    ofTask,
    at: (agentId: string, ts: number) => ofSeg(segAt(agentId, ts), 0),
  };
}

/**
 * Sohbet kapsamı. Verilmezse süzme yok (Pano'nun "son mesajlar"ı).
 * `groups`: şu an var olan grup anahtarları; artık olmayan bir gruba
 * (takım silindi/adı değişti) yazılmış mesaj kaybolmasın, her grupta görünür.
 */
export type FeedScope = { kind: 'group'; key: string; groups: ReadonlySet<string> } | { kind: 'dm'; id: string };

function inScope(conv: Conv, scope: FeedScope | undefined): boolean {
  if (!scope || conv === '*') return true;
  if (scope.kind === 'dm') return conv === `dm:${scope.id}`;
  if (!conv.startsWith('group:')) return false;
  const key = conv.slice('group:'.length);
  return key === '*' || key === scope.key || !scope.groups.has(key);
}

export interface FeedInput {
  /** Sohbetin katılımcıları (grup için takım, DM için tek ajan). */
  agents: AgentSnapshot[];
  transcripts: Record<string, TranscriptEvent[]>;
  tasks: Task[];
  permissions: PermissionRequestInfo[];
  /** Hangi sohbetin akışı (bkz. convTag.ts). Yoksa katılımcıların her şeyi. */
  scope?: FeedScope;
}

/**
 * Bir konuşmanın tüm akışı. Görev mesajları yalnız İKİ ucundan biri
 * katılımcıysa girer: grup sohbetinde takım içi delegasyonlar, DM'de o
 * ajanın verdiği ya da aldığı işler. `scope` verilince her öğe ait olduğu
 * sohbete göre süzülür: özel mesaj gruplarda, ekip işi özel sohbette görünmez.
 */
export function buildFeed({ agents, transcripts, tasks, permissions, scope }: FeedInput): ChatItem[] {
  const ids = new Set(agents.map((a) => a.config.id));
  const conv = convResolver(transcripts, tasks);
  const items: ChatItem[] = [];

  for (const id of ids) {
    for (const item of conv.agent(id).items) if (inScope(conv.ofItem(id, item), scope)) items.push(item);
  }

  for (const t of tasks) {
    // Kullanıcının panelden açtığı görev bir "konuşma" değil; o yüzden
    // yalnız ajandan ajana devirler mesaj olur.
    if (t.assignedBy === 'user') continue;
    if (!ids.has(t.assignedBy) && !ids.has(t.assignedTo)) continue;
    if (!inScope(conv.ofTask(t.id), scope)) continue;
    items.push({ type: 'delegation', id: `d:${t.id}`, ts: t.createdAt, task: t });
    if ((t.status === 'done' || t.status === 'failed') && t.finishedAt) {
      items.push({ type: 'result', id: `r:${t.id}`, ts: t.finishedAt, task: t });
    }
  }

  for (const p of permissions) {
    if (!ids.has(p.agentId) || !inScope(conv.at(p.agentId, p.ts), scope)) continue;
    items.push({ type: 'permission', id: `p:${p.id}`, ts: p.ts, agentId: p.agentId, req: p });
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
