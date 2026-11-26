import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { AitmplKind, AitmplListView } from '../types';
import { L } from '../i18n';

/**
 * aitmpl.com'dan tek dosyalık bir şablon seçici (ajan ya da komut).
 *
 * Seçim hiçbir şey OLUŞTURMAZ: `onPick` taslağı indirip bir formu doldurur,
 * kullanıcı gözden geçirip kendisi kaydeder (bkz. docs/AITMPL-ENTEGRASYON.md).
 * Kullananlar: ajan formunun Şablon bölümü, Promptlar'ın "aitmpl'den ekle"si.
 *
 * Liste sunucunun önbelleğinden gelir; hiç okunmadıysa seçici açılınca bir
 * kez tazelenir (kullanıcı seçiciyi açarak katalogu istemiş oluyor).
 */
const SCAN_CHIP: Record<string, string> = {
  MEDIUM: 'chip-warn',
  HIGH: 'chip-failed',
  CRITICAL: 'chip-failed',
};

export function AitmplPicker({
  kind,
  note,
  onPick,
}: {
  kind: AitmplKind;
  note: string;
  /** Taslağı indirip formu doldurur; hata fırlatırsa seçicide gösterilir. */
  onPick: (id: string) => Promise<void>;
}) {
  const [view, setView] = useState<AitmplListView | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    setBusy('*');
    try {
      const v = await api.refreshAitmplList(kind);
      setView(v);
      setError(v.error ?? '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const v = await api.aitmplList(kind);
        if (!live) return;
        setView(v);
        if (v.fetchedAt === null) void refresh();
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
    // `refresh` her çizimde yeni; tür değişmedikçe yeniden okumaya gerek yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const categories = useMemo(
    () => [...new Set((view?.items ?? []).map((a) => a.category).filter(Boolean))].sort(),
    [view],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return (view?.items ?? [])
      .filter((a) => !category || a.category === category)
      .filter(
        (a) =>
          !needle ||
          a.name.toLocaleLowerCase('tr').includes(needle) ||
          a.category.toLocaleLowerCase('tr').includes(needle) ||
          a.summary.toLocaleLowerCase('tr').includes(needle),
      );
  }, [view, q, category]);

  async function pick(id: string) {
    setBusy(id);
    setError('');
    try {
      await onPick(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="tpl">
      <p className="sk-dialog-note">{note}</p>
      <div className="sk-tools">
        <input
          className="mem-search"
          placeholder={L.aitmpl.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={L.aitmpl.search}
        />
        {categories.length > 0 && (
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={L.skills.categoryAria}>
            <option value="">{L.skills.allCategories}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => void refresh()} disabled={busy !== null}>
          {busy === '*' ? L.skills.refreshing : L.aitmpl.refresh}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {!view || (busy === '*' && view.items.length === 0) ? (
        <div className="muted">{L.aitmpl.loading}</div>
      ) : shown.length === 0 ? (
        <div className="muted">{L.aitmpl.none}</div>
      ) : (
        <>
          <span className="sk-cat-when">{L.aitmpl.count(shown.length)}</span>
          <div className="tpl-list">
            {shown.map((a) => (
              <button
                type="button"
                key={a.id}
                className="tpl-row"
                onClick={() => void pick(a.id)}
                disabled={busy !== null}
              >
                <span className="sk-top">
                  <span className="sk-name">{a.name}</span>
                  <span className="badge sk-repo">{a.category}</span>
                  {a.scan && SCAN_CHIP[a.scan.severity] && (
                    <span className={`chip ${SCAN_CHIP[a.scan.severity]}`} title={L.skills.scanTitle(a.scan.score)}>
                      {L.skills.scanLabel[a.scan.severity]}
                    </span>
                  )}
                  <span className="sk-cat-when">
                    {busy === a.id ? L.aitmpl.fetching : L.skills.downloads(a.downloads)}
                  </span>
                </span>
                {a.summary && <span className="sk-desc">{a.summary}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
