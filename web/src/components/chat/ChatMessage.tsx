/**
 * Sohbet akışındaki tek bir öğe.
 *
 * Görsel dil panelin kendisi (tema token'ları, plaka kenarları); bir mesaj
 * uygulamasının yeşil balonları DEĞİL. Sohbet hissi biçimden geliyor:
 * gönderen başlığı, sağa yaslı "sen" balonu, gün ayıracı, katlanan araçlar.
 */
import { useState, type ReactNode } from 'react';
import type { AgentSnapshot } from '../../types';
import type { ChatItem, ToolCall } from '../../chatFeed';
import { ROLE_LABEL, fmtCost } from '../../format';
import { clock, initials, inlineParts } from './chatFormat';
import { answerPermission, permissionSummary, PERMISSION_OPTIONS, type PermissionChoice } from '../../permissions';

export function Avatar({ agent, size = 'md' }: { agent: AgentSnapshot | undefined; size?: 'sm' | 'md' }) {
  const name = agent?.config.name ?? '?';
  return (
    <span className={`cm-avatar cm-avatar-${size}`} data-role={agent?.config.role} aria-hidden>
      {initials(name)}
      {agent && <span className={`led led-${agent.status}`} />}
    </span>
  );
}

interface Props {
  item: ChatItem;
  byId: Map<string, AgentSnapshot>;
  /** Grup sohbetinde mesajın lidere değil başka birine gittiğini belirtmek için. */
  leadId?: string;
  /** Aynı göndericinin art arda gelen mesajı: başlık tekrarlanmaz. */
  continued: boolean;
  /** Bu mesajı yanıtla (alıntı composer'a geçer). Yoksa düğme çizilmez. */
  onReply?: (item: ChatItem) => void;
  /** Alıntıya tıklanınca yanıtlanan mesaja git. */
  onJump?: (id: string) => void;
}

/** Balonun köşesindeki "Yanıtla" düğmesi; klavyeyle de erişilir. */
function ReplyBtn({ item, onReply }: { item: ChatItem; onReply?: (item: ChatItem) => void }) {
  if (!onReply) return null;
  return (
    <button className="cm-reply-btn" onClick={() => onReply(item)} title="Bu mesajı yanıtla" aria-label="Yanıtla">
      ↩
    </button>
  );
}

/** Yanıtlanan mesajın alıntısı; tıklayınca o mesaja kaydırır. */
export function Quote({
  author,
  text,
  onClick,
  mine,
}: {
  author: string;
  text: string;
  onClick?: () => void;
  mine?: boolean;
}) {
  const body = (
    <>
      <span className="cm-quote-author">{author || 'Mesaj'}</span>
      <span className="cm-quote-text">{text}</span>
    </>
  );
  // Tıklanamayan alıntı (composer'daki önizleme) düğme DEĞİL: `disabled`
  // düğme genel kuralla soluklaşıyor ve yanıt şeridi okunmuyordu.
  if (!onClick) return <div className={`cm-quote${mine ? ' mine' : ''}`}>{body}</div>;
  return (
    <button type="button" className={`cm-quote clickable${mine ? ' mine' : ''}`} onClick={onClick} title="Yanıtlanan mesaja git">
      {body}
    </button>
  );
}

