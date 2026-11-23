import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type {
  AgentSnapshot,
  BulkResult,
  CatalogSkill,
  CatalogView,
  SkillInfo,
  SkillScope,
} from '../types';
import { L } from '../i18n';

/**
 * Skill paneli — iki kip, iki ayrı soru.
 *
 *  · **Kurulu**: diskte ne var? Aç/kapat, sil, ara.
 *  · **Keşfet**: daha ne olabilirdi? Depolarda ara, işaretle, TOPLU kur.
 *
 * İkisi ayrı kip çünkü kaynakları ayrı: biri dosya sistemi, diğeri ağ. Tek
 * listede birleştirmek "bu satır diskte mi yoksa GitHub'da mı" sorusunu her
 * satırda yeniden sordururdu.
 *
 * Üç kapsam ayrı ayrı gösterilir çünkü SONUÇLARI farklı: global bir skill'i
 * kapatmak kullanıcının BÜTÜN projelerini etkiler, proje kapsamı yalnız bu
 * depoyu, ajan kapsamı yalnız o ajanı. Panel bunu rozetle söylemekle kalmıyor,
 * yıkıcı işlemde ayrıca uyarıyor.
 *
 * "Etkin" hâli uydurma bir bayrak değil, dosya sisteminin kendisi:
 * `SKILL.md` varsa yüklenir, `SKILL.md.disabled` ise yüklenmez (bkz. skills.ts).
 */

const SCOPE_LABEL = L.skills.scope as Record<SkillScope, string>;

const SCOPE_NOTE: Record<SkillScope, string> = {
  global: L.skills.scopeNote.global,
  project: L.skills.scopeNote.project,
  agent: L.skills.scopeNote.agent,
};

