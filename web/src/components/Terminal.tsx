import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgentSnapshot,
  BudgetState,
  SlashCommand,
  Task,
  TranscriptEvent,
  UsageSummary,
} from '../types';
import { api } from '../api';
import { fmtCost, fmtNum, ROLE_LABEL, STATUS_LABEL, totalTokens } from '../format';
import { commandsFor, matchCommands, slashPrefix } from '../slashMenu';
import { sendToAgent } from '../agentSend';
import type { CliSkin } from '../cliSkins';
import { useCliSkin } from '../cliSkins';
import { SkinnedTranscript } from './SkinnedTranscript';
import { setToolDetail, useToolDetail } from '../toolDetail';
import { SkinnedPermission } from './SkinnedPermission';
import { QuestionForm } from './QuestionForm';
import { StatusLine } from './StatusLine';
import { isQuestion } from '../permissions';
import { SkinnedComposer } from './SkinnedComposer';
import { L, locale } from '../i18n';

/** CLI'ın karşılama maskotunun piksel-art karşılığı (Claude skin). */
const CAT_LOGO = ` ▄▄▄▄▄▄▄
█ ▀▀ ▀▀ █
█  ▀▀▀  █
 ▀█▀ ▀█▀ `;

/** Codex skin: minimal komut istemi işareti (brainless "launch card" >_). */
const CODEX_LOGO = '>_';

/** Grok skin: nokta-matris (braille) çerçeveli elmas — imza dot-matrix marki. */
const GROK_LOGO = `⠿⠿⠿⠿⠿
⠿⠿◆⠿⠿
⠿⠿⠿⠿⠿`;

const SKIN_LOGO: Record<CliSkin, string> = { claude: CAT_LOGO, codex: CODEX_LOGO, grok: GROK_LOGO };

/**
 * Terminalin token/maliyet okuması.
 *
 * Üç ayrı büyüklük, üçü de GERÇEK veri: turun payı (`lastTurn`), ajanın tümel
 * toplamı (`usage`) ve — sınır varsa — günlük bütçe. Bağlam DOLULUĞU bilerek
 * burada yok: penceresinin gerçek üst sınırı yalnızca oturumun kendi kontrol
 * isteğinden geliyor (`/context`), burada göstermek uydurma bir ölçek
 * (sabit MAX) gerektirirdi.
 */
function Readout({ agent, budget }: { agent: AgentSnapshot; budget: BudgetState | null }) {
  const turn = agent.lastTurn;
  const u = agent.usage;
  const overBudget = budget?.exceeded ? 'alarm' : budget?.warn ? 'warn' : null;

  return (
    <>
      {turn && (
        <span className="hint-turn" title={L.terminal.turnTitle(turn.inputTokens, turn.outputTokens)}>
          {L.extra.lastTurn} +{fmtNum(totalTokens(turn))} · {fmtCost(turn.costUSD)}
        </span>
      )}
      <span className="hint-sep">·</span>
      <span className="hint-total" title={L.terminal.totalTitle(agent.config.name, u.requests)}>
        {fmtNum(totalTokens(u))} · {fmtCost(u.costUSD)}
      </span>
      {overBudget && budget && (
        <>
          <span className="hint-sep">·</span>
          <span
            className={`hint-budget ${overBudget}`}
            title={L.terminal.budgetTitle(fmtCost(budget.spentUSD), fmtCost(budget.limitUSD ?? 0))}
          >
            {L.terminal.budget(Math.round(budget.pct ?? 0))}
          </span>
        </>
      )}
      <span className="hint-sep">·</span>
      <span className="hint-model">{agent.currentModel ?? agent.config.model}</span>
    </>
  );
}

interface Props {
  agent: AgentSnapshot;
  events: TranscriptEvent[];
  projectDir: string;
  /** Yerleşik komutların okuduğu panel durumu (bkz. localCommands.LocalContext). */
  agents: AgentSnapshot[];
  tasks: Task[];
  usage: UsageSummary | null;
  budget: BudgetState | null;
  connected: boolean;
  /** /clear sonrası dökümü sunucudan yeniden yüklemek için. */
  onCleared: () => void;
  /** /model, /resume gibi durumu değiştiren komutlardan sonra. */
  onAgentsChanged: () => void;
}

