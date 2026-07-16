import { useState } from 'react';
import type { AgentSnapshot, Task } from '../types';
import { api } from '../api';

const STATUS_TR: Record<string, string> = {
  pending: 'bekliyor',
  running: 'çalışıyor',
  done: 'tamamlandı',
  failed: 'başarısız',
};

interface Props {
  tasks: Task[];
  agents: AgentSnapshot[];
}

export function TaskBoard({ tasks, agents }: Props) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function create() {
    setError('');
    try {
      await api.createTask({ title, prompt, assignedTo });
      setTitle('');
      setPrompt('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const agentName = (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id;

  return (
    <div className="taskboard">
      <div className="panel">
        <h3>Yeni Görev</h3>
        <div className="row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Görev başlığı" />
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Ajan seç…</option>
            {agents.map((a) => (
              <option key={a.config.id} value={a.config.id}>
                {a.config.name} ({a.config.model})
              </option>
            ))}
          </select>
        </div>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Görevin tam açıklaması…"
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={!title.trim() || !prompt.trim() || !assignedTo} onClick={create}>
          Görevi ata
        </button>
      </div>

      <div className="panel">
        <h3>Görevler ({tasks.length})</h3>
        {tasks.length === 0 && <div className="muted">Henüz görev yok.</div>}
        <div className="task-list">
          {tasks.map((t) => (
            <div key={t.id} className={`task task-${t.status}`}>
              <div className="task-head" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                <span className={`chip chip-${t.status}`}>{STATUS_TR[t.status]}</span>
                <strong>{t.title}</strong>
                <span className="muted">
                  → {agentName(t.assignedTo)} · atayan: {t.assignedBy === 'user' ? 'sen' : agentName(t.assignedBy)}
                </span>
                <span className="muted right">{new Date(t.createdAt).toLocaleTimeString('tr-TR')}</span>
              </div>
              {expanded === t.id && (
                <div className="task-detail">
                  <div className="muted">Görev:</div>
                  <pre>{t.prompt}</pre>
                  {t.result && (
                    <>
                      <div className="muted">Sonuç:</div>
                      <pre>{t.result}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
