import { useEffect, useRef, useState } from 'react';
import type { AgentSnapshot, TranscriptEvent } from '../types';
import { api } from '../api';
import { STATUS_LABEL } from '../format';

interface Props {
  agent: AgentSnapshot;
  events: TranscriptEvent[];
}

function EventLine({ ev }: { ev: TranscriptEvent }) {
  const time = new Date(ev.ts).toLocaleTimeString('tr-TR');
  switch (ev.kind) {
    case 'user':
      return (
        <div className="ev ev-user">
          <span className="ev-time">{time}</span>
          <span className="ev-label">SEN →</span> {ev.text}
        </div>
      );
    case 'text':
      return (
        <div className="ev ev-text">
          <span className="ev-time">{time}</span>
          {ev.text}
        </div>
      );
    case 'thinking':
      return (
        <div className="ev ev-thinking">
          <span className="ev-time">{time}</span>
          <em>💭 {ev.text}</em>
        </div>
      );
    case 'tool_use':
      return (
        <div className="ev ev-tool">
          <span className="ev-time">{time}</span>
          <span className="ev-label">🔧 {ev.toolName}</span> <code>{ev.input}</code>
        </div>
      );
    case 'tool_result':
      return (
        <div className={`ev ev-toolresult${ev.meta?.isError ? ' ev-error' : ''}`}>
          <span className="ev-time">{time}</span>
          <span className="ev-label">↩</span> <code>{ev.text}</code>
        </div>
      );
    case 'result':
      return (
        <div className="ev ev-result">
          <span className="ev-time">{time}</span>
          <span className="ev-label">✅ Tur bitti</span>
          {typeof ev.meta?.costUSD === 'number' && <span className="ev-cost"> (${(ev.meta.costUSD as number).toFixed(4)})</span>}
        </div>
      );
    case 'error':
      return (
        <div className="ev ev-error">
          <span className="ev-time">{time}</span>
          <span className="ev-label">⛔</span> {ev.text}
        </div>
      );
    default:
      return (
        <div className="ev ev-system">
          <span className="ev-time">{time}</span>
          <span className="ev-label">ℹ</span> {ev.text}
        </div>
      );
  }
}

export function Terminal({ agent, events }: Props) {
  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const id = agent.config.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length, agent.pendingPermissions.length]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
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
        {visible.length === 0 && <div className="muted center">Henüz mesaj yok. Aşağıdan görev ver.</div>}
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
        <textarea
          rows={2}
          value={input}
          placeholder={`${agent.config.name} ajanına görev / mesaj yaz… (Ctrl+Enter gönderir)`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
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
    </div>
  );
}
