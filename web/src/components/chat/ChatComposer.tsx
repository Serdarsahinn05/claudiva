/**
 * Sohbetin alt kısmı (footer): yazı alanı + seçenek çipleri + durum satırı.
 *
 * İki kip:
 *  · Grup: hedefsiz mesaj takım LİDERİNE ekip talimatıyla (brief.ts) gider,
 *    lider böler ve dağıtır. `@ajan` ile başlayan mesaj doğrudan o ajana gider
 *    ("araya girme"): çalışan bir ajana yazılan mesaj onun sürmekte olan turuna
 *    katılır.
 *  · Doğrudan (DM): tek ajanla konuşma; `/` komutları da çalışır (agentSend.ts).
 *
 * `/komut` iki kipte de ÇIPLAK gider (brif/etiket/yanıt bloğu yok; CLI ancak
 * ilk karakter `/` ise komut sayar). Grupta hedef `@ajan`, yoksa LİDER; çıktı
 * o ajanın DM'ine düşer (etiketsiz mesaj), bu yüzden kabuk oraya geçer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { commandsFor, matchCommands, slashPrefix } from '../../slashMenu';
import { StatusLine } from '../StatusLine';
import type { AgentSnapshot, BudgetState, Task } from '../../types';
import { api } from '../../api';
import { buildBrief } from '../../brief';
import { withConvTag } from '../../convTag';
import { canDelegate } from '../../teams';
import { fmtCost } from '../../format';
import { Avatar, Quote } from './ChatMessage';
import { withReply, type ReplyRef } from '../../reply';
import { L } from '../../i18n';

/** Yanıtlanan mesaj + yanıtın gideceği ajan (ajan mesajına yanıt o ajana gider). */
export interface ReplyTarget extends ReplyRef {
  agentId?: string;
}

interface Props {
  mode: 'group' | 'dm';
  /** Grubun anahtarı: grup gönderimi bununla etiketlenir (convTag.ts). */
  groupKey: string;
  /** Grupta katılımcılar; DM'de tek eleman. */
  members: AgentSnapshot[];
  lead: AgentSnapshot | null;
  tasks: Task[];
  budget: BudgetState | null;
  label: string;
  /** DM gönderimi (yerel komut ayrımı dahil). */
  onDirectSend?: (text: string) => Promise<void>;
  /** Grupta `/komut`: o ajana çıplak gönderir (yerel komut ayrımı dahil). */
  onAgentCommand?: (agentId: string, text: string) => Promise<void>;
  /** Grubun oto-onay durumunu değiştirir. */
  onToggleAutoApprove?: () => Promise<void>;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  /** DM: ajan çalışıyor ama başka bir sohbetteki işte (bkz. chatFeed `busyHere`). */
  busyElsewhere?: boolean;
}

type Kind = 'task' | 'ask';
type Plan = 'auto' | 'approve';