export function ChatMessage({ item, byId, leadId, continued, onReply, onJump }: Props) {
  const name = (id: string) => (id === 'user' ? 'Sen' : byId.get(id)?.config.name ?? id);

  switch (item.type) {
    case 'user': {
      const to = byId.get(item.agentId);
      const direct = !item.briefed && item.agentId !== leadId;
      return (
        <div className="cm-row mine" data-item={item.id}>
          <div className="cm-bubble mine">
            <ReplyBtn item={item} onReply={onReply} />
            <div className="cm-meta">
              <span>{item.briefed ? 'Ekibe' : direct ? `→ ${to?.config.name ?? item.agentId}` : 'Sen'}</span>
              <time>{clock(item.ts)}</time>
            </div>
            {item.reply && (
              <Quote
                mine
                author={item.reply.author}
                text={item.reply.text}
                onClick={onJump ? () => onJump(item.reply!.id) : undefined}
              />
            )}
            <div className="cm-text">{item.text}</div>
          </div>
        </div>
      );
    }

    case 'turn': {
      const agent = byId.get(item.agentId);
      const speaking = item.texts.length > 0;
      return (
        <div className={`cm-row${continued ? ' cont' : ''}`} data-item={item.id}>
          {continued ? <span className="cm-avatar-gap" /> : <Avatar agent={agent} />}
          <div className="cm-bubble">
            <ReplyBtn item={item} onReply={onReply} />
            {!continued && (
              <div className="cm-meta">
                <span className="cm-name" data-role={agent?.config.role}>
                  {agent?.config.name ?? item.agentId}
                </span>
                {agent && <span className="cm-role">{ROLE_LABEL[agent.config.role] ?? agent.config.role}</span>}
                {agent && <span className="cm-chip">{agent.currentModel ?? agent.config.model}</span>}
                <time>{clock(item.ts)}</time>
              </div>
            )}
            {speaking && <RichText text={item.texts.join('\n\n')} />}
            {item.live && (
              <div className="cm-typing">
                <span className="cm-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                {agent?.currentActivity ?? (speaking ? 'devam ediyor' : 'çalışıyor')}
              </div>
            )}
            {item.error && <div className="cm-error">{item.error}</div>}
            {item.tools.length > 0 && <Tools tools={item.tools} />}
            {!item.live && typeof item.costUSD === 'number' && item.costUSD > 0 && (
              <div className="cm-foot">{fmtCost(item.costUSD)}</div>
            )}
          </div>
        </div>
      );
    }

    case 'delegation': {
      const t = item.task;
      return (
        <div className="cm-event" data-item={item.id}>
          <div className="cm-event-card">
            <ReplyBtn item={item} onReply={onReply} />
            <div className="cm-meta">
              <span className="cm-handoff">
                <strong>{name(t.assignedBy)}</strong>
                <span className="cm-arrow" aria-label="iş verdi">→</span>
                <strong>{name(t.assignedTo)}</strong>
              </span>
              <span className={`cm-status s-${t.status}`}>{STATUS[t.status]}</span>
              <time>{clock(item.ts)}</time>
            </div>
            <div className="cm-event-title">{t.title}</div>
            <details className="cm-details">
              <summary>Görev metni</summary>
              <div className="cm-pre">{t.prompt}</div>
            </details>
          </div>
        </div>
      );
    }

    case 'result': {
      const t = item.task;
      const ok = t.status === 'done';
      return (
        <ResultCard
          itemId={item.id}
          replyBtn={<ReplyBtn item={item} onReply={onReply} />}
          agent={byId.get(t.assignedTo)}
          fallbackName={t.assignedTo}
          to={name(t.assignedBy)}
          title={t.title}
          ok={ok}
          text={t.result ?? ''}
          ts={item.ts}
        />
      );
    }

    case 'permission':
      return <PermissionCard item={item} agent={byId.get(item.agentId)} />;

    case 'note':
      return (
        <div className={`cm-note${item.tone === 'error' ? ' err' : ''}`}>
          <span className="cm-note-who">{name(item.agentId)}</span>
          <pre>{item.text}</pre>
        </div>
      );
  }
}

