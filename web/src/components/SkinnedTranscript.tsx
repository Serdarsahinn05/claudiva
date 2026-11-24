import type { AgentSnapshot, TranscriptEvent } from '../types';
import type { CliSkin } from '../cliSkins';
import { CLI_MARKS } from '../cliSkins';
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
import { L } from '../i18n';
import { friendlyTool } from '../toolFriendly';

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
  | { kind: 'user' | 'assistant' | 'thinking' | 'error' | 'local'; id: string; text: string }
  | { kind: 'system'; id: string; text: string; count?: number }
  | ToolItem;

/** Sade görünümün öğeleri: gruplanmış araç adımları ve başlığa inmiş görev. */
type View =
  | Item
  | { kind: 'tools'; id: string; tools: ToolItem[] }
  | { kind: 'brief'; id: string; title: string; from: string; text: string };

/** Görev kuyruğunun ajana yazdığı mesajın öneki (server/src/tasks/queue.ts). */
const TASK_PREFIX = '# Görev (id:';

/**
 * Ardışık AYNI sistem satırları tek satıra iner (×N). Ekran görüntüsünde
 * "Oturum sürdürülüyor (model: sonnet)" dört kez alt alta duruyordu.
 * Her iki görünümde de uygulanır: tekrar hiçbir bilgi taşımıyor.
 */
function dedupeSystem(items: Item[]): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (it.kind === 'system' && prev?.kind === 'system' && prev.text === it.text) {
      prev.count = (prev.count ?? 1) + 1;
      continue;
    }
    out.push(it.kind === 'system' ? { ...it } : it);
  }
  return out;
}

/**
 * Sade görünüm: art arda araç adımları tek gruba, görev mesajı başlığına iner.
 * Ham hâl kaybolmaz, katlanmış öğenin içinde ayrıntılı görünümle aynı çizilir.
 */
function simplify(items: Item[]): View[] {
  const out: View[] = [];
  for (const it of items) {
    if (it.kind === 'tool') {
      const prev = out[out.length - 1];
      if (prev?.kind === 'tools') prev.tools.push(it);
      else out.push({ kind: 'tools', id: `g-${it.id}`, tools: [it] });
      continue;
    }
    if (it.kind === 'user' && it.text.startsWith(TASK_PREFIX)) {
      const from = /atayan:\s*([^\n]+)/.exec(it.text)?.[1]?.trim() ?? '';
      const title = /^##\s+(.+)$/m.exec(it.text)?.[1]?.trim() ?? '';
      out.push({ kind: 'brief', id: it.id, title, from, text: it.text });
      continue;
    }
    out.push(it);
  }
  return out;
}

/**
 * Panelin kendi komut çıktısı (`/usage`, `/context`, `/status`…).
 *
 * `<pre>` ZORUNLU: bu çıktılar `padEnd` ile sütun hizalar ve blok karakterle
 * çubuk çizer. Diğer öğeler gibi normal bir kapta çizildiğinde boşluklar
 * daraltılıyor ve tablo/çubuk hizası bozuluyordu — döküm skinlere taşınırken
 * kaybolan tek şey buydu.
 */
function LocalOut({ text, mark }: { text: string; mark: string }) {
  return (
    <div className="ev ev-local">
      <span className="ev-mark">{mark}</span>
      <div className="ev-content">
        <pre>{text}</pre>
      </div>
    </div>
  );
}

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
      case 'local':
        items.push({ kind: 'local', id: ev.id, text: ev.text ?? '' });
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
  return <SystemLine item={item} />;
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
  return <SystemLine item={item} />;
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
  return <SystemLine item={item} />;
}

function SystemLine({ item }: { item: Item }) {
  const count = item.kind === 'system' ? item.count : undefined;
  return (
    <div className="skin-dim">
      {'text' in item ? item.text : ''}
      {count && count > 1 ? <span className="tx-count"> ×{count}</span> : null}
    </div>
  );
}

export function SkinnedTranscript({
  events,
  skin,
  agent,
  agents = [],
  detailed = false,
}: {
  events: TranscriptEvent[];
  skin: CliSkin;
  agent: AgentSnapshot;
  /** Ad çözümü için (sade görünümde "Görev verdi → <ad>"). */
  agents?: AgentSnapshot[];
  /** Ayrıntılı (CLI benzeri) görünüm; varsayılan sade (bkz. toolDetail.ts). */
  detailed?: boolean;
}) {
  const items = dedupeSystem(buildItems(events));
  const view: View[] = detailed ? items : simplify(items);
  const Item = skin === 'codex' ? CodexItem : skin === 'grok' ? GrokItem : ClaudeItem;
  const working = agent.status === 'working';
  const nameOf = (id: string) =>
    id === 'user' ? L.chat.you : (agents.find((a) => a.config.id === id)?.config.name ?? id);
  return (
    <div className="skin-transcript" data-cli={skin}>
      {view.map((it) => {
        // Panel çıktısı skinden bağımsız çizilir (yalnızca işareti skine ait):
        // hizalı sütunları her üç skinde de aynı `<pre>` korumak zorunda.
        if (it.kind === 'local') return <LocalOut key={it.id} text={it.text} mark={CLI_MARKS[skin].local} />;
        if (it.kind === 'brief') {
          return (
            <details key={it.id} className="tx-brief">
              <summary>
                <span className="tx-brief-title">{L.friendly.task(it.title || '…')}</span>
                <span className="tx-dim">{L.friendly.from(nameOf(it.from))}</span>
              </summary>
              <pre>{it.text}</pre>
            </details>
          );
        }
        if (it.kind === 'tools') {
          const failed = it.tools.some((t) => t.isError);
          const labels = it.tools.map((t) => friendlyTool(t.toolName, t.input, nameOf));
          // Arka arkaya aynı etiket (ör. üç "Okudu") tek kez yazılır.
          const uniq = labels.filter((l, i) => labels.indexOf(l) === i);
          return (
            <details key={it.id} className={`tx-tools${failed ? ' err' : ''}`}>
              <summary>
                <span className="tx-dot" aria-hidden="true" />
                <span className="tx-steps">{L.friendly.steps(it.tools.length)}</span>
                <span className="tx-labels">{uniq.slice(0, 3).join(' · ')}{uniq.length > 3 ? ' …' : ''}</span>
              </summary>
              <div className="tx-tools-body">
                {it.tools.map((t) => (
                  <Item key={t.id} item={t} />
                ))}
              </div>
            </details>
          );
        }
        return <Item key={it.id} item={it} />;
      })}
      {working && skin === 'claude' && <ClaudeThinking />}
      {working && skin === 'codex' && <CodexWorking />}
      {working && skin === 'grok' && (
        <GrokWorking label={agent.currentActivity ? `${agent.currentActivity}…` : L.awaitingReply} />
      )}
    </div>
  );
}
