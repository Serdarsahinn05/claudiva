import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { THEMES, setTheme } from '../themes';
import type { AgentSnapshot } from '../types';
import { L } from '../i18n';

export interface Command {
  id: string;
  label: string;
  /** Sağda görünen bağlam (bölüm adı, ajan durumu…). */
  hint?: string;
  /** Etikette geçmeyen ama aranabilir olması gereken kelimeler. */
  keywords?: string;
  run: () => void;
}

/**
 * Claude Code CLI'daki slash menüsüyle aynı sıralama: önce baştan eşleşenler,
 * sonra içinde geçenler. Bulanık eşleştirme bilerek yok — harfleri atlayan
 * eşleşmeler kısa listelerde alakasız sonuçları öne taşıyor.
 */
function match(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const hay = (c: Command) => `${c.label} ${c.keywords ?? ''} ${c.hint ?? ''}`.toLowerCase();
  const starts = commands.filter((c) => c.label.toLowerCase().startsWith(q));
  const contains = commands.filter((c) => !starts.includes(c) && hay(c).includes(q));
  return [...starts, ...contains];
}

interface Props {
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => match(commands, query), [commands, query]);

  // Liste değişince seçim taşabilir; başa sar.
  useEffect(() => setSel(0), [query]);

  // Seçili satır her zaman görünür kalsın (ok tuşuyla listeden kayınca).
  useEffect(() => {
    listRef.current?.querySelector('.cmd-row.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((i) => (shown.length ? (i + 1) % shown.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((i) => (shown.length ? (i - 1 + shown.length) % shown.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = shown[sel];
      if (!cmd) return;
      // Önce kapat: komut sekme değiştirirse palet arkada asılı kalmasın.
      onClose();
      cmd.run();
    }
  }

  return (
    <Modal onClose={onClose} align="top">
      <div className="pal">
        <input
          className="pal-input"
          autoFocus
          value={query}
          placeholder={L.cmdPalette.placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={L.cmdPalette.aria}
        />
        <div className="pal-list" ref={listRef}>
          {shown.map((c, i) => (
            <div
              key={c.id}
              className={`cmd-row${i === sel ? ' sel' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                onClose();
                c.run();
              }}
            >
              <span className="cmd-name">{c.label}</span>
              {c.hint && <span className="cmd-desc">{c.hint}</span>}
            </div>
          ))}
          {shown.length === 0 && <div className="muted small pal-empty">{L.cmdPalette.empty}</div>}
        </div>
        <div className="pal-foot">
          <span>{L.extra.navigate}</span>
          <span>⏎ {L.cmdPalette.run}</span>
          <span>esc {L.cmdPalette.close}</span>
        </div>
      </div>
    </Modal>
  );
}

/** Tema seçenekleri palete ayrı komutlar olarak açılır — modal açmadan geçiş. */
export function themeCommands(): Command[] {
  return THEMES.map((t) => ({
    id: `theme:${t.id}`,
    label: `Tema: ${t.name}`,
    hint: t.group,
    keywords: 'tema theme renk görünüm',
    run: () => setTheme(t.id),
  }));
}

export function agentCommands(
  agents: AgentSnapshot[],
  open: (id: string) => void,
  toggle: (a: AgentSnapshot) => void,
): Command[] {
  const out: Command[] = [];
  for (const a of agents) {
    out.push({
      id: `open:${a.config.id}`,
      label: L.cmdPalette.openTerminal(a.config.name),
      hint: a.status,
      keywords: `ajan terminal ${a.config.id} ${a.config.role}`,
      run: () => open(a.config.id),
    });
    out.push({
      id: `toggle:${a.config.id}`,
      label: a.status === 'offline' ? L.cmdPalette.start(a.config.name) : L.cmdPalette.stop(a.config.name),
      hint: a.status,
      keywords: `ajan başlat durdur ${a.config.id}`,
      run: () => toggle(a),
    });
  }
  return out;
}