function RichText({ text }: { text: string }) {
  return (
    <div className="cm-text">
      {inlineParts(text).map((p, i) =>
        p.kind === 'bold' ? (
          <strong key={i}>{p.text}</strong>
        ) : p.kind === 'code' ? (
          <code key={i}>{p.text}</code>
        ) : (
          p.text
        )
      )}
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: 'sırada',
  running: 'çalışıyor',
  done: 'bitti',
  failed: 'başarısız',
};

function Tools({ tools }: { tools: ToolCall[] }) {
  const errors = tools.filter((t) => t.isError).length;
  return (
    <details className="cm-details cm-tools">
      <summary>
        Ayrıntılar ({tools.length} araç{errors ? `, ${errors} hata` : ''})
      </summary>
      <ol>
        {tools.map((t, i) => (
          <li key={i} className={t.isError ? 'err' : undefined}>
            <span className="cm-tool-name">{shortTool(t.name)}</span>
            {t.input && <span className="cm-tool-input">{summarizeInput(t.input)}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** `mcp__team__delegate_tasks` → `team · delegate_tasks` */
function shortTool(name: string): string {
  const m = /^mcp__([^_]+(?:_[^_]+)*)__(.+)$/.exec(name);
  return m ? `${m[1]} · ${m[2]}` : name;
}

function summarizeInput(raw: string): string {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    for (const k of ['command', 'file_path', 'pattern', 'url', 'path', 'query', 'description', 'title']) {
      if (typeof o[k] === 'string') return o[k] as string;
    }
  } catch {
    /* kesilmiş JSON: ham metnin başı yeterli */
  }
  return raw.length > 120 ? raw.slice(0, 119) + '…' : raw;
}

const LONG = 700;

function ResultCard(props: {
  itemId: string;
  replyBtn: ReactNode;
  agent: AgentSnapshot | undefined;
  fallbackName: string;
  to: string;
  title: string;
  ok: boolean;
  text: string;
  ts: number;
}) {
  const { itemId, replyBtn, agent, fallbackName, to, title, ok, text, ts } = props;
  const [open, setOpen] = useState(text.length <= LONG);
  return (
    <div className="cm-row" data-item={itemId}>
      <Avatar agent={agent} />
      <div className={`cm-bubble cm-result${ok ? '' : ' failed'}`}>
        {replyBtn}
        <div className="cm-meta">
          <span className="cm-name" data-role={agent?.config.role}>
            {agent?.config.name ?? fallbackName}
          </span>
          <span className="cm-role">→ {to}</span>
          <span className={`cm-status s-${ok ? 'done' : 'failed'}`}>{ok ? 'teslim etti' : 'başaramadı'}</span>
          <time>{clock(ts)}</time>
        </div>
        <div className="cm-event-title">{title}</div>
        {text && <RichText text={open ? text : text.slice(0, LONG) + '…'} />}
        {text.length > LONG && (
          <button className="cm-link" onClick={() => setOpen((v) => !v)}>
            {open ? 'Kısalt' : 'Tamamını göster'}
          </button>
        )}
      </div>
    </div>
  );
}

function PermissionCard({
  item,
  agent,
}: {
  item: Extract<ChatItem, { type: 'permission' }>;
  agent: AgentSnapshot | undefined;
}) {
  const [busy, setBusy] = useState(false);
  async function choose(c: PermissionChoice) {
    if (busy) return;
    setBusy(true);
    await answerPermission(item.agentId, item.req, c);
  }
  return (
    <div className="cm-row">
      <Avatar agent={agent} />
      <div className="cm-bubble cm-perm">
        <div className="cm-meta">
          <span className="cm-name">{agent?.config.name ?? item.agentId}</span>
          <span className="cm-status s-waiting">onay bekliyor</span>
          <time>{clock(item.ts)}</time>
        </div>
        <div className="cm-event-title">{item.req.title ?? `${shortTool(item.req.toolName)} çalıştırılsın mı?`}</div>
        <div className="cm-pre">{permissionSummary(item.req)}</div>
        <div className="cm-perm-actions">
          <button className="primary" disabled={busy} onClick={() => void choose(0)}>
            {PERMISSION_OPTIONS[0]}
          </button>
          <button disabled={busy} onClick={() => void choose(1)}>
            {PERMISSION_OPTIONS[1]}
          </button>
          <button className="danger" disabled={busy} onClick={() => void choose(2)}>
            {PERMISSION_OPTIONS[2]}
          </button>
        </div>
      </div>
    </div>
  );
}
