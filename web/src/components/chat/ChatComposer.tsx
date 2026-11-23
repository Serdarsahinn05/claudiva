/**
 * Sohbetin alt kısmı (footer): yazı alanı + seçenek çipleri + durum satırı.
 *
 * İki kip:
 *  · Grup: hedefsiz mesaj takım LİDERİNE ekip talimatıyla (brief.ts) gider,
 *    lider böler ve dağıtır. `@ajan` ile başlayan mesaj doğrudan o ajana gider
 *    ("araya girme"): çalışan bir ajana yazılan mesaj onun sürmekte olan turuna
 *    katılır.
 *  · Doğrudan (DM): tek ajanla konuşma; `/` komutları da çalışır (agentSend.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSnapshot, BudgetState, Task } from '../../types';
import { api } from '../../api';
import { buildBrief } from '../../brief';
import { canDelegate } from '../../teams';
import { fmtCost } from '../../format';
import { Avatar, Quote } from './ChatMessage';
import { withReply, type ReplyRef } from '../../reply';

/** Yanıtlanan mesaj + yanıtın gideceği ajan (ajan mesajına yanıt o ajana gider). */
export interface ReplyTarget extends ReplyRef {
  agentId?: string;
}

interface Props {
  mode: 'group' | 'dm';
  /** Grupta katılımcılar; DM'de tek eleman. */
  members: AgentSnapshot[];
  lead: AgentSnapshot | null;
  tasks: Task[];
  budget: BudgetState | null;
  label: string;
  /** DM gönderimi (yerel komut ayrımı dahil). */
  onDirectSend?: (text: string) => Promise<void>;
  /** Grubun oto-onay durumunu değiştirir. */
  onToggleAutoApprove?: () => Promise<void>;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
}

type Kind = 'task' | 'ask';
type Plan = 'auto' | 'approve';

