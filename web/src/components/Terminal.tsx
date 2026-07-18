import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSnapshot, SlashCommand, TranscriptEvent } from '../types';
import { api } from '../api';
import { STATUS_LABEL } from '../format';
import { isLocal, localAsSlashCommands, matchLocal } from '../localCommands';

const ROLE_LABEL: Record<string, string> = {
  boss: 'patron',
  manager: 'yönetici',
  worker: 'çalışan',
};

/** CLI'ın karşılama maskotunun piksel-art karşılığı. */
const CAT_LOGO = ` ▄▄▄▄▄▄▄
█ ▀▀ ▀▀ █
█  ▀▀▀  █
 ▀█▀ ▀█▀ `;

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
  projectDir: string;
  agentCount: number;
  /** /clear sonrası dökümü sunucudan yeniden yüklemek için. */
  onCleared: () => void;
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
    case 'local':
      // Panelin kendi çıktısı (/usage gibi) — hizalama korunsun diye <pre>.
      return (
        <div className="ev ev-local" title={time}>
          <span className="ev-mark">⎿</span>
          <pre className="ev-content">{ev.text}</pre>
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

export function Terminal({ agent, events, projectDir, agentCount, onCleared }: Props) {
  const [input, setInput] = useState('');
  const [localEvents, setLocalEvents] = useState<TranscriptEvent[]>([]);
  const [showThinking, setShowThinking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = agent.config.id;

  // Panelin kendi komutları listenin başında durur; ajanınkilerle isim
  // çakışırsa (ör. /clear) panel sürümü kazanır, çünkü yerel işlenir.
  const allCommands = useMemo(() => {
    const agentCmds = (agent.commands ?? []).filter((c) => !isLocal(c.name));
    return [...localAsSlashCommands(), ...agentCmds];
  }, [agent.commands]);

  const cmdCount = allCommands.length;
  const prefix = slashPrefix(input);
  const matches = useMemo(
    () => (prefix === null ? [] : matchCommands(allCommands, prefix)),
    [prefix, allCommands],
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

  // Panel çıktıları ajana özeldir; başka ajana geçince taşınmamalı.
  useEffect(() => {
    setLocalEvents([]);
  }, [id]);

  // Seçili satırı görünür tut (uzun komut listelerinde ok tuşuyla gezerken).
  useEffect(() => {
    menuRef.current?.querySelector('.cmd-row.sel')?.scrollIntoView({ block: 'nearest' });
  }, [selected, showMenu]);

  // Boyutlandırma tutamağı yok; alan içeriğe göre büyür (CSS max-height'a kadar).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  function complete(cmd: SlashCommand) {
    setInput(`/${cmd.name} `);
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  /** Terminale panelin kendi ürettiği bir satır ekler (ajana gitmez). */
  function pushLocal(kind: TranscriptEvent['kind'], text: string) {
    setLocalEvents((prev) => [
      ...prev,
      { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), kind, text },
    ]);
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMenuOpen(false);

    // /usage, /clear, /help gibi komutlar CLI'da da istemci tarafında işlenir;
    // ajana gönderilirse "ben bunu çalıştıramam" cevabı gelir.
    const local = matchLocal(text);
    if (local) {
      pushLocal('user', text);
      try {
        const out = await local.cmd.run({
          agent,
          args: local.args,
          clearTranscript: async () => {
            await api.clearTranscript(id);
            setLocalEvents([]);
            await onCleared();
          },
        });
        if (out) pushLocal('local', out);
      } catch (e) {
        pushLocal('error', (e as Error).message);
      }
      return;
    }

    await api.sendMessage(id, text).catch((e) => alert((e as Error).message));
  }

  // Panel çıktıları ajan olaylarıyla zaman sırasına göre harmanlanır.
  const merged = useMemo(
    () => [...events, ...localEvents].sort((a, b) => a.ts - b.ts),
    [events, localEvents],
  );
  const visible = showThinking ? merged : merged.filter((e) => e.kind !== 'thinking');

  return (
    <div className="terminal">
      <div className="terminal-body" ref={scrollRef}>
        {/* CLI'da olduğu gibi karşılama kutusu geçmişin en üstünde kalıcıdır;
            oturum başlayınca kaybolmaz, yukarı kaydırınca hep orada durur. */}
        <div className="cli-welcome">
          <span className="cli-welcome-title">Claude Manager</span>
          <div className="cli-welcome-cols">
            <div className="cli-welcome-left">
              <div className="cli-hello">Merhaba, {agent.config.name}!</div>
              <pre className="cli-logo">{CAT_LOGO}</pre>
              <div className="cli-meta">
                {agent.currentModel ?? agent.config.model} · {ROLE_LABEL[agent.config.role] ?? agent.config.role}
              </div>
              <div className="cli-meta dim">{projectDir || '…'}</div>
            </div>
            <div className="cli-welcome-right">
              <div className="cli-sec-title">Başlarken</div>
              <div className="cli-sec-line">
                <kbd>/</kbd> yazıp komutları gör{cmdCount > 0 ? ` (${cmdCount} tane)` : ''}
              </div>
              <div className="cli-sec-line">Aşağıya doğrudan görev yazabilirsin</div>

              <div className="cli-sec-title">Ekip</div>
              <div className="cli-sec-line">{agentCount} ajan tanımlı</div>
              <div className="cli-sec-line dim">
                {agent.status === 'offline' ? 'Bu ajan kapalı — başlatınca çalışır' : 'Bu ajan hazır'}
              </div>
            </div>
          </div>
        </div>

        {visible.map((ev) => (
          <EventLine key={ev.id} ev={ev} />
        ))}

        {agent.status === 'working' && (
          <div className="cli-busy">
            <span className="cli-spinner">✻</span>
            <span>{agent.currentActivity ? `${agent.currentActivity}…` : 'çalışıyor…'}</span>
            <button className="cli-link danger" onClick={() => api.interrupt(id)}>
              esc ile durdur
            </button>
          </div>
        )}
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
          rows={1}
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
            // CLI'daki gibi: Enter gönderir, Shift+Enter satır atlar.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
              return;
            }
            if (e.key === 'Escape' && agent.status === 'working') {
              e.preventDefault();
              void api.interrupt(id);
            }
          }}
        />
      </div>

      <div className="terminal-hint">
        <span className={`dot dot-${agent.status}`} />
        <span>{STATUS_LABEL[agent.status]}</span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>/</kbd> komutlar{cmdCount > 0 ? ` (${cmdCount})` : ''}
        </span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>Enter</kbd> gönder
        </span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>Shift</kbd>+<kbd>Enter</kbd> satır
        </span>
        <div className="spacer" />
        <label className="cli-toggle">
          <input type="checkbox" checked={showThinking} onChange={(e) => setShowThinking(e.target.checked)} />
          düşünme
        </label>
        <span className="hint-sep">·</span>
        <span className="hint-model">{agent.currentModel ?? agent.config.model}</span>
      </div>
    </div>
  );
}