function fmtSize(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)} KB`;
  return `${n} B`;
}

function rel(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? L.skills.justNow : L.time.ago(s);
}

type Tab = 'all' | SkillScope;
const TAB_LABEL: Record<Tab, string> = { all: 'Hepsi', global: 'Genel', project: 'Proje', agent: 'Ajan' };

type Mode = 'installed' | 'catalog';

interface Props {
  agents: AgentSnapshot[];
}

export function Skills({ agents }: Props) {
  const [mode, setMode] = useState<Mode>('installed');
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [installOpen, setInstallOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setSkills(await api.listSkills());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = useCallback(
    (id?: string) => (id ? agents.find((a) => a.config.id === id)?.config.name ?? id : ''),
    [agents],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return (skills ?? [])
      .filter((s) => tab === 'all' || s.scope === tab)
      .filter(
        (s) =>
          !needle ||
          s.name.toLocaleLowerCase('tr').includes(needle) ||
          s.description.toLocaleLowerCase('tr').includes(needle),
      );
  }, [skills, tab, q]);

  const counts = useMemo(() => {
    const list = skills ?? [];
    return {
      all: list.length,
      global: list.filter((s) => s.scope === 'global').length,
      project: list.filter((s) => s.scope === 'project').length,
      agent: list.filter((s) => s.scope === 'agent').length,
    };
  }, [skills]);

  async function toggle(s: SkillInfo) {
    setBusy(s.id);
    setNotice('');
    try {
      await api.toggleSkill(s.id, !s.enabled);
      await load();
      setNotice(
        L.skills.toggled(s.name, s.enabled),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: SkillInfo) {
    const extra =
      s.scope === 'global'
        ? L.skills.globalWarn
        : '';
    if (!confirm(L.skills.confirmDelete(s.name, s.dir, extra))) {
      return;
    }
    setBusy(s.id);
    try {
      await api.removeSkill(s.id);
      await load();
      setNotice(`"${s.name}" silindi.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!skills) return <div className="muted center">{error || L.skills.scanning}</div>;

  return (
    <div className="skills">
      <section className="pl-head">
        <div>
          <h2 className="plate-title">Skill’ler</h2>
          <p className="pl-head-desc">
            {mode === 'installed' ? (
              <>
                {L.skills.descInstalledA}
                <code>SKILL.md</code>{L.skills.descInstalledB}
              </>
            ) : (
              <>
                {L.skills.descCatalog}
              </>
            )}
          </p>
        </div>
        <div className="sk-modes">
          <button
            className={`tb-filter${mode === 'installed' ? ' sel' : ''}`}
            onClick={() => setMode('installed')}
          >
            {L.skills.installed} <span className="tb-filter-count">{counts.all}</span>
          </button>
          <button
            className={`tb-filter${mode === 'catalog' ? ' sel' : ''}`}
            onClick={() => setMode('catalog')}
          >
            {L.skills.discover}
          </button>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {notice && <div className="sk-notice">{notice}</div>}

      {mode === 'catalog' ? (
        <Discover
          agents={agents}
          onInstalled={() => void load()}
          onNotice={(m) => {
            setNotice(m);
            setError('');
          }}
        />
      ) : (
        <>
          <div className="sk-tools">
            <div className="tb-filters">
              {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
                <button key={t} className={`tb-filter${tab === t ? ' sel' : ''}`} onClick={() => setTab(t)}>
                  {TAB_LABEL[t]} <span className="tb-filter-count">{counts[t]}</span>
                </button>
              ))}
            </div>
            <input
              className="mem-search"
              placeholder={L.skills.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={L.skills.searchAria}
            />
            <button onClick={() => setInstallOpen(true)}>{L.skills.manual}</button>
          </div>

          {tab !== 'all' && <p className="sk-scope-note">{SCOPE_NOTE[tab]}</p>}

          {shown.length === 0 ? (
            <div className="empty">
              <h2>{q ? L.skills.noMatch : L.skills.none}</h2>
              <p>
                {q
                  ? L.skills.narrow
                  : L.skills.useDiscover}
              </p>
            </div>
          ) : (
            <div className="sk-list">
              {shown.map((s) => (
                <article key={s.id} className={`sk-item${s.enabled ? '' : ' off'}`}>
                  <div className="sk-main">
                    <div className="sk-top">
                      <span className="sk-name">{s.name}</span>
                      <span className={`badge sk-scope-${s.scope}`}>
                        {SCOPE_LABEL[s.scope]}
                        {s.agentId && ` · ${nameOf(s.agentId)}`}
                      </span>
                      {!s.enabled && <span className="chip chip-pending">{L.skills.off}</span>}
                    </div>
                    {s.description && <p className="sk-desc">{s.description}</p>}
                    <div className="sk-meta">
                      <span>{fmtSize(s.size)}</span>
                      {s.extras.length > 0 && <span>{s.extras.length} ek dosya</span>}
                      <span className="sk-dir" title={s.dir}>
                        {s.dir}
                      </span>
                    </div>
                  </div>

                  <div className="sk-actions">
                    <button onClick={() => void toggle(s)} disabled={busy === s.id}>
                      {s.enabled ? L.skills.disable : L.skills.enable}
                    </button>
                    <button className="danger" onClick={() => void remove(s)} disabled={busy === s.id}>
                      {L.skills.delete}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {installOpen && (
        <InstallDialog
          agents={agents}
          onClose={() => setInstallOpen(false)}
          onDone={(msg) => {
            setInstallOpen(false);
            setNotice(msg);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------- keşif

/**
 * Katalog kipi.
 *
 * Katalog ÖNBELLEKTEN okunur; panel açılmak ağ isteği doğurmaz. Tazeleme
 * açıkça istenir ve ne zaman tarandığı yazılır — "kaç skill var" sorusunun
 * cevabı bir anlık görüntü, sürekli akan bir şey değil.
 */
function Discover({
  agents,
  onInstalled,
  onNotice,
}: {
  agents: AgentSnapshot[];
  onInstalled: () => void;
  onNotice: (msg: string) => void;
}) {
  const [view, setView] = useState<CatalogView | null>(null);
  const [q, setQ] = useState('');
  const [repo, setRepo] = useState<string>('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [srcOpen, setSrcOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await api.skillCatalog());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      setView(await api.refreshSkillCatalog());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return (view?.skills ?? [])
      .filter((s) => !repo || s.repo === repo)
      .filter(
        (s) =>
          !needle ||
          s.name.toLocaleLowerCase('tr').includes(needle) ||
          s.description.toLocaleLowerCase('tr').includes(needle) ||
          s.repo.toLocaleLowerCase('tr').includes(needle),
      );
  }, [view, q, repo]);

  /** Seçilebilir = henüz kurulu olmayan. Kurulu olanı işaretletmek kesin hata üretirdi. */
  const selectable = useMemo(() => shown.filter((s) => s.installedScopes.length === 0), [shown]);

  function toggleOne(id: string) {
    setSel((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allShownSelected = selectable.length > 0 && selectable.every((s) => sel.has(s.id));

  function toggleAllShown() {
    setSel((cur) => {
      const next = new Set(cur);
      if (allShownSelected) for (const s of selectable) next.delete(s.id);
      else for (const s of selectable) next.add(s.id);
      return next;
    });
  }

  const chosen: CatalogSkill[] = useMemo(
    () => (view?.skills ?? []).filter((s) => sel.has(s.id)),
    [view, sel],
  );

  async function install(scope: SkillScope, agentId?: string) {
    setScopeOpen(false);
    setRefreshing(true);
    try {
      const res = await api.installSkills({
        items: chosen.map((s) => ({ id: s.id, repo: s.repo, skillPath: s.skillPath, name: s.name })),
        scope,
        agentId,
      });
      setResults(res);
      const ok = res.filter((r) => r.ok).length;
      onNotice(
        L.skills.installedN(ok, res.length, SCOPE_LABEL[scope]),
      );
      setSel(new Set());
      onInstalled();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  if (!view) return <div className="muted center">{error || L.skills.catalogLoading}</div>;

  const never = view.fetchedAt === null;

  return (
    <>
      <div className="sk-tools">
        <input
          className="mem-search"
          placeholder={L.skills.catalogSearch}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={L.skills.catalogAria}
        />
        <button onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? L.skills.refreshing : L.actions.refresh}
        </button>
        <button onClick={() => setSrcOpen(true)}>Kaynaklar</button>
      </div>

      <div className="sk-cat-bar">
        <span className="sk-cat-when">
          {never
            ? L.skills.neverScanned
            : L.skills.scanned(view.skills.length, rel(view.fetchedAt!))}
        </span>
        <div className="tb-filters">
          <button className={`tb-filter${repo === '' ? ' sel' : ''}`} onClick={() => setRepo('')}>
            Tümü
          </button>
          {view.sources.map((s) => (
            <button
              key={s.repo}
              className={`tb-filter${repo === s.repo ? ' sel' : ''}`}
              onClick={() => setRepo(s.repo)}
              title={s.error ? s.error : s.repo}
            >
              {s.label} <span className="tb-filter-count">{s.count ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Kaynak hataları gizlenmez: eksik bir katalog "hiç yok" gibi görünürdü. */}
      {view.sources
        .filter((s) => s.error)
        .map((s) => (
          <div className="sk-src-err" key={s.repo}>
            <strong>{s.repo}</strong> — {s.error}
          </div>
        ))}

      {error && <div className="error">{error}</div>}

      {shown.length === 0 ? (
        <div className="empty">
          <h2>{never ? L.skills.catalogEmpty : L.skills.noMatch}</h2>
          <p>
            {never
              ? L.skills.refreshHint
              : L.skills.narrowSource}
          </p>
        </div>
      ) : (
        <>
          <div className="sk-cat-head">
            {/* `label.check` mevcut sözleşme (index.css): küresel `label`
                kuralı sütun yönlü, kendi sınıfımı yazmak kutuyu metnin
                üstüne yığıyordu. */}
            <label className="check small">
              <input
                type="checkbox"
                checked={allShownSelected}
                onChange={toggleAllShown}
                disabled={selectable.length === 0}
              />
              <span>{L.skills.selectVisible(selectable.length)}</span>
            </label>
          </div>

          <div className="sk-list">
            {shown.map((s) => {
              const installed = s.installedScopes.length > 0;
              return (
                <article key={s.id} className={`sk-item${installed ? ' off' : ''}`}>
                  <label className="check sk-check-row">
                    <input
                      type="checkbox"
                      checked={sel.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      disabled={installed}
                      aria-label={L.skills.pick(s.name)}
                    />
                  </label>
                  <div className="sk-main">
                    <div className="sk-top">
                      <span className="sk-name">{s.name}</span>
                      <span className="badge sk-repo">{s.repo}</span>
                      {installed && (
                        <span className="chip chip-done">
                          kurulu · {s.installedScopes.map((x) => SCOPE_LABEL[x]).join(', ')}
                        </span>
                      )}
                    </div>
                    {s.description && <p className="sk-desc">{s.description}</p>}
                    <div className="sk-meta">
                      <span className="sk-dir" title={s.skillPath}>
                        {s.skillPath}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Toplu eylem çubuğu yalnızca seçim varken var: boşken yer kaplaması
          "burada bir şey yapmalıyım" hissi verirdi. */}
      {sel.size > 0 && (
        <div className="sk-bulkbar">
          <span>
            <strong>{sel.size}</strong>{L.skills.selected}
          </span>
          <button onClick={() => setSel(new Set())}>{L.skills.clearSel}</button>
          <button className="primary" onClick={() => setScopeOpen(true)} disabled={refreshing}>
            {refreshing ? L.skills.installing : L.skills.install(sel.size)}
          </button>
        </div>
      )}

      {scopeOpen && (
        <ScopeDialog
          agents={agents}
          skills={chosen}
          onClose={() => setScopeOpen(false)}
          onConfirm={(scope, agentId) => void install(scope, agentId)}
        />
      )}

      {results && <ResultDialog results={results} onClose={() => setResults(null)} />}
      {srcOpen && (
        <SourceDialog
          sources={view.sources}
          onClose={() => setSrcOpen(false)}
          onChanged={() => void load()}
        />
      )}
    </>
  );
}

/**
 * Kapsam BİR KEZ sorulur ve seçilenlerin hepsine uygulanır.
 *
 * Skill başına sormak on skill için on diyalog demekti. Buna karşılık kapsam
 * gerçekten sorulmak zorunda: genel kapsam kullanıcının bütün projelerine
 * yazıyor ve bunun sessiz bir varsayılanı olmamalı.
 */
function ScopeDialog({
  agents,
  skills,
  onClose,
  onConfirm,
}: {
  agents: AgentSnapshot[];
  skills: CatalogSkill[];
  onClose: () => void;
  onConfirm: (scope: SkillScope, agentId?: string) => void;
}) {
  const [scope, setScope] = useState<SkillScope>('project');
  const [agentId, setAgentId] = useState(agents[0]?.config.id ?? '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={L.skills.scopeDialog}>
        <h3>{L.skills.willInstall(skills.length)}</h3>
        <p className="sk-dialog-note">
          {L.skills.downloadNoteA}<code>SKILL.md</code>{L.skills.downloadNoteB}<code>skills-lock.json</code>{L.skills.downloadNoteC}
        </p>

        <ul className="sk-chosen">
          {skills.slice(0, 8).map((s) => (
            <li key={s.id}>
              {s.name} <span className="muted">· {s.repo}</span>
            </li>
          ))}
          {skills.length > 8 && <li className="muted">{L.skills.more(skills.length - 8)}</li>}
        </ul>

        <label>
          {L.skills.scopeAll}
          <select value={scope} onChange={(e) => setScope(e.target.value as SkillScope)}>
            <option value="project">{L.skills.optProject}</option>
            <option value="global">{L.skills.optGlobal}</option>
            <option value="agent">{L.skills.optAgent}</option>
          </select>
        </label>
        <p className="sk-scope-note">{SCOPE_NOTE[scope]}</p>

        {scope === 'agent' && (
          <label>
            {L.skills.agent}
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.config.id} value={a.config.id}>
                  {a.config.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>{L.actions.cancel}</button>
          <button
            className="primary"
            onClick={() => onConfirm(scope, scope === 'agent' ? agentId : undefined)}
            disabled={scope === 'agent' && !agentId}
          >
            {skills.length} skill’i kur
          </button>
        </div>
      </div>
    </div>
  );
}

/** Satır satır sonuç: bir hata diğerlerini iptal etmiyor, o yüzden karışık liste normal. */
function ResultDialog({ results, onClose }: { results: BulkResult[]; onClose: () => void }) {
  const bad = results.filter((r) => !r.ok);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={L.skills.resultDialog}>
        <h3>
          {L.skills.installedOf(results.length - bad.length, results.length)}
        </h3>
        <ul className="sk-results">
          {results.map((r) => (
            <li key={r.id} className={r.ok ? 'ok' : 'bad'}>
              <span className="sk-res-mark">{r.ok ? '✓' : '×'}</span>
              <span className="sk-res-name">{r.name}</span>
              {r.error && <span className="sk-res-err">{r.error}</span>}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            {L.skills.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Kaynak depolar.
 *
 * Yerleşikler SİLİNMEZ, gizlenir — kullanıcı fikrini değiştirdiğinde kod
 * değişmeden geri gelsinler (sunucu tarafında `hidden` listesi).
 */
function SourceDialog({
  sources,
  onClose,
  onChanged,
}: {
  sources: { repo: string; label: string; builtin: boolean; count?: number }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [list, setList] = useState(sources);
  const [repo, setRepo] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!repo.trim()) return;
    setBusy(true);
    setError('');
    try {
      setList(await api.addSkillSource(repo.trim(), label.trim() || undefined));
      setRepo('');
      setLabel('');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function drop(r: string) {
    setBusy(true);
    try {
      setList(await api.removeSkillSource(r));
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={L.skills.sourcesDialog}>
        <h3>{L.skills.sourcesDialog}</h3>
        <p className="sk-dialog-note">
          {L.skills.sourcesNoteA}<strong>{L.actions.refresh}</strong>{L.skills.sourcesNoteB}
        </p>

        <ul className="sk-src-list">
          {list.map((s) => (
            <li key={s.repo}>
              <span className="sk-src-name">{s.label}</span>
              <span className="sk-src-repo">{s.repo}</span>
              <button onClick={() => void drop(s.repo)} disabled={busy}>
                {s.builtin ? L.skills.hide : L.skills.remove}
              </button>
            </li>
          ))}
        </ul>

        <label>
          {L.skills.addRepo}
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="sahip/depo" />
        </label>
        <label>
          {L.skills.nameOptional}
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={L.skills.collectionPh} />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>
            {L.common.close}
          </button>
          <button className="primary" onClick={() => void add()} disabled={busy || !repo.trim()}>
            {L.actions.add}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Elle kurulum kutusu — katalogda olmayan bir depo/yol için.
 *
 * Kurulum AĞDAN DOSYA İNDİRİP DİSKE YAZAR; bu yüzden kutu ne olacağını
 * indirmeden önce açıkça yazıyor ve hedef kapsamı kullanıcı seçiyor —
 * varsayılan "proje", çünkü en dar kapsam en az sürpriz üretir.
 */
function InstallDialog({
  agents,
  onClose,
  onDone,
}: {
  agents: AgentSnapshot[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [repo, setRepo] = useState('');
  const [skillPath, setSkillPath] = useState('');
  const [scope, setScope] = useState<SkillScope>('project');
  const [agentId, setAgentId] = useState(agents[0]?.config.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!repo.trim() || !skillPath.trim()) {
      setError(L.skills.needRepo);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const s = await api.installSkill({
        repo: repo.trim(),
        skillPath: skillPath.trim(),
        scope,
        agentId: scope === 'agent' ? agentId : undefined,
      });
      onDone(L.skills.installedOne(s.name, SCOPE_LABEL[s.scope]));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={L.skills.ghDialog}>
        <h3>{L.skills.ghDialog}</h3>
        <p className="sk-dialog-note">
          {L.skills.ghNoteA}<code>SKILL.md</code>{L.skills.ghNoteB}<code>skills-lock.json</code>{L.skills.downloadNoteC}
        </p>

        <label>
          {L.skills.repo}
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="sahip/depo"
            autoFocus
          />
        </label>

        <label>
          {L.skills.skillPath}
          <input
            value={skillPath}
            onChange={(e) => setSkillPath(e.target.value)}
            placeholder="skills/futuristic"
          />
        </label>

        <label>
          {L.skills.scopeLabel}
          <select value={scope} onChange={(e) => setScope(e.target.value as SkillScope)}>
            <option value="project">{L.skills.optProject}</option>
            <option value="global">{L.skills.optGlobal}</option>
            <option value="agent">{L.skills.optAgent}</option>
          </select>
        </label>

        {scope === 'agent' && (
          <label>
            {L.skills.agent}
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.config.id} value={a.config.id}>
                  {a.config.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>
            {L.actions.cancel}
          </button>
          <button className="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? L.skills.downloading : L.skills.installOne}
          </button>
        </div>
      </div>
    </div>
  );
}