export function ChatComposer({
  mode,
  members,
  lead,
  tasks,
  budget,
  label,
  onDirectSend,
  onToggleAutoApprove,
  replyTo = null,
  onCancelReply,
}: Props) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const [plan, setPlan] = useState<Plan>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mentionSel, setMentionSel] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  // İçeriğe göre büyüyen alan (CSS max-height'a kadar).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // ------------------------------------------------------------- @ önerisi
  const mentionQuery = mode === 'group' ? /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1] : undefined;
  const mentionMatches = useMemo(() => {
    if (mentionQuery === undefined) return [];
    const q = mentionQuery.toLocaleLowerCase('tr');
    return members.filter(
      (a) => a.config.id.startsWith(q) || a.config.name.toLocaleLowerCase('tr').includes(q)
    );
  }, [mentionQuery, members]);
  const showMentions = mentionMatches.length > 0;

  useEffect(() => setMentionSel(0), [mentionQuery]);

  function pickMention(a: AgentSnapshot) {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${a.config.id} `));
    ref.current?.focus();
  }

  // Yanıt seçilince yazı alanına odaklan (WhatsApp'taki gibi hemen yazılsın).
  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo]);

  /**
   * Hedef: mesajın başındaki `@id` önce gelir; yoksa yanıtlanan ajan mesajı
   * hedefi belirler (bir ajanın sözüne verilen cevap o ajana gider). Kendi
   * mesajına yanıt hedef değiştirmez — ekip talimatı lidere gitmeye devam eder.
   */
  const target = useMemo(() => {
    if (mode !== 'group') return null;
    const m = /^@([\w.-]+)\s/.exec(text);
    if (m) return members.find((a) => a.config.id === m[1]) ?? null;
    return replyTo?.agentId ? members.find((a) => a.config.id === replyTo.agentId) ?? null : null;
  }, [text, members, mode, replyTo]);

  // ------------------------------------------------------------- gönder
  async function send() {
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    setError('');
    try {
      // `/komut` yanıt bloğuyla sarılmaz: CLI ancak ilk karakter `/` ise komut sayar.
      const quoted = (s: string) => (s.startsWith('/') ? s : withReply(s, replyTo));
      if (mode === 'dm') {
        await onDirectSend?.(quoted(raw));
      } else if (target) {
        await api.sendMessage(target.config.id, quoted(raw.replace(/^@[\w.-]+\s+/, '')));
      } else if (lead) {
        await api.sendMessage(
          lead.config.id,
          buildBrief(quoted(raw), lead, members, { plan, ask: kind === 'ask' })
        );
      }
      setText('');
      onCancelReply?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------- durum satırı
  const working = members.filter((a) => a.status === 'working' || a.status === 'waiting');
  const started = useMemo(() => {
    const ids = new Set(members.map((a) => a.config.id));
    const run = tasks.filter((t) => t.status === 'running' && ids.has(t.assignedTo) && t.startedAt);
    return run.length ? Math.min(...run.map((t) => t.startedAt as number)) : null;
  }, [tasks, members]);
  const [now, setNow] = useState(() => Date.now());
  const localStart = useRef<number | null>(null);
  useEffect(() => {
    if (!working.length) {
      localStart.current = null;
      return;
    }
    localStart.current ??= Date.now();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [working.length]);
  const since = started ?? localStart.current;
  const elapsed = working.length && since ? fmtElapsed(now - since) : null;

  const allAuto = members.length > 0 && members.every((a) => a.config.autoApprove);
  const delegates = mode === 'group' && !!lead && canDelegate(lead) && !target;
  const anyWorking = working.length > 0;

  const placeholder =
    mode === 'dm'
      ? `${label} ajanına yaz…`
      : replyTo && target
        ? `${target.config.name} ajanına yanıt yaz…`
        : !lead
        ? 'Bu ekipte ajan yok.'
        : kind === 'ask'
          ? `Ekibe bir soru sor — ${lead.config.name} cevaplasın…`
          : 'Ekibe ne yaptırmak istiyorsun?';

  return (
    <div className={`chat-composer${error ? ' has-error' : ''}`}>
      {showMentions && (
        <div className="cmd-menu chat-mentions" role="listbox" aria-label="Ajan seç">
          {mentionMatches.map((a, i) => (
            <div
              key={a.config.id}
              className={`cmd-row${i === mentionSel ? ' sel' : ''}`}
              role="option"
              aria-selected={i === mentionSel}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(a);
              }}
            >
              <Avatar agent={a} size="sm" />
              <span className="cmd-name">@{a.config.id}</span>
              <span className="cmd-desc">{a.config.name}</span>
            </div>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="chat-replying">
          <Quote author={replyTo.author} text={replyTo.text} />
          <button className="icon-btn chat-reply-x" onClick={onCancelReply} aria-label="Yanıtı iptal et" title="Yanıtı iptal et (Esc)">
            ×
          </button>
        </div>
      )}

      <div className="chat-input-wrap">
        {target && (
          <span className="chat-target" title="Mesaj yalnız bu ajana gider">
            → {target.config.name}
          </span>
        )}
        <textarea
          ref={ref}
          className="chat-input"
          rows={1}
          value={text}
          disabled={mode === 'group' && !lead}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (showMentions) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const d = e.key === 'ArrowDown' ? 1 : -1;
                setMentionSel((s) => (s + d + mentionMatches.length) % mentionMatches.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pickMention(mentionMatches[mentionSel]);
                return;
              }
            }
            if (e.key === 'Escape' && replyTo) {
              e.preventDefault();
              onCancelReply?.();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          className="primary chat-send"
          disabled={!text.trim() || busy || (mode === 'group' && !lead)}
          onClick={() => void send()}
        >
          {busy ? 'Gönderiliyor…' : mode === 'dm' || target ? 'Gönder' : kind === 'ask' ? 'Sor' : delegates ? 'Ekibe ver' : 'Gönder'}
        </button>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-chips">
        {mode === 'group' && (
          <>
            <span className="chat-chip static" title="Hedefsiz mesajlar lidere gider">
              {target ? `Hedef: ${target.config.name}` : lead ? `Lider: ${lead.config.name}` : 'Lider yok'}
            </span>
            {!target && (
            <div className="chat-seg" role="group" aria-label="Kip">
              <button className={`chat-chip${kind === 'task' ? ' on' : ''}`} onClick={() => setKind('task')}>
                Görev
              </button>
              <button className={`chat-chip${kind === 'ask' ? ' on' : ''}`} onClick={() => setKind('ask')}>
                Soru
              </button>
            </div>
            )}
            {kind === 'task' && delegates && (
              <div className="chat-seg" role="group" aria-label="Plan">
                <button
                  className={`chat-chip${plan === 'auto' ? ' on' : ''}`}
                  onClick={() => setPlan('auto')}
                  title="Lider planlar ve hemen dağıtır"
                >
                  Plan: otomatik
                </button>
                <button
                  className={`chat-chip${plan === 'approve' ? ' on' : ''}`}
                  onClick={() => setPlan('approve')}
                  title="Lider önce planı yazar, sen onaylayınca dağıtır"
                >
                  Plan: onaylı
                </button>
              </div>
            )}
          </>
        )}
        {onToggleAutoApprove && (
          <button
            className={`chat-chip${allAuto ? ' on warn' : ''}`}
            onClick={() => void onToggleAutoApprove()}
            title={allAuto ? 'Ajanlar izin sormadan çalışıyor' : 'Her araçta izin sorulur'}
          >
            {allAuto ? 'Oto-onay açık' : 'İzin sor'}
          </button>
        )}
        {anyWorking && (
          <button
            className="chat-chip danger"
            onClick={() => void Promise.all(working.map((a) => api.interrupt(a.config.id).catch(() => {})))}
            title="Çalışan ajanların turunu kes"
          >
            Durdur
          </button>
        )}
      </div>

      <div className="chat-status">
        <span className="chat-status-live">
          <span className={`led ${anyWorking ? 'led-working' : 'led-idle'}`} />
          {anyWorking
            ? `${mode === 'dm' ? label : 'Ekip'} çalışıyor${elapsed ? ` · ${elapsed}` : ''} · ${working.length} ajan`
            : mode === 'dm'
              ? `${label} hazır`
              : `Ekip hazır · ${members.length} ajan`}
        </span>
        <span className="chat-hints">
          <kbd>Enter</kbd> gönder · <kbd>Shift+Enter</kbd> satır
          {mode === 'group' ? (
            <>
              {' '}· <kbd>@</kbd> ajana doğrudan yaz
            </>
          ) : (
            <>
              {' '}· <kbd>/</kbd> komut
            </>
          )}
        </span>
        {budget && <span className="chat-spend">bugün {fmtCost(budget.spentUSD)}</span>}
      </div>
    </div>
  );
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} dk ${String(s % 60).padStart(2, '0')} sn` : `${s} sn`;
}
