import type { AgentSnapshot, TranscriptEvent } from '../types';
import type { CliSkin } from '../cliSkins';
import { parseTool, diffCounts } from '../toolParse';
// Claude
import { ClaudeMessage } from './brainless/claude/claude-message';
import { ClaudeToolCall } from './brainless/claude/claude-tool-call';
import { ClaudeDiff } from './brainless/claude/claude-diff';
import { ClaudeThinking } from './brainless/claude/claude-thinking';
// Codex
import { CodexMessage } from './brainless/codex/codex-message';
import { CodexExec } from './brainless/codex/codex-exec';
import { CodexWorking } from './brainless/codex/codex-working';
// Grok
import { GrokMessage } from './brainless/grok/grok-message';
import { GrokThought } from './brainless/grok/grok-thought';
import { GrokTool } from './brainless/grok/grok-tool';
import { GrokWrite } from './brainless/grok/grok-write';
import { GrokWorking } from './brainless/grok/grok-working';

const MAX_DIFF = 60;

/** tool_use, onu izleyen tool_result ile eşleştirilmiş tek öğe. */
interface ToolItem {
  kind: 'tool';
  id: string;
  toolName: string;
  input: string;
  result?: string;
  isError?: boolean;
}
type Item =
  | { kind: 'user' | 'assistant' | 'thinking' | 'error' | 'system'; id: string; text: string }
  | ToolItem;

/**
 * Düz olay akışını render öğelerine çevirir: tool_use, kendisini izleyen ilk
 * tool_result ile birleştirilir (brainless araç bileşenleri sonucu birlikte
 * ister). Eşi olmayan tool_result sistem satırı olur.
 */
function buildItems(events: TranscriptEvent[]): Item[] {
  const items: Item[] = [];
  let pending: ToolItem | null = null;
  for (const ev of events) {
    switch (ev.kind) {
      case 'tool_use': {
        pending = { kind: 'tool', id: ev.id, toolName: ev.toolName ?? '', input: ev.input ?? '' };
        items.push(pending);
        break;
      }
      case 'tool_result': {
        if (pending && pending.result === undefined) {
          pending.result = ev.text ?? '';
          pending.isError = !!ev.meta?.isError;
          pending = null;
        } else {
          items.push({ kind: 'system', id: ev.id, text: ev.text ?? '' });
        }
        break;
      }
      case 'user':
        items.push({ kind: 'user', id: ev.id, text: ev.text ?? '' });
        break;
      case 'text':
        items.push({ kind: 'assistant', id: ev.id, text: ev.text ?? '' });
        break;
      case 'thinking':
        items.push({ kind: 'thinking', id: ev.id, text: ev.text ?? '' });
        break;
      case 'error':
        items.push({ kind: 'error', id: ev.id, text: ev.text ?? '' });
        break;
      case 'result':
        // Tur sonu satırı skinlerde ayrıca gösterilmiyor (fake süre üretmemek için).
        break;
      default:
        items.push({ kind: 'system', id: ev.id, text: ev.text ?? '' });
    }
  }
  return items;
}

function cap<T>(arr: T[]): T[] {
  return arr.length > MAX_DIFF ? arr.slice(0, MAX_DIFF) : arr;
}

function ClaudeItem({ item }: { item: Item }) {
  if (item.kind === 'tool') {
    const p = parseTool(item.toolName, item.input);
    if (p.diff) {
      const lines = [
        ...cap(p.diff.removed).map((text) => ({ type: 'del' as const, text })),
        ...cap(p.diff.added).map((text) => ({ type: 'add' as const, text })),
      ];
      return <ClaudeDiff file={p.arg} summary={item.result} lines={lines} />;
    }
    const multiline = (item.result ?? '').includes('\n');
    return (
      <ClaudeToolCall
        tool={p.label}
        arg={p.arg}
        result={multiline ? (item.result ?? '').split('\n')[0] : item.result ?? ''}
        status={item.isError ? 'error' : 'success'}
      >
        {multiline ? item.result : undefined}
      </ClaudeToolCall>
    );
  }
  if (item.kind === 'user') return <ClaudeMessage role="user">{item.text}</ClaudeMessage>;
  if (item.kind === 'assistant') return <ClaudeMessage>{item.text}</ClaudeMessage>;
  if (item.kind === 'thinking')
    return <div className="skin-dim" style={{ fontStyle: 'italic' }}>{item.text}</div>;
  if (item.kind === 'error') return <div style={{ color: '#f7768e' }}>{item.text}</div>;
  return <div className="skin-dim">{item.text}</div>;
}

function CodexItem({ item }: { item: Item }) {
  if (item.kind === 'tool') {
    const p = parseTool(item.toolName, item.input);
    let command: string;
    if (p.diff) command = `Edited ${p.file ?? p.arg}`;
    else if (p.command) command = `Ran ${p.command}`;
    else if (p.label === 'Read') command = `Read ${p.file ?? p.arg}`;
    else command = `${p.label} ${p.arg}`.trim();
    const result = p.diff ? diffCounts(p.diff) : item.isError ? '→ hata' : item.result ? '→ tamam' : '';
    const multiline = (item.result ?? '').includes('\n');
    return (
      <CodexExec command={command} result={result}>
        {multiline ? item.result : undefined}
      </CodexExec>
    );
  }
  if (item.kind === 'user') return <CodexMessage role="user">{item.text}</CodexMessage>;
  if (item.kind === 'assistant') return <CodexMessage>{item.text}</CodexMessage>;
  if (item.kind === 'error') return <div style={{ color: '#f7768e' }}>{item.text}</div>;
  return <div className="skin-dim">{item.text}</div>;
}

function GrokItem({ item }: { item: Item }) {
  if (item.kind === 'tool') {
    const p = parseTool(item.toolName, item.input);
    if (p.diff) {
      return (
        <>
          <GrokTool variant="card" title={`${p.verb} ${p.file ?? p.arg}`} />
          <GrokWrite
            before={cap(p.diff.removed).map((text) => ({ text }))}
            after={cap(p.diff.added).map((text) => ({ text }))}
          />
        </>
      );
    }
    return (
      <GrokTool verb={p.verb} path={p.arg}>
        {item.result ? <span className="skin-dim">{item.result}</span> : undefined}
      </GrokTool>
    );
  }
  if (item.kind === 'user') return <GrokMessage role="user">{item.text}</GrokMessage>;
  if (item.kind === 'assistant') return <GrokMessage>{item.text}</GrokMessage>;
  if (item.kind === 'thinking') return <GrokThought>{item.text}</GrokThought>;
  if (item.kind === 'error') return <div style={{ color: '#ff6666' }}>{item.text}</div>;
  return <div className="skin-dim">{item.text}</div>;
}

export function SkinnedTranscript({
  events,
  skin,
  agent,
}: {
  events: TranscriptEvent[];
  skin: CliSkin;
  agent: AgentSnapshot;
}) {
  const items = buildItems(events);
  const Item = skin === 'codex' ? CodexItem : skin === 'grok' ? GrokItem : ClaudeItem;
  const working = agent.status === 'working';
  return (
    <div className="skin-transcript" data-cli={skin}>
      {items.map((it) => (
        <Item key={it.id} item={it} />
      ))}
      {working && skin === 'claude' && <ClaudeThinking />}
      {working && skin === 'codex' && <CodexWorking />}
      {working && skin === 'grok' && (
        <GrokWorking label={agent.currentActivity ? `${agent.currentActivity}…` : 'Yanıt bekleniyor…'} />
      )}
    </div>
  );
}
