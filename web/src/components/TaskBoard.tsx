import { useMemo, useState } from 'react';
import type { AgentSnapshot, Task } from '../types';
import { api } from '../api';
import { ROLE_LABEL, STATUS_LABEL } from '../format';

const STATUS_TR: Record<string, string> = {
  pending: 'bekliyor',
  running: 'çalışıyor',
  done: 'tamamlandı',
  failed: 'başarısız',
};

type Filter = 'all' | 'running' | 'pending' | 'done' | 'failed';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Hepsi' },
  { id: 'running', label: 'Çalışan' },
  { id: 'pending', label: 'Sırada' },
  { id: 'done', label: 'Biten' },
  { id: 'failed', label: 'Hatalı' },
];

interface Props {
  tasks: Task[];
  agents: AgentSnapshot[];
}

interface Step {
  title: string;
  prompt: string;
  assignedTo: string;
}

/**
 * Liste satırı: tekil görev ya da bir zincirin tüm adımları. Zincir, ilk
 * adımının listedeki yerinde tek blok olarak görünür — adımlar zaman sırasına
 * dağılsaydı hangi işin neyi beklediği okunmazdı.
 */
type Row = { kind: 'task'; task: Task } | { kind: 'chain'; chainId: string; steps: Task[] };

export function TaskBoard({ tasks, agents }: Props) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Zincir kipi: form tek görev yerine sıraya adım ekler. */
  const [chainMode, setChainMode] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const target = agents.find((a) => a.config.id === assignedTo);
  const ready = !!(title.trim() && prompt.trim() && assignedTo);

  function clearForm() {
    setTitle('');
    setPrompt('');
  }

  async function create() {
    if (!ready || busy) return;
    setError('');
    setBusy(true);
    try {
      await api.createTask({ title, prompt, assignedTo });
      clearForm();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addStep() {
    if (!ready) return;
    setSteps((s) => [...s, { title, prompt, assignedTo }]);
    clearForm(); // ajan seçimi korunur: aynı ajana art arda adım yazmak yaygın
    setError('');
  }

  async function startChain() {
    // Formda tamamlanmış bir adım varsa listeye eklemeyi kullanıcıya bırakmayız;
    // "başlat"a basıp adımını kaybetmek sürpriz olurdu.
    const all = ready ? [...steps, { title, prompt, assignedTo }] : steps;
    if (all.length < 2) {
      setError('Zincir en az iki adım ister; tek adım için zincir kipini kapat.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.createChain(all);
      setSteps([]);
      clearForm();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const agentName = (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length };
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tasks]);

  const shown = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const t of shown) {
      if (!t.chainId) {
        out.push({ kind: 'task', task: t });
        continue;
      }
      if (seen.has(t.chainId)) continue;
      seen.add(t.chainId);
      out.push({
        kind: 'chain',
        chainId: t.chainId,
        steps: shown
          .filter((x) => x.chainId === t.chainId)
          .sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0)),
      });
    }
    return out;
  }, [shown]);

  function renderTask(t: Task) {
    return (
      <div key={t.id} className={`task task-${t.status}`}>
        <div className="task-head" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
          <span className={`chip chip-${t.status}`}>{STATUS_TR[t.status]}</span>
          {t.chainId && <span className="task-step">{(t.stepIndex ?? 0) + 1}.</span>}
          <strong className="task-title">{t.title}</strong>
          <span className="task-meta">
            → {agentName(t.assignedTo)} · {t.assignedBy === 'user' ? 'sen' : agentName(t.assignedBy)}
          </span>
          <span className="task-time">{new Date(t.createdAt).toLocaleTimeString('tr-TR')}</span>
          <span className={`task-caret${expanded === t.id ? ' open' : ''}`}>›</span>
        </div>
        {expanded === t.id && (
          <div className="task-detail">
            {t.dependsOn && (
              <div className="muted small">
                Bu adım {agentName(tasks.find((x) => x.id === t.dependsOn)?.assignedTo ?? '')} adımının
                sonucunu girdi olarak alır.
              </div>
            )}
            <div className="tb-field-label">Görev</div>
            <pre>{t.prompt}</pre>
            {t.result && (
              <>
                <div className="tb-field-label">Sonuç</div>
                <pre>{t.result}</pre>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="taskboard">
      {/* ---------- görev oluşturma ---------- */}
      <section className="tb-compose">
        <div className="tb-compose-head">
          <span className="bridge-mod-label">{chainMode ? 'Zincir Kur' : 'Görev Ata'}</span>
          <button
            type="button"
            className={`tb-filter${chainMode ? ' sel' : ''}`}
            onClick={() => {
              setChainMode((v) => !v);
              setError('');
            }}
            title="Adımlar sırayla çalışır; her adım bir öncekinin sonucunu girdi olarak alır."
          >
            Zincir
            {steps.length > 0 && <span className="tb-filter-count">{steps.length}</span>}
          </button>
        </div>

        {chainMode && steps.length > 0 && (
          <ol className="tb-steps">
            {steps.map((s, i) => (
              <li key={i} className="tb-step">
                <span className="tb-step-no">{i + 1}</span>
                <span className="tb-step-main">
                  <span className="tb-step-title">{s.title}</span>
                  <span className="tb-step-meta">→ {agentName(s.assignedTo)}</span>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  title="Adımı çıkar"
                  onClick={() => setSteps((list) => list.filter((_, k) => k !== i))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="tb-compose-grid">
          <div className="tb-fields">
            <label className="tb-field">
              <span className="tb-field-label">Başlık</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kısa ve ayırt edici bir ad"
              />
            </label>

            <label className="tb-field">
              <span className="tb-field-label">
                Görev
                <span className="tb-hint">bağlam · yapılacak iş · teslim kriteri</span>
              </span>
              <textarea
                rows={7}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={'Bağlam: hangi dizin, mevcut durum\nGörev: yapılacak iş\nKapsam dışı: dokunulmayacaklar\nTeslim kriteri: bittiğini nasıl anlarız'}
              />
            </label>
          </div>

          {/* Açılır liste yerine görsel seçici: durum, rol ve model bir bakışta */}
          <div className="tb-picker">
            <div className="tb-field-label">Kime</div>
            <div className="tb-picker-list">
              {agents.map((a) => (
                <button
                  key={a.config.id}
                  className={`tb-agent${assignedTo === a.config.id ? ' sel' : ''}`}
                  onClick={() => setAssignedTo(a.config.id)}
                  type="button"
                >
                  <span className={`led led-${a.status}`} />
                  <span className="tb-agent-main">
                    <span className="tb-agent-name">{a.config.name}</span>
                    <span className="tb-agent-meta">
                      {ROLE_LABEL[a.config.role] ?? a.config.role} · {a.config.model}
                    </span>
                  </span>
                </button>
              ))}
              {agents.length === 0 && <div className="muted small">Önce bir ajan oluştur.</div>}
            </div>
          </div>
        </div>

        <div className="tb-actions">
          {error && <span className="error">{error}</span>}
          <span className="tb-summary">
            {target ? (
              <>
                <span className={`led led-${target.status}`} />
                {target.config.name} · {STATUS_LABEL[target.status]}
                {target.status === 'offline' && <span className="tb-warn"> — başlatılacak</span>}
              </>
            ) : (
              'Bir ajan seç'
            )}
          </span>
          {chainMode ? (
            <>
              <button disabled={!ready || busy} onClick={addStep} type="button">
                Adımı ekle
              </button>
              <button
                className="primary"
                disabled={busy || steps.length + (ready ? 1 : 0) < 2}
                onClick={() => void startChain()}
                type="button"
              >
                {busy ? 'Başlatılıyor…' : `Zinciri başlat (${steps.length + (ready ? 1 : 0)})`}
              </button>
            </>
          ) : (
            <button className="primary" disabled={!ready || busy} onClick={create}>
              {busy ? 'Gönderiliyor…' : 'Görevi ata'}
            </button>
          )}
        </div>
      </section>

      {/* ---------- görev listesi ---------- */}
      <section className="tb-list-wrap">
        <div className="tb-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`tb-filter${filter === f.id ? ' sel' : ''}`}
              onClick={() => setFilter(f.id)}
              type="button"
            >
              {f.label}
              <span className="tb-filter-count">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 && (
          <div className="muted small tb-empty">
            {tasks.length === 0 ? 'Henüz görev yok.' : 'Bu filtrede görev yok.'}
          </div>
        )}

        <div className="task-list">
          {rows.map((row) =>
            row.kind === 'task' ? (
              renderTask(row.task)
            ) : (
              <div key={row.chainId} className="chain">
                <div className="chain-head">
                  <span className="chain-label">Zincir · {row.steps.length} adım</span>
                  <span className="chain-progress">
                    {row.steps.filter((s) => s.status === 'done').length}/{row.steps.length} bitti
                  </span>
                </div>
                <div className="chain-steps">{row.steps.map(renderTask)}</div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
