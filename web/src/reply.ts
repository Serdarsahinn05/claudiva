/**
 * Sohbette bir mesaja yanıt ("alıntılı cevap").
 *
 * Yanıt ilişkisi AYRI bir yerde saklanmaz; mesaj metninin kendisinde taşınır:
 *
 *   ⟪yanıt:<öğe kimliği>⟫
 *   > Teknik Lider: 10
 *   > (alıntının devamı)
 *
 *   kullanıcının yazdığı metin
 *
 * Neden metinde: (1) ajan neye cevap verildiğini görür, alıntı ona bağlam
 * olur; (2) döküm sunucuda zaten kalıcı, yeni bir depo ya da uç gerekmez;
 * (3) sayfa yenilense de, başka tarayıcıdan açılsa da ilişki aynen geri gelir.
 * Öğe kimliği `chatFeed`in kararlı kimliğidir (`<ajan>:<olay>`, `d:<görev>`…),
 * tıklayınca o mesaja gidilir.
 */
import type { ChatItem } from './chatFeed';

const OPEN = '⟪yanıt:';
const CLOSE = '⟫';
/** Alıntının ajana giden kısmı kısa tutulur; tamamı zaten onun dökümünde. */
const QUOTE_MAX = 280;

export interface ReplyRef {
  id: string;
  author: string;
  text: string;
}

/** Bir sohbet öğesinden alıntı (yazar + kısa metin). Yanıtlanamayanlar null. */
export function quoteOf(item: ChatItem, nameOf: (id: string) => string): ReplyRef | null {
  switch (item.type) {
    case 'user':
      return { id: item.id, author: 'Sen', text: item.text };
    case 'turn':
      return {
        id: item.id,
        author: nameOf(item.agentId),
        text: item.texts.at(-1) ?? `${item.tools.length} araç kullandı`,
      };
    case 'delegation':
      return {
        id: item.id,
        author: nameOf(item.task.assignedBy),
        text: `→ ${nameOf(item.task.assignedTo)}: ${item.task.title}`,
      };
    case 'result':
      return {
        id: item.id,
        author: nameOf(item.task.assignedTo),
        text: item.task.result || item.task.title,
      };
    default:
      return null;
  }
}

function clip(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > QUOTE_MAX ? flat.slice(0, QUOTE_MAX - 1) + '…' : flat;
}

/** Ajana gidecek metin: yanıt bloğu + kullanıcının mesajı. */
export function withReply(text: string, ref: ReplyRef | null): string {
  if (!ref) return text;
  return `${OPEN}${ref.id}${CLOSE}\n> ${ref.author}: ${clip(ref.text)}\n\n${text}`;
}

/** Mesaj metnini yanıt bloğu ve asıl metin olarak ayırır. */
export function parseReply(text: string): { reply: ReplyRef | null; text: string } {
  if (!text.startsWith(OPEN)) return { reply: null, text };
  const end = text.indexOf(CLOSE);
  const nl = text.indexOf('\n');
  if (end === -1 || nl === -1 || end > nl) return { reply: null, text };
  const id = text.slice(OPEN.length, end);

  const lines = text.slice(nl + 1).split('\n');
  const quoted: string[] = [];
  let i = 0;
  for (; i < lines.length && lines[i].startsWith('>'); i++) quoted.push(lines[i].replace(/^>\s?/, ''));
  const body = lines.slice(i).join('\n').replace(/^\n+/, '');

  const first = quoted.join(' ');
  const colon = first.indexOf(': ');
  const author = colon > 0 ? first.slice(0, colon) : '';
  const quote = colon > 0 ? first.slice(colon + 2) : first;
  return { reply: { id, author, text: quote }, text: body };
}
