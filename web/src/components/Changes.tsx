import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { AgentSnapshot, ChangedFile, ChangesResponse } from '../types';

interface Props {
  agents: AgentSnapshot[];
}

const STATUS_LABEL: Record<string, string> = {
  added: 'eklendi',
  modified: 'değişti',
  deleted: 'silindi',
  renamed: 'taşındı',
  untracked: 'yeni',
};

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
  if (s < 60) return `${s}sn önce`;
  if (s < 3600) return `${Math.round(s / 60)}dk önce`;
  if (s < 86400) return `${Math.round(s / 3600)}sa önce`;
  return `${Math.round(s / 86400)}g önce`;
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
        if (!cancelled) setDiff(`(fark alınamadı: ${e.message})`);
      });
    return () => {
      cancelled = true;
    };
  }, [sel]);

  async function revert(f: ChangedFile) {
    const verb = f.status === 'untracked' ? 'silinsin' : 'son commit hâline döndürülsün';
    if (!confirm(`"${f.path}" ${verb} mi?\n\nBu işlem geri alınamaz.`)) return;
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
    return <div className="muted center">{error || 'Değişiklikler okunuyor…'}</div>;
  }

  return (
    <div className="changes">
      <section className="pl-head">
        <div>
          <span className="bridge-mod-label" style={{ position: 'static' }}>
            Değişiklikler
          </span>
          <p className="pl-head-desc">
            {data.isRepo
              ? 'Çalışma ağacında son commit’e göre farklı olan dosyalar. Ajanların dokunduğu dosyalar işaretli.'
              : 'Bu klasör bir git deposu değil — fark ve geri alma kullanılamıyor. Yalnızca ajanların dokunduğu dosyalar listelenir.'}
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
              ? `Çalışma ağacı son commit ile aynı${data.head ? ` (${data.head})` : ''}.`
              : 'Kayıtlı bir değişiklik yok.'}
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
                      {f.touches[0].taskId && ` · görev ${f.touches[0].taskId}`} · {rel(f.touches[0].ts)}
                    </>
                  ) : (
                    'ajan kaydı yok — senin değişikliğin olabilir'
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
                    title={data.isRepo ? 'Son commit hâline döndür' : 'Git deposu değil'}
                    onClick={() => {
                      const f = data.files.find((x) => x.path === sel);
                      if (f) void revert(f);
                    }}
                  >
                    Geri al
                  </button>
                </div>
                <pre className="ch-diff-body">
                  {diff
                    ? diff.split('\n').map((line, i) => (
                        <span key={i} className={`dl ${diffLineClass(line)}`}>
                          {line || ' '}
                        </span>
                      ))
                    : '(fark yok)'}
                </pre>
              </>
            ) : (
              <div className="muted center">Farkını görmek için soldan bir dosya seç.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