export function ChatComposer({
  mode,
  groupKey,
  members,
  lead,
  tasks,
  budget,
  label,
  onDirectSend,
  onAgentCommand,
  onToggleAutoApprove,
  replyTo = null,
  onCancelReply,
  busyElsewhere = false,
}: Props) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const [plan, setPlan] = useState<Plan>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mentionSel, setMentionSel] = useState(0);
  const [cmdSel, setCmdSel] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(true);
  const cmdMenuRef = useRef<HTMLDivElement>(null);
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

  // ------------------------------------------------------------- / komutları
  // Grupta `@ajan ` öneki komutun hedefini seçer; komut onun ardından gelir.
  const atPrefix = mode === 'group' ? /^@[\w.-]+\s+/.exec(text)?.[0] ?? '' : '';
  const body = text.slice(atPrefix.length);
  const cmdAgent = mode === 'dm' ? members[0] ?? null : target ?? lead;
  const allCommands = useMemo(() => commandsFor(cmdAgent), [cmdAgent?.commands]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmdPrefix = slashPrefix(body);
  const cmdMatches = useMemo(
    () => (cmdPrefix === null ? [] : matchCommands(allCommands, cmdPrefix)),
    [cmdPrefix, allCommands],
  );
  const showCmds = !showMentions && cmdOpen && cmdPrefix !== null && cmdMatches.length > 0;
  const isCommand = body.trimStart().startsWith('/');

  useEffect(() => {
    setCmdOpen(true);
    setCmdSel(0);
  }, [cmdPrefix]);
  useEffect(() => {
    cmdMenuRef.current?.querySelector('.cmd-row.sel')?.scrollIntoView({ block: 'nearest' });
  }, [cmdSel, showCmds]);

  function pickCommand(c: { name: string }) {
    setText(`${atPrefix}/${c.name} `);
    setCmdOpen(false);
    ref.current?.focus();
  }

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
      } else if (isCommand && cmdAgent) {
        await onAgentCommand?.(cmdAgent.config.id, body.trim());
      } else if (target) {
        // @ile ajana yazılan mesaj da grubun konuşmasıdır, özel sohbet değil.
        await api.sendMessage(target.config.id, withConvTag(quoted(raw.replace(/^@[\w.-]+\s+/, '')), groupKey));
      } else if (lead) {
        await api.sendMessage(
          lead.config.id,
          withConvTag(buildBrief(quoted(raw), lead, members, { plan, ask: kind === 'ask' }), groupKey)
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
      ? L.composer.dmPlaceholder(label)
      : replyTo && target
        ? L.composer.replyPlaceholder(target.config.name)
        : !lead
        ? L.composer.noAgents
        : kind === 'ask'
          ? L.composer.askPlaceholder(lead.config.name)
          : L.composer.taskPlaceholder;

  return (
    <div className={`chat-composer${error ? ' has-error' : ''}`}>
      {showMentions && (
        <div className="cmd-menu chat-mentions" role="listbox" aria-label={L.composer.pickAgent}>
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

      {showCmds && (
        <div className="cmd-menu chat-cmds" ref={cmdMenuRef} role="listbox" aria-label={L.composer.commandsFor(cmdAgent?.config.name ?? '')}>
          {cmdMatches.map((c, i) => (
            <div
              key={c.name}
              className={`cmd-row${i === cmdSel ? ' sel' : ''}`}
              role="option"
              aria-selected={i === cmdSel}
              onMouseDown={(e) => {
                e.preventDefault();
                pickCommand(c);
              }}
              onMouseEnter={() => setCmdSel(i)}
            >
              <span className="cmd-name">/{c.name}</span>
              {c.argumentHint && <span className="cmd-args">{c.argumentHint}</span>}
              <span className="cmd-desc">{c.description}</span>
            </div>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="chat-replying">
          <Quote author={replyTo.author} text={replyTo.text} />
          <button className="icon-btn chat-reply-x" onClick={onCancelReply} aria-label={L.composer.cancelReply} title={L.composer.cancelReplyTitle}>
            ×
          </button>
        </div>
      )}

      <div className="chat-input-wrap">
        {target && (
          <span className="chat-target" title={L.composer.targetTitle}>
            → {target.config.name}
          </span>
        )}
        <textarea
          ref={ref}
          className="chat-input"
          aria-label={placeholder}
          rows={1}
          value={text}
          disabled={mode === 'group' && !lead}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          onBlur={() => setCmdOpen(false)}
          onFocus={() => setCmdOpen(true)}
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
            if (showCmds) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const d = e.key === 'ArrowDown' ? 1 : -1;
                setCmdSel((s) => (s + d + cmdMatches.length) % cmdMatches.length);
                return;
              }
              if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && cmdPrefix !== cmdMatches[cmdSel].name)) {
                e.preventDefault();
                pickCommand(cmdMatches[cmdSel]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setCmdOpen(false);
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
          {busy ? L.common.sending : mode === 'dm' || target ? L.common.send : kind === 'ask' ? L.composer.ask : delegates ? L.composer.giveTeam : L.common.send}
        </button>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-chips">
        {mode === 'group' && (
          <>
            <span className="chat-chip static" title={L.composer.leadChipTitle}>
              {isCommand && cmdAgent
                ? L.composer.commandTo(cmdAgent.config.name)
                : target ? L.composer.target(target.config.name) : lead ? L.composer.lead(lead.config.name) : L.composer.noLead}
            </span>
            {!target && !isCommand && (
            <div className="chat-seg" role="group" aria-label={L.composer.mode}>
              <button className={`chat-chip${kind === 'task' ? ' on' : ''}`} aria-pressed={kind === 'task'} onClick={() => setKind('task')}>
                {L.composer.task}
              </button>
              <button className={`chat-chip${kind === 'ask' ? ' on' : ''}`} aria-pressed={kind === 'ask'} onClick={() => setKind('ask')}>
                {L.composer.question}
              </button>
            </div>
            )}
            {kind === 'task' && delegates && !isCommand && (
              <div className="chat-seg" role="group" aria-label={L.composer.plan}>
                <button
                  className={`chat-chip${plan === 'auto' ? ' on' : ''}`}
                  aria-pressed={plan === 'auto'}
                  onClick={() => setPlan('auto')}
                  title={L.composer.planAutoTitle}
                >
                  {L.composer.planAuto}
                </button>
                <button
                  className={`chat-chip${plan === 'approve' ? ' on' : ''}`}
                  aria-pressed={plan === 'approve'}
                  onClick={() => setPlan('approve')}
                  title={L.composer.planApproveTitle}
                >
                  {L.composer.planApprove}
                </button>
              </div>
            )}
          </>
        )}
        {onToggleAutoApprove && (
          <button
            className={`chat-chip${allAuto ? ' on warn' : ''}`}
            onClick={() => void onToggleAutoApprove()}
            title={allAuto ? L.composer.autoOnTitle : L.composer.autoOffTitle}
          >
            {allAuto ? L.composer.autoOn : L.composer.autoOff}
          </button>
        )}
        {anyWorking && (
          <button
            className="chat-chip danger"
            onClick={() => void Promise.all(working.map((a) => api.interrupt(a.config.id).catch(() => {})))}
            title={L.composer.stopTitle}
          >
            {L.composer.stop}
          </button>
        )}
      </div>

      <div className="chat-status">
        <span className="chat-status-live">
          <span className={`led ${anyWorking ? 'led-working' : 'led-idle'}`} />
          {anyWorking && busyElsewhere
            ? L.composer.busyElsewhere(label)
            : anyWorking
            ? L.composer.working(mode === 'dm' ? label : L.composer.team, elapsed, working.length)
            : mode === 'dm'
              ? L.composer.ready(label)
              : L.composer.teamReady(members.length)}
        </span>
        <span className="chat-hints">
          <kbd>Enter</kbd> {L.composer.send} · <kbd>Shift+Enter</kbd> {L.composer.newline}
          {mode === 'group' && (
            <>
              {' '}· <kbd>@</kbd> {L.composer.mentionHint}
            </>
          )}
          {' '}· <kbd>/</kbd> {mode === 'group' ? L.composer.commandHintLead : L.composer.commandHint}
        </span>
        {budget && <span className="chat-spend">{L.composer.today(fmtCost(budget.spentUSD))}</span>}
      </div>
      {/* Kullanıcının Claude Code durum çubuğu (kalan limit vb.): DM'de o ajanın,
          grupta liderin. Ayarda statusLine yoksa hiçbir şey çizmez. */}
      {(mode === 'dm' ? members[0] : lead) && <StatusLine agent={(mode === 'dm' ? members[0] : lead)!} />}
    </div>
  );
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return L.composer.elapsed(m, s % 60);
}