export function Terminal({
  agent,
  events,
  projectDir,
  agents,
  tasks,
  usage,
  budget,
  connected,
  onCleared,
  onAgentsChanged,
}: Props) {
  const [input, setInput] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const detailed = useToolDetail();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = agent.config.id;

  // Terminal tipi TEK global seçim (temalar gibi) — Tema seçicisinden değişir.
  const skin = useCliSkin();

  // Panelin kendi komutları listenin başında durur; ajanınkilerle isim
  // çakışırsa (ör. /clear) panel sürümü kazanır, çünkü yerel işlenir.
  const allCommands = useMemo(() => commandsFor(agent), [agent.commands]);

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

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMenuOpen(false);

    // Yerel komut / ajana mesaj ayrımı tek yerde: agentSend.ts.
    await sendToAgent(text, {
      agent,
      agents,
      tasks,
      usage,
      budget,
      projectDir,
      connected,
      events,
      clearTranscript: async () => {
        await api.clearTranscript(id);
        onCleared();
      },
      refreshAgents: async () => onAgentsChanged(),
    }).catch((e) => alert((e as Error).message));
  }

  const visible = showThinking ? events : events.filter((e) => e.kind !== 'thinking');

  return (
    <div className="terminal" data-cli={skin}>
      <div className="terminal-body" ref={scrollRef}>
        {/* CLI'da olduğu gibi karşılama kutusu geçmişin en üstünde kalıcıdır;
            oturum başlayınca kaybolmaz, yukarı kaydırınca hep orada durur. */}
        <div className="cli-welcome">
          <span className="cli-welcome-title">Claudiva</span>
          <div className="cli-welcome-cols">
            <div className="cli-welcome-left">
              <div className="cli-hello">{L.terminal.hello(agent.config.name)}</div>
              <pre className={`cli-logo cli-logo-${skin}`}>{SKIN_LOGO[skin]}</pre>
              <div className="cli-meta">
                {agent.currentModel ?? agent.config.model} · {(ROLE_LABEL[agent.config.role] ?? agent.config.role).toLocaleLowerCase(locale)}
              </div>
              <div className="cli-meta dim">{projectDir || '…'}</div>
            </div>
            <div className="cli-welcome-right">
              <div className="cli-sec-title">{L.terminal.gettingStarted}</div>
              <div className="cli-sec-line">
                <kbd>/</kbd> {L.terminal.seeCommands}{cmdCount > 0 ? L.terminal.commandCount(cmdCount) : ''}
              </div>
              <div className="cli-sec-line">{L.terminal.typeTask}</div>

              <div className="cli-sec-title">{L.terminal.team}</div>
              <div className="cli-sec-line">{L.terminal.agentsDefined(agents.length)}</div>
              <div className="cli-sec-line dim">
                {agent.status === 'offline' ? L.terminal.offline : L.terminal.ready}
              </div>
            </div>
          </div>
        </div>

        <SkinnedTranscript events={visible} skin={skin} agent={agent} agents={agents} detailed={detailed} />
      </div>

      {agent.pendingPermissions.length > 0 && (
        <div className="perm-wrap" data-cli={skin}>
          {agent.pendingPermissions.map((p) =>
            isQuestion(p) ? (
              <QuestionForm key={p.id} agentId={id} req={p} variant="terminal" />
            ) : (
              <SkinnedPermission key={p.id} agentId={id} req={p} skin={skin} />
            )
          )}
        </div>
      )}

      <SkinnedComposer
        skin={skin}
        agent={agent}
        value={input}
        placeholder={L.terminal.placeholder(agent.config.name)}
        inputRef={inputRef}
        onChange={setInput}
        onBlur={() => setMenuOpen(false)}
        menu={
          showMenu ? (
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
          ) : undefined
        }
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

      <StatusLine agent={agent} />

      <div className="terminal-hint">
        <span className={`led led-${agent.status}`} />
        <span>{STATUS_LABEL[agent.status]}</span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>/</kbd> {L.extra.commands}{cmdCount > 0 ? ` (${cmdCount})` : ''}
        </span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>Enter</kbd> {L.extra.send}
        </span>
        <div className="spacer" />
        <label className="cli-toggle" title={L.terminal.detailsTitle}>
          <input type="checkbox" checked={detailed} onChange={(e) => setToolDetail(e.target.checked)} />
          {L.terminal.details}
        </label>
        <label className="cli-toggle">
          <input type="checkbox" checked={showThinking} onChange={(e) => setShowThinking(e.target.checked)} />
          {L.terminal.thinking}
        </label>
        <span className="hint-sep">·</span>
        <Readout agent={agent} budget={budget} />
      </div>
    </div>
  );
}
