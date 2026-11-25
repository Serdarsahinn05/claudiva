/**
 * Genel Durum'un Stüdyo stili gövdesi: gök haritası yerine iki sade kart.
 *
 * - **Ekip:** her ajan bir satır. Sıra önem sırasıdır (Survey'in durum
 *   cümlesiyle aynı mantık): izin bekleyen, çalışan, açık, kapalı. Satır
 *   terminali açar; seçili ajan vurgulanır.
 * - **Son devirler:** kim kime hangi işi verdi, en yenisi üstte.
 *
 * Gözlemevi'nin gökyüzündeki her kanal burada da gerçek veriden gelir
 * (DESIGN.md, "hiçbiri süs değil"): token = gökteki kadir, durum hapı =
 * yıldızın rengi/biçimi, devir satırı = takımyıldız çizgisi. Uydurma metrik
 * ya da dolgu satırı yok.
 */
import type { AgentSnapshot, Task } from '../types';
import { ROLE_LABEL, STATUS_LABEL, fmtNum, totalTokens } from '../format';
import { L, dateLocale } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  selectedId: string | null;
  onOpenAgent: (id: string) => void;
}

const HANDOFF_ROWS = 6;

/** Durum sırası: seni bekleyen en üstte, kapalı en altta. */
function rank(a: AgentSnapshot): number {
  if (a.pendingPermissions.length > 0) return 0;
  if (a.status === 'working') return 1;
  if (a.status !== 'offline') return 2;
  return 3;
}

/** "Proje Yöneticisi" → "PY"; tek kelimede ilk iki harf. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2);
  return s.toLocaleUpperCase(dateLocale);
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
}

export function StudioOverview({ agents, tasks, selectedId, onOpenAgent }: Props) {
  const sorted = [...agents].sort((a, b) => rank(a) - rank(b) || a.config.name.localeCompare(b.config.name));
  const active = agents.filter((a) => a.status !== 'offline').length;

  const name = (id: string) =>
    id === 'user' ? L.survey.pxYou : (agents.find((a) => a.config.id === id)?.config.name ?? id);

  // Devir = bir ajanın (ya da kullanıcının) başka bir ajana verdiği iş.
  const handoffs = [...tasks]
    .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
    .slice(0, HANDOFF_ROWS);

  /**
   * Satırın ikinci satırı yeni bilgi taşır, hapı tekrar etmez: çalışırken
   * şu anki iş, boşta/kapalıyken son işi, hiç işi yoksa ne iş yaptığı.
   */
  const note = (a: AgentSnapshot): string => {
    const waiting = a.pendingPermissions.length;
    if (waiting) return L.survey.stWaitingNote(waiting);
    const mine = tasks.filter((t) => t.assignedTo === a.config.id);
    const running = mine.find((t) => t.status === 'running');
    if (a.status === 'working') return a.currentActivity || running?.title || '';
    const last = mine.sort((x, y) => (y.finishedAt ?? y.createdAt) - (x.finishedAt ?? x.createdAt))[0];
    if (last) return L.survey.stLast(last.title);
    return a.config.description ?? '';
  };

  const pill = (a: AgentSnapshot): { cls: string; label: string } =>
    a.pendingPermissions.length
      ? { cls: 'waiting', label: STATUS_LABEL.waiting }
      : { cls: a.status, label: STATUS_LABEL[a.status] ?? a.status };

  return (
    <div className="st-body">
      <section className="st-card" aria-labelledby="st-team-h">
        <header className="st-card-head">
          <h3 id="st-team-h">{L.survey.stTeam}</h3>
          <span className="st-card-meta">{L.survey.stTeamCount(active, agents.length)}</span>
        </header>
        {sorted.length ? (
          <ul className="st-team">
            {sorted.map((a) => {
              const p = pill(a);
              return (
                <li key={a.config.id}>
                  <button
                    className={`st-agent${a.config.id === selectedId ? ' on' : ''}${a.status === 'offline' ? ' off' : ''}`}
                    onClick={() => onOpenAgent(a.config.id)}
                    aria-label={L.survey.stOpen(a.config.name)}
                  >
                    <span className="st-av" data-role={a.config.role} aria-hidden="true">
                      {initials(a.config.name)}
                    </span>
                    <span className="st-who">
                      <span className="st-name">
                        {a.config.name}
                        <span className="st-role">{ROLE_LABEL[a.config.role] ?? a.config.role}</span>
                      </span>
                      <span className="st-note">{note(a)}</span>
                    </span>
                    <span className={`st-pill s-${p.cls}`}>{p.label}</span>
                    <span className="st-tok" title={L.survey.stTokens(fmtNum(totalTokens(a.usage)))}>
                      {fmtNum(totalTokens(a.usage))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="st-empty">{L.survey.stNoAgents}</p>
        )}
      </section>

      <section className="st-card" aria-labelledby="st-flow-h">
        <header className="st-card-head">
          <h3 id="st-flow-h">{L.survey.stHandoffs}</h3>
          <span className="st-card-meta">{L.survey.pxSteps(tasks.length)}</span>
        </header>
        {handoffs.length ? (
          <ol className="st-flow">
            {handoffs.map((t) => (
              <li key={t.id} className="st-hand">
                <span className={`st-pill s-${t.status}`}>{L.taskStatus[t.status] ?? t.status}</span>
                <span className="st-hand-main">
                  <span className="st-hand-title">{t.title}</span>
                  <span className="st-hand-route">
                    {name(t.assignedBy)} → {name(t.assignedTo)}
                  </span>
                </span>
                <time className="st-hand-time">{fmtTime(t.startedAt ?? t.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="st-empty">{L.survey.stEmpty}</p>
        )}
      </section>
    </div>
  );
}
