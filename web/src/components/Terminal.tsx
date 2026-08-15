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
import { fmtCost, fmtNum, STATUS_LABEL, totalTokens } from '../format';
import { isLocal, localAsSlashCommands, matchLocal } from '../localCommands';
import type { CliSkin } from '../cliSkins';
import { useCliSkin } from '../cliSkins';
import { SkinnedTranscript } from './SkinnedTranscript';
import { SkinnedPermission } from './SkinnedPermission';
import { SkinnedComposer } from './SkinnedComposer';

const ROLE_LABEL: Record<string, string> = {
  boss: 'patron',
  manager: 'yönetici',
  worker: 'çalışan',
};

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
        <span className="hint-turn" title={`son tur: ${turn.inputTokens} girdi + ${turn.outputTokens} çıktı token`}>
          son tur +{fmtNum(totalTokens(turn))} · {fmtCost(turn.costUSD)}
        </span>
      )}
      <span className="hint-sep">·</span>
      <span className="hint-total" title={`${agent.config.name}: tüm zamanlar, ${u.requests} istek`}>
        {fmtNum(totalTokens(u))} · {fmtCost(u.costUSD)}
      </span>
      {overBudget && budget && (
        <>
          <span className="hint-sep">·</span>
          <span
            className={`hint-budget ${overBudget}`}
            title={`bugün ${fmtCost(budget.spentUSD)} / ${fmtCost(budget.limitUSD ?? 0)}`}
          >
            bütçe %{Math.round(budget.pct ?? 0)}
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

  /**
   * Panelin kendi ürettiği satırı sunucudaki döküme yazar (ajana gitmez).
   * Bileşen state'inde tutulsaydı başka ajana geçince kaybolurdu.
   */
  async function pushLocal(kind: 'user' | 'local' | 'error', text: string) {
    await api.pushLocal(id, kind, text).catch(() => {});
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
      await pushLocal('user', text);
      try {
        const out = await local.cmd.run({
          agent,
          args: local.args,
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
        });
        if (out) await pushLocal('local', out);
      } catch (e) {
        await pushLocal('error', (e as Error).message);
      }
      return;
    }

    await api.sendMessage(id, text).catch((e) => alert((e as Error).message));
  }

  const visible = showThinking ? events : events.filter((e) => e.kind !== 'thinking');

  return (
    <div className="terminal" data-cli={skin}>
      <div className="terminal-body" ref={scrollRef}>
        {/* CLI'da olduğu gibi karşılama kutusu geçmişin en üstünde kalıcıdır;
            oturum başlayınca kaybolmaz, yukarı kaydırınca hep orada durur. */}
        <div className="cli-welcome">
          <span className="cli-welcome-title">Claude Manager</span>
          <div className="cli-welcome-cols">
            <div className="cli-welcome-left">
              <div className="cli-hello">Merhaba, {agent.config.name}!</div>
              <pre className={`cli-logo cli-logo-${skin}`}>{SKIN_LOGO[skin]}</pre>
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
              <div className="cli-sec-line">{agents.length} ajan tanımlı</div>
              <div className="cli-sec-line dim">
                {agent.status === 'offline' ? 'Bu ajan kapalı — başlatınca çalışır' : 'Bu ajan hazır'}
              </div>
            </div>
          </div>
        </div>

        <SkinnedTranscript events={visible} skin={skin} agent={agent} />
      </div>

      {agent.pendingPermissions.length > 0 && (
        <div className="perm-wrap" data-cli={skin}>
          {agent.pendingPermissions.map((p) => (
            <SkinnedPermission key={p.id} agentId={id} req={p} skin={skin} />
          ))}
        </div>
      )}

      <SkinnedComposer
        skin={skin}
        agent={agent}
        value={input}
        placeholder={`${agent.config.name} ajanına görev ver…`}
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

      <div className="terminal-hint">
        <span className={`led led-${agent.status}`} />
        <span>{STATUS_LABEL[agent.status]}</span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>/</kbd> komutlar{cmdCount > 0 ? ` (${cmdCount})` : ''}
        </span>
        <span className="hint-sep">·</span>
        <span>
          <kbd>Enter</kbd> gönder
        </span>
        <div className="spacer" />
        <label className="cli-toggle">
          <input type="checkbox" checked={showThinking} onChange={(e) => setShowThinking(e.target.checked)} />
          düşünme
        </label>
        <span className="hint-sep">·</span>
        <Readout agent={agent} budget={budget} />
      </div>
    </div>
  );
}
