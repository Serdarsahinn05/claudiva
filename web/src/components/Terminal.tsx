import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSnapshot, SlashCommand, TranscriptEvent } from '../types';
import { api } from '../api';
import { STATUS_LABEL } from '../format';

/** Girdi bir slash komutu yazılıyorsa henüz tamamlanmamış komut adını verir. */
function slashPrefix(input: string): string | null {
  const m = /^\/([^\s]*)$/.exec(input);
  return m ? m[1] : null;
}

/** Claude Code CLI'daki gibi: önce baştan eşleşenler, sonra içinde geçenler. */
function matchCommands(commands: SlashCommand[], prefix: string): SlashCommand[] {
  const q = prefix.toLowerCase();
  if (!q) return commands;
  const names = (c: SlashCommand) => [c.name, ...(c.aliases ?? [])];
  const starts = commands.filter((c) => names(c).some((n) => n.toLowerCase().startsWith(q)));
  const contains = commands.filter(
    (c) => !starts.includes(c) && names(c).some((n) => n.toLowerCase().includes(q)),
  );
  return [...starts, ...contains];
}

interface Props {
  agent: AgentSnapshot;
  events: TranscriptEvent[];
}

/**
 * Claude Code CLI'ın transcript biçimi: her olay bir işaretle başlar
 * (● mesaj/araç, ⎿ araç sonucu, > kullanıcı). Zaman damgası satırı
 * kalabalıklaştırmasın diye tooltip'e alındı.
 */
function EventLine({ ev }: { ev: TranscriptEvent }) {
  const time = new Date(ev.ts).toLocaleTimeString('tr-TR');
  switch (ev.kind) {
    case 'user':
      return (
        <div className="ev ev-user" title={time}>
          <span className="ev-mark">&gt;</span>
          <span className="ev-content">{ev.text}</span>
        </div>
      );
    case 'text':
      return (
        <div className="ev ev-text" title={time}>
          <span className="ev-mark dot-mark">●</span>
          <span className="ev-content">{ev.text}</span>
        </div>
      );
    case 'thinking':
      return (
        <div className="ev ev-thinking" title={time}>
          <span className="ev-mark">✻</span>
          <span className="ev-content">{ev.text}</span>
        </div>
      );
    case 'tool_use':
      return (
        <div className="ev ev-tool" title={time}>
          <span className="ev-mark dot-mark">●</span>
          <span className="ev-content">
            <span className="tool-name">{ev.toolName}</span>
            <span className="tool-args">({ev.input})</span>
          </span>
        </div>
      );
    case 'tool_result':
      return (
        <div className={`ev ev-toolresult${ev.meta?.isError ? ' ev-error' : ''}`} title={time}>
          <span className="ev-mark">⎿</span>
          <span className="ev-content">{ev.text}</span>
        </div>
      );
    case 'result':
      return (
        <div className="ev ev-result" title={time}>
          <span className="ev-mark">✓</span>
          <span className="ev-content">
            Tur bitti
            {typeof ev.meta?.costUSD === 'number' && ` · $${(ev.meta.costUSD as number).toFixed(4)}`}
          </span>
        </div>
      );
    case 'error':
      return (
        <div className="ev ev-error" title={time}>
          <span className="ev-mark">✗</span>
          <span className="ev-content">{ev.text}</span>
        </div>
      );
    default:
      return (
        <div className="ev ev-system" title={time}>
          <span className="ev-mark">·</span>
          <span className="ev-content">{ev.text}</span>
        </div>
      );
  }
}

