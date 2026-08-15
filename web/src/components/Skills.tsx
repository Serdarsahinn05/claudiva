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

const SCOPE_LABEL: Record<SkillScope, string> = {
  global: 'genel',
  project: 'proje',
  agent: 'ajan',
};

const SCOPE_NOTE: Record<SkillScope, string> = {
  global: 'Bütün projelerinde geçerli (~/.claude/skills).',
  project: 'Yalnız bu depoda geçerli (.claude/skills).',
  agent: 'Yalnız bu ajanda geçerli.',
};

function fmtSize(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)} KB`;
  return `${n} B`;
}

function rel(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.round(s / 60)}dk önce`;
  if (s < 86400) return `${Math.round(s / 3600)}sa önce`;
  return `${Math.round(s / 86400)}g önce`;
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
        `"${s.name}" ${s.enabled ? 'kapatıldı' : 'açıldı'}. Değişiklik ajanın BİR SONRAKİ başlatmasında geçerli olur.`,
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
        ? '\n\nDİKKAT: genel kapsam — bu skill bütün projelerinden silinir.'
        : '';
    if (!confirm(`"${s.name}" skill'i tamamen silinsin mi?\n\n${s.dir}${extra}\n\nBu işlem geri alınamaz.`)) {
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

  if (!skills) return <div className="muted center">{error || 'Skill’ler taranıyor…'}</div>;

  return (
    <div className="skills">
      <section className="pl-head">
        <div>
          <h2 className="plate-title">Skill’ler</h2>
          <p className="pl-head-desc">
            {mode === 'installed' ? (
              <>
                Ajanların kullanabildiği yetenekler. Kapatmak dosyayı silmez —{' '}
                <code>SKILL.md</code> yeniden adlandırılır, istediğinde geri açılır.
              </>
            ) : (
              <>
                Depolarda ara, işaretle, toplu kur. Kapsam kurulum anında BİR KEZ sorulur ve
                işaretlediklerinin hepsine uygulanır.
              </>
            )}
          </p>
        </div>
        <div className="sk-modes">
          <button
            className={`tb-filter${mode === 'installed' ? ' sel' : ''}`}
            onClick={() => setMode('installed')}
          >
            Kurulu <span className="tb-filter-count">{counts.all}</span>
          </button>
          <button
            className={`tb-filter${mode === 'catalog' ? ' sel' : ''}`}
            onClick={() => setMode('catalog')}
          >
            Keşfet
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
              placeholder="ada ya da açıklamaya göre ara…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Skill ara"
            />
            <button onClick={() => setInstallOpen(true)}>Elle kur</button>
          </div>

          {tab !== 'all' && <p className="sk-scope-note">{SCOPE_NOTE[tab]}</p>}

          {shown.length === 0 ? (
            <div className="empty">
              <h2>{q ? 'Eşleşme yok' : 'Skill yok'}</h2>
              <p>
                {q
                  ? 'Aramayı daralt ya da başka bir kapsama bak.'
                  : '“Keşfet” kipinden arayıp kurabilirsin.'}
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
                      {!s.enabled && <span className="chip chip-pending">kapalı</span>}
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
                      {s.enabled ? 'Kapat' : 'Aç'}
                    </button>
                    <button className="danger" onClick={() => void remove(s)} disabled={busy === s.id}>
                      Sil
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
        `${ok}/${res.length} skill kuruldu (${SCOPE_LABEL[scope]} kapsam). Ajanı yeniden başlatınca görünür.`,
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

  if (!view) return <div className="muted center">{error || 'Katalog okunuyor…'}</div>;

  const never = view.fetchedAt === null;

  return (
    <>
      <div className="sk-tools">
        <input
          className="mem-search"
          placeholder="ada, açıklamaya ya da depoya göre ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Katalogda ara"
        />
        <button onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Taranıyor…' : 'Yenile'}
        </button>
        <button onClick={() => setSrcOpen(true)}>Kaynaklar</button>
      </div>

      <div className="sk-cat-bar">
        <span className="sk-cat-when">
          {never
            ? 'Katalog hiç taranmadı — “Yenile” ile başla.'
            : `${view.skills.length} skill · ${rel(view.fetchedAt!)} tarandı`}
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
          <h2>{never ? 'Katalog boş' : 'Eşleşme yok'}</h2>
          <p>
            {never
              ? '“Yenile” kaynak depoları tarar ve kurulabilir skill’leri listeler.'
              : 'Aramayı daralt ya da başka bir kaynağa bak.'}
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
              <span>Görünen {selectable.length} kurulabilir skill’i seç</span>
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
                      aria-label={`${s.name} seç`}
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
            <strong>{sel.size}</strong> skill seçildi
          </span>
          <button onClick={() => setSel(new Set())}>Seçimi temizle</button>
          <button className="primary" onClick={() => setScopeOpen(true)} disabled={refreshing}>
            {refreshing ? 'Kuruluyor…' : `Kur (${sel.size})`}
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
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kurulum kapsamı">
        <h3>{skills.length} skill kurulacak</h3>
        <p className="sk-dialog-note">
          Her birinin <code>SKILL.md</code> dosyası ve yanındaki dosyalar indirilip diske yazılır.
          Kaynak <code>skills-lock.json</code> dosyasına kaydedilir.
        </p>

        <ul className="sk-chosen">
          {skills.slice(0, 8).map((s) => (
            <li key={s.id}>
              {s.name} <span className="muted">· {s.repo}</span>
            </li>
          ))}
          {skills.length > 8 && <li className="muted">+{skills.length - 8} tane daha</li>}
        </ul>

        <label>
          Kapsam — hepsine uygulanır
          <select value={scope} onChange={(e) => setScope(e.target.value as SkillScope)}>
            <option value="project">Proje — yalnız bu depo</option>
            <option value="global">Genel — bütün projelerin</option>
            <option value="agent">Ajan — tek bir ajan</option>
          </select>
        </label>
        <p className="sk-scope-note">{SCOPE_NOTE[scope]}</p>

        {scope === 'agent' && (
          <label>
            Ajan
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
          <button onClick={onClose}>Vazgeç</button>
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
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kurulum sonucu">
        <h3>
          {results.length - bad.length}/{results.length} kuruldu
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
            Tamam
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
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Katalog kaynakları">
        <h3>Katalog kaynakları</h3>
        <p className="sk-dialog-note">
          Her depo taranırken tek bir istek atılır (dosya ağacı); açıklamalar dosya başlarından
          okunur. Değişiklikten sonra <strong>Yenile</strong> ile yeniden tara.
        </p>

        <ul className="sk-src-list">
          {list.map((s) => (
            <li key={s.repo}>
              <span className="sk-src-name">{s.label}</span>
              <span className="sk-src-repo">{s.repo}</span>
              <button onClick={() => void drop(s.repo)} disabled={busy}>
                {s.builtin ? 'Gizle' : 'Kaldır'}
              </button>
            </li>
          ))}
        </ul>

        <label>
          Depo ekle
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="sahip/depo" />
        </label>
        <label>
          Ad (isteğe bağlı)
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Koleksiyonun adı" />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} disabled={busy}>
            Kapat
          </button>
          <button className="primary" onClick={() => void add()} disabled={busy || !repo.trim()}>
            Ekle
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
      setError('Depo ve skill yolu gerekli.');
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
      onDone(`"${s.name}" kuruldu (${SCOPE_LABEL[s.scope]} kapsam). Ajanı yeniden başlatınca görünür.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="GitHub’dan skill kur">
        <h3>GitHub’dan skill kur</h3>
        <p className="sk-dialog-note">
          Belirttiğin dizindeki <code>SKILL.md</code> ve yanındaki dosyalar indirilip diske yazılır.
          Kaynak <code>skills-lock.json</code> dosyasına kaydedilir.
        </p>

        <label>
          Depo
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="sahip/depo"
            autoFocus
          />
        </label>

        <label>
          Depo içindeki skill yolu
          <input
            value={skillPath}
            onChange={(e) => setSkillPath(e.target.value)}
            placeholder="skills/futuristic"
          />
        </label>

        <label>
          Kapsam
          <select value={scope} onChange={(e) => setScope(e.target.value as SkillScope)}>
            <option value="project">Proje — yalnız bu depo</option>
            <option value="global">Genel — bütün projelerin</option>
            <option value="agent">Ajan — tek bir ajan</option>
          </select>
        </label>

        {scope === 'agent' && (
          <label>
            Ajan
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
            Vazgeç
          </button>
          <button className="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'İndiriliyor…' : 'Kur'}
          </button>
        </div>
      </div>
    </div>
  );
}
