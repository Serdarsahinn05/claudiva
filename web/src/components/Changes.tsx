import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { AgentSnapshot, ChangedFile, ChangesResponse } from '../types';
import { L } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
}

const STATUS_LABEL: Record<string, string> = L.changes.status;

/** Durum → mevcut çip renkleri. Yeni bir renk ailesi açmaya gerek yok. */
const STATUS_CHIP: Record<string, string> = {
  added: 'chip-done',
  untracked: 'chip-done',
  modified: 'chip-running',
  renamed: 'chip-running',
  deleted: 'chip-failed',
};

function rel(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  return L.time.ago(s);
}

/** Fark satırını türüne göre sınıflandırır (+ / - / @@ / bağlam). */
function diffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'dl-meta';
  if (line.startsWith('@@')) return 'dl-hunk';
  if (line.startsWith('+')) return 'dl-add';
  if (line.startsWith('-')) return 'dl-del';
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'dl-meta';
  return '';
}

export function Changes({ agents }: Props) {
  const [data, setData] = useState<ChangesResponse | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nameOf = useCallback(
    (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id,
    [agents],
  );

  const load = useCallback(async () => {
    try {
      const res = await api.changes();
      setData(res);
      setError('');
      // Seçili dosya artık değişmemişse seçimi bırak
      setSel((cur) => (cur && res.files.some((f) => f.path === cur) ? cur : null));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sel) {
      setDiff('');
      return;
    }
    let cancelled = false;
    void api
      .changeDiff(sel)
      .then((r) => {
        if (!cancelled) setDiff(r.diff);
      })
      .catch((e: Error) => {
        if (!cancelled) setDiff(L.changes.diffFailed(e.message));
      });
    return () => {
      cancelled = true;
    };
  }, [sel]);

  async function revert(f: ChangedFile) {
    if (!confirm(L.changes.confirm(f.path, f.status === 'untracked'))) return;
    setBusy(true);
    try {
      await api.revertChange(f.path);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <div className="muted center">{error || L.changes.loading}</div>;
  }

  return (
    <div className="changes">
      <section className="pl-head">
        <div>
          <h2 className="plate-title">{L.changes.title}</h2>
          <p className="pl-head-desc">
            {data.isRepo
              ? L.changes.descRepo
              : L.changes.descNoRepo}
          </p>
        </div>
        <button onClick={() => void load()} disabled={busy}>
          Yenile
        </button>
      </section>

      {error && <div className="error">{error}</div>}

      {data.files.length === 0 ? (
        <div className="empty">
          <h2>Temiz</h2>
          <p>
            {data.isRepo
              ? L.changes.clean(data.head ?? null)
              : L.changes.none}
          </p>
        </div>
      ) : (
        <div className="ch-split">
          <div className="ch-list">
            {data.files.map((f) => (
              <button
                key={f.path}
                type="button"
                className={`ch-file${sel === f.path ? ' sel' : ''}`}
                onClick={() => setSel(f.path === sel ? null : f.path)}
              >
                <span className="ch-file-top">
                  <span className={`chip ${STATUS_CHIP[f.status] ?? 'chip-pending'}`}>
                    {STATUS_LABEL[f.status] ?? f.status}
                  </span>
                  <span className="ch-file-path">{f.path}</span>
                </span>
                <span className="ch-file-by">
                  {f.touches.length > 0 ? (
                    <>
                      {nameOf(f.touches[0].agentId)}
                      {f.touches[0].taskId && L.changes.task(f.touches[0].taskId)} · {rel(f.touches[0].ts)}
                    </>
                  ) : (
                    L.changes.noAgent
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="ch-diff">
            {sel ? (
              <>
                <div className="ch-diff-head">
                  <span className="ch-diff-path">{sel}</span>
                  <button
                    className="danger"
                    disabled={busy || !data.isRepo}
                    title={data.isRepo ? L.changes.revertTitle : L.changes.notRepo}
                    onClick={() => {
                      const f = data.files.find((x) => x.path === sel);
                      if (f) void revert(f);
                    }}
                  >
                    {L.actions.revert}
                  </button>
                </div>
                <pre className="ch-diff-body">
                  {diff
                    ? diff.split('\n').map((line, i) => (
                        <span key={i} className={`dl ${diffLineClass(line)}`}>
                          {line || ' '}
                        </span>
                      ))
                    : L.changes.noDiff}
                </pre>
              </>
            ) : (
              <div className="muted center">{L.changes.pick}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
