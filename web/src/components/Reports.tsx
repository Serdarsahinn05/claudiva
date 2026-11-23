import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { AgentSnapshot, Report, TaskStatus } from '../types';
import { L, dateLocale } from '../i18n';

/**
 * Raporlar paneli — sonuçlanmış görevler ve KANITI.
 *
 * Görevler paneli akışı gösteriyor (kim ne yapıyor, sırada ne var); burada iş
 * BİTTİKTEN sonrası var ve iki farklı türde kayıt yan yana duruyor:
 *
 *   · **Rapor** — ajanın kendi anlatısı (`Task.result`). İddia.
 *   · **Dokunulan dosyalar** — o görev sırasında gerçekten yazılanlar
 *     (`ChangeLog.filesForTask`). Ölçüm.
 *
 * İkisini ayırmak bu panelin bütün amacı: "bitirdim" diyen ama hiçbir dosyaya
 * dokunmamış bir görev, listede kendini ele verir. Bu yüzden dosya sayısı
 * raporun yanında bir rozet olarak duruyor ve sıfır olduğunda susmuyor.
 */

const STATUS_CHIP: Record<TaskStatus, string> = {
  done: 'chip-done',
  failed: 'chip-failed',
  running: 'chip-running',
  pending: 'chip-pending',
};
const STATUS_LABEL = L.taskStatus as Record<TaskStatus, string>;

type Filter = 'all' | 'done' | 'failed';
const FILTER_LABEL = L.reports.filter as Record<Filter, string>;

function when(ts: number): string {
  return new Date(ts).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dur(from?: number, to?: number): string {
  if (!from || !to) return '';
  const s = Math.round((to - from) / 1000);
  if (s < 60) return `${s}sn`;
  if (s < 3600) return `${Math.floor(s / 60)}dk ${s % 60}sn`;
  return `${Math.floor(s / 3600)}sa ${Math.round((s % 3600) / 60)}dk`;
}

interface Props {
  /** Takım kapsamı: yalnızca bu ajanların raporları listelenir. */
  agents: AgentSnapshot[];
}

export function Reports({ agents }: Props) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const nameOf = useCallback(
    (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id,
    [agents],
  );

  const load = useCallback(async () => {
    try {
      setReports(await api.reports());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ids = useMemo(() => new Set(agents.map((a) => a.config.id)), [agents]);

  const shown = useMemo(() => {
    const list = (reports ?? []).filter((r) => ids.has(r.task.assignedTo));
    return filter === 'all' ? list : list.filter((r) => r.task.status === filter);
  }, [reports, filter, ids]);

  const counts = useMemo(() => {
    const list = (reports ?? []).filter((r) => ids.has(r.task.assignedTo));
    return {
      all: list.length,
      done: list.filter((r) => r.task.status === 'done').length,
      failed: list.filter((r) => r.task.status === 'failed').length,
    };
  }, [reports, ids]);

  if (!reports) return <div className="muted center">{error || L.reports.loading}</div>;

  return (
    <div className="reports">
      <section className="pl-head">
        <div>
          <h2 className="plate-title">{L.reports.title}</h2>
          <p className="pl-head-desc">
            {L.reports.desc}
          </p>
        </div>
        <button onClick={() => void load()}>{L.actions.refresh}</button>
      </section>

      {error && <div className="error">{error}</div>}

      {/* Süzgeç şeridi Görevler paneliyle AYNI sınıfları kullanır: iki panelde
          aynı işi yapan kontrol iki farklı şey gibi görünmesin. */}
      <div className="tb-filters">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button key={f} className={`tb-filter${filter === f ? ' sel' : ''}`} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]} <span className="tb-filter-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <h2>{L.reports.emptyTitle}</h2>
          <p>
            {L.reports.emptyA}<strong>{L.reports.emptyTasks}</strong>{L.reports.emptyB}
          </p>
        </div>
      ) : (
        <div className="rp-list">
          {shown.map((r) => {
            const t = r.task;
            const isOpen = openId === t.id;
            return (
              <article key={t.id} className={`rp-item${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="rp-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : t.id)}
                >
                  <span className="task-caret" aria-hidden="true">
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span className={`chip ${STATUS_CHIP[t.status] ?? 'chip-pending'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  <span className="rp-title">{t.title}</span>
                  <span className="rp-by">
                    {nameOf(t.assignedTo)}
                    {r.subtasks.length > 0 && ` +${r.subtasks.length}`}
                  </span>
                  {/* Kanıt rozeti: sıfırsa da yazılır — sessiz kalmak "yaptım"
                      iddiasını doğrulanmamış hâlde geçirmek olurdu. */}
                  <span className={`rp-eviq${r.files.length ? '' : ' none'}`}>
                    {r.files.length ? L.reports.files(r.files.length) : L.reports.noFiles}
                  </span>
                  <span className="rp-when">{when(t.finishedAt ?? t.createdAt)}</span>
                </button>

                {isOpen && (
                  <div className="rp-body">
                    <div className="rp-meta">
                      <span>
                        {L.reports.givenBy}<strong>{t.assignedBy === 'user' ? L.reports.user : nameOf(t.assignedBy)}</strong>
                      </span>
                      {t.startedAt && t.finishedAt && <span>{L.reports.duration(dur(t.startedAt, t.finishedAt))}</span>}
                      {t.chainId && <span>{L.reports.chainStep((t.stepIndex ?? 0) + 1)}</span>}
                      <span className="dim">#{t.id}</span>
                    </div>

                    <h4 className="rp-sub">{L.reports.givenWork}</h4>
                    <pre className="rp-prompt">{t.prompt}</pre>

                    <h4 className="rp-sub">Rapor</h4>
                    <pre className="rp-result">{t.result || L.reports.noResult}</pre>

                    {/* Delegasyon: iş kimlere bölündü. Üst görevin raporu çoğu
                        zaman "delege ettim" der; asıl işi bunlar yapmıştır. */}
                    {r.subtasks.length > 0 && (
                      <>
                        <h4 className="rp-sub">Bölündüğü işler — {r.subtasks.length}</h4>
                        <ul className="rp-subtasks">
                          {r.subtasks.map((s) => (
                            <li key={s.id}>
                              <span className={`chip ${STATUS_CHIP[s.status] ?? 'chip-pending'}`}>
                                {STATUS_LABEL[s.status] ?? s.status}
                              </span>
                              <span className="rp-sub-title">{s.title}</span>
                              <span className="rp-sub-by">{nameOf(s.assignedTo)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <h4 className="rp-sub">
                      {L.reports.evidence}
                      {r.subtasks.length > 0 && <span className="rp-sub-note">{L.reports.withSubtasks}</span>}
                    </h4>
                    {r.files.length ? (
                      <ul className="rp-files">
                        {r.files.map((f, i) => (
                          <li key={`${f.path}-${f.ts}-${i}`}>
                            <span className="rp-file-path">{f.path}</span>
                            <span className="rp-file-meta">
                              {f.tool} · {nameOf(f.agentId)} ·{' '}
                              {new Date(f.ts).toLocaleTimeString(dateLocale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rp-none">
                        {L.reports.noneWritten}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
