/**
 * Genel Durum'un Fosfor stili açılışı: ürün sayfası düzeni.
 *
 * Solda mono durum rozeti + kalın başlık (yalnız SON kelime italik serif) +
 * açıklama + iki eylem; sağda son devirlerin akış kartı. Gözlemevi'ndeki
 * gökyüzü haritasının yerini alır. Bütün sayılar ve satırlar gerçek veriden:
 * uydurma metrik ya da süs satırı yok (DESIGN.md, "hiçbiri süs değil").
 */
import type { AgentSnapshot, BudgetState, Task } from '../types';
import { fmtCost } from '../format';
import { L, dateLocale } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  budget: BudgetState | null;
  /** Survey'in durum cümlesi (lead + count + tail birleşik). */
  sentence: string;
  onOpenAgent: (id: string) => void;
  onOpenSettings: () => void;
}

const LEAD_ROLES = new Set(['boss', 'manager', 'team-leader']);
const FLOW_ROWS = 6;

/** Son kelimeyi ayırır: "Bütün ajanlar kapalı." → ["Bütün ajanlar ", "kapalı."] */
function splitLast(s: string): [string, string] {
  const i = s.trimEnd().lastIndexOf(' ');
  return i < 0 ? ['', s] : [s.slice(0, i + 1), s.slice(i + 1)];
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function PhosphorHero({ agents, tasks, budget, sentence, onOpenAgent, onOpenSettings }: Props) {
  const active = agents.filter((a) => a.status !== 'offline').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const lead = agents.find((a) => LEAD_ROLES.has(a.config.role)) ?? agents[0];

  const name = (id: string) =>
    id === 'user' ? L.survey.pxYou : (agents.find((a) => a.config.id === id)?.config.name ?? id);

  const recent = [...tasks]
    .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
    .slice(0, FLOW_ROWS);

  const [head, last] = splitLast(sentence);

  return (
    <div className="px-hero">
      <div className="px-copy">
        <span className="px-tag">
          <i aria-hidden="true" />
          {L.survey.pxTag(active, agents.length, running)}
        </span>
        <h2 className="phase-line px-title">
          {head}
          <em>{last}</em>
        </h2>
        <p className="px-lede">{L.survey.pxLede}</p>
        <div className="px-actions">
          {lead && (
            <button className="primary" onClick={() => onOpenAgent(lead.config.id)}>
              {L.survey.pxOpenLead(lead.config.name)}
            </button>
          )}
          <button onClick={onOpenSettings}>{L.survey.pxSettings}</button>
        </div>
        <div className="px-foot">
          {L.survey.pxFoot(budget ? fmtCost(budget.spentUSD) : '—', done, pending)}
        </div>
      </div>

      <section className="px-flow" aria-label={L.survey.pxFlowTitle}>
        <header className="px-flow-head">
          <span>{L.survey.pxFlowTitle}</span>
          <span className="px-flow-count">{L.survey.pxSteps(tasks.length)}</span>
          <span className={`px-live${running ? ' on' : ''}`}>{running ? L.survey.pxLive : L.survey.pxIdle}</span>
        </header>
        {recent.length ? (
          <ol className="px-flow-list">
            {recent.map((t) => (
              <li key={t.id} className={`px-row s-${t.status}`}>
                <span className="px-dot" aria-hidden="true" />
                <span className="px-row-main">
                  <span className="px-row-title">{t.title}</span>
                  <span className="px-row-route">
                    {name(t.assignedBy)} → {name(t.assignedTo)}
                  </span>
                </span>
                <time className="px-row-time">{fmtTime(t.startedAt ?? t.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-flow-empty">{L.survey.pxEmpty}</div>
        )}
      </section>
    </div>
  );
}
