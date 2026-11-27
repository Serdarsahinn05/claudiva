import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { parseAnsi } from '../ansi';
import type { AgentSnapshot } from '../types';

/**
 * Kullanıcının Claude Code durum çubuğu, ajan terminalinin altında
 * (sunucu: `GET /api/agents/:id/statusline`, server/src/statusline.ts).
 * Ayarda `statusLine` yoksa hiçbir şey çizmez.
 *
 * Claude Code çubuğu her mesajdan sonra tazeler; burada da açılışta, tur
 * bitince (durum `idle`a dönünce) ve model değişince. Arka arkaya olaylarda
 * komut en fazla 2 sn'de bir çalışır.
 */
const MIN_GAP_MS = 2000;

export function StatusLine({ agent }: { agent: AgentSnapshot }) {
  const [text, setText] = useState<string | null>(null);
  const last = useRef(0);
  const id = agent.config.id;
  const trigger = `${agent.status === 'idle' || agent.status === 'offline' ? 'rest' : 'busy'}:${agent.currentModel ?? ''}:${agent.config.effort ?? ''}:${agent.sessionId ?? ''}`;

  useEffect(() => {
    let live = true;
    const wait = Math.max(0, last.current + MIN_GAP_MS - Date.now());
    const t = setTimeout(() => {
      last.current = Date.now();
      api
        .statusLine(id)
        .then((r) => live && setText(r.text))
        .catch(() => live && setText(null));
    }, wait);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [id, trigger]);

  if (!text) return null;
  return (
    <pre className="statusline" aria-label="statusline">
      {parseAnsi(text).map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color,
            background: s.bg,
            fontWeight: s.bold ? 700 : undefined,
            opacity: s.dim ? 0.65 : undefined,
            fontStyle: s.italic ? 'italic' : undefined,
            textDecoration: s.underline ? 'underline' : undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </pre>
  );
}