export function Terminal({ agent, events }: Props) {
  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = agent.config.id;

  const cmdCount = agent.commands?.length ?? 0;
  const prefix = slashPrefix(input);
  const matches = useMemo(
    () => (prefix === null ? [] : matchCommands(agent.commands ?? [], prefix)),
    [prefix, agent.commands],
  );
  // Menü yalnızca komut yazılırken ve eşleşme varken görünür; Esc ile kapatılınca
  // kullanıcı yazmaya devam edip yeniden açabilsin diye prefix değişiminde sıfırlanır.
  const showMenu = menuOpen && prefix !== null && matches.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length, agent.pendingPermissions.length]);

  useEffect(() => {
    setMenuOpen(prefix !== null);
    setSelected(0);
  }, [prefix]);

  // Seçili satırı görünür tut (uzun komut listelerinde ok tuşuyla gezerken).
  useEffect(() => {
    menuRef.current?.querySelector('.cmd-row.sel')?.scrollIntoView({ block: 'nearest' });
  }, [selected, showMenu]);

  function complete(cmd: SlashCommand) {
    setInput(`/${cmd.name} `);
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMenuOpen(false);
    await api.sendMessage(id, text).catch((e) => alert((e as Error).message));
  }

  const visible = showThinking ? events : events.filter((e) => e.kind !== 'thinking');

  return (
    <div className="terminal">
      <div className="terminal-head">
        <span className={`dot dot-${agent.status}`} />
        <strong>{agent.config.name}</strong>
        <span className="muted">
          {STATUS_LABEL[agent.status]}
          {agent.currentActivity ? ` · ${agent.currentActivity}` : ''}
        </span>
        <div className="spacer" />
        <label className="check small">
          <input type="checkbox" checked={showThinking} onChange={(e) => setShowThinking(e.target.checked)} />
          düşünmeyi göster
        </label>
        {agent.status === 'working' && (
          <button className="danger" onClick={() => api.interrupt(id)}>
            ⏹ Durdur
          </button>
        )}
      </div>

      <div className="terminal-body" ref={scrollRef}>
        {visible.length === 0 && (
          <div className="cli-banner">
            <div className="cli-banner-box">
              <div className="cli-banner-title">✻ {agent.config.name}</div>
              <div className="cli-banner-line">{agent.currentModel ?? agent.config.model} · {agent.config.role}</div>
              <div className="cli-banner-line dim">workspaces/{id}</div>
            </div>
            <div className="cli-banner-tip">
              <kbd>/</kbd> ile komutları listele · aşağıdan görev ver
            </div>
          </div>
        )}
        {visible.map((ev) => (
          <EventLine key={ev.id} ev={ev} />
        ))}
      </div>

      {agent.pendingPermissions.map((p) => (
        <div key={p.id} className="permission-banner">
          <div>
            <strong>İzin isteği:</strong> {p.title ?? `${p.toolName} çalıştırılsın mı?`}
            {p.description && <div className="muted">{p.description}</div>}
            <code className="perm-input">{JSON.stringify(p.input).slice(0, 300)}</code>
          </div>
          <div className="perm-actions">
            <button className="primary" onClick={() => api.permission(id, p.id, true)}>
              İzin ver
            </button>
            <button className="danger" onClick={() => api.permission(id, p.id, false)}>
              Reddet
            </button>
          </div>
        </div>
      ))}

      <div className="terminal-input">
        {showMenu && (
          <div className="cmd-menu" ref={menuRef}>
            {matches.map((c, i) => (
              <div
                key={c.name}
                className={`cmd-row${i === selected ? ' sel' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // textarea odağı kaybolmasın
                  complete(c);
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <span className="cmd-name">/{c.name}</span>
                {c.argumentHint && <span className="cmd-args">{c.argumentHint}</span>}
                <span className="cmd-desc">{c.description}</span>
              </div>
            ))}
          </div>
        )}
        <span className="prompt-mark">&gt;</span>
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          placeholder={`${agent.config.name} ajanına görev ver…`}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => setMenuOpen(false)}
          onKeyDown={(e) => {
            if (showMenu) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected((s) => (s + 1) % matches.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((s) => (s - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === 'Tab' || (e.key === 'Enter' && !e.ctrlKey && !e.metaKey)) {
                e.preventDefault();
                complete(matches[selected]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setMenuOpen(false);
                return;
              }
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="primary" onClick={send} disabled={!input.trim()}>
          Gönder
        </button>
      </div>

      <div className="terminal-hint">
        <span>
          <kbd>/</kbd> komutlar{cmdCount > 0 ? ` (${cmdCount})` : ''}
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> gönder
        </span>
        {agent.status === 'offline' && <span className="hint-warn">ajan kapalı — başlatınca çalışır</span>}
        <div className="spacer" />
        <span>{agent.currentModel ?? agent.config.model}</span>
      </div>
    </div>
  );
}
