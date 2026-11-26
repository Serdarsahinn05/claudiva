import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { AgentDraft, AitmplAgentsView } from '../types';
import { L } from '../i18n';

/**
 * Ajan formunun "Şablon" bölümü: aitmpl.com ajanlarından birini seçip formu
 * doldurur. Seçim ajan OLUŞTURMAZ; form önizlemedir, kullanıcı gözden
 * geçirip Oluştur der (bkz. docs/AITMPL-ENTEGRASYON.md, 2. adım).
 *
 * Liste sunucunun önbelleğinden gelir; hiç okunmadıysa bölüm açılınca bir
 * kez tazelenir (kullanıcı bölümü açarak katalogu istemiş oluyor).
 */
const SCAN_CHIP: Record<string, string> = {
  MEDIUM: 'chip-warn',
  HIGH: 'chip-failed',
  CRITICAL: 'chip-failed',
};

export function AgentTemplates({ onPick }: { onPick: (d: AgentDraft) => void }) {
  const [view, setView] = useState<AitmplAgentsView | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    setBusy('*');
    try {
      const v = await api.refreshAitmplAgents();
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
        const v = await api.aitmplAgents();
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
  }, []);

  const categories = useMemo(
    () => [...new Set((view?.agents ?? []).map((a) => a.category).filter(Boolean))].sort(),
    [view],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return (view?.agents ?? [])
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
      onPick(await api.aitmplAgentDraft(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="tpl">
      <p className="sk-dialog-note">{L.agentForm.tplNote}</p>
      <div className="sk-tools">
        <input
          className="mem-search"
          placeholder={L.agentForm.tplSearch}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={L.agentForm.tplSearch}
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
          {busy === '*' ? L.skills.refreshing : L.agentForm.tplRefresh}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {!view || (busy === '*' && view.agents.length === 0) ? (
        <div className="muted">{L.agentForm.tplLoading}</div>
      ) : shown.length === 0 ? (
        <div className="muted">{L.agentForm.tplNone}</div>
      ) : (
        <>
          <span className="sk-cat-when">{L.agentForm.tplCount(shown.length)}</span>
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
                    {busy === a.id ? L.agentForm.tplFetching : L.skills.downloads(a.downloads)}
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
