import { useEffect, useState } from 'react';
import { useStore } from './useStore';
import { api } from './api';
import { AgentCard } from './components/AgentCard';
import { AgentForm } from './components/AgentForm';
import { Terminal } from './components/Terminal';
import { TaskBoard } from './components/TaskBoard';
import { PromptLibrary } from './components/PromptLibrary';
import { fmtCost, fmtNum, totalTokens } from './format';
import type { AgentSnapshot } from './types';

type Tab = 'dashboard' | 'terminal' | 'tasks' | 'prompts';

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formAgent, setFormAgent] = useState<AgentSnapshot | null | 'new'>(null);

  const selected = store.agents.find((a) => a.config.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !store.transcripts[selectedId]) {
      void store.loadTranscript(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function openAgent(id: string) {
    setSelectedId(id);
    setTab('terminal');
  }

  async function toggleAgent(a: AgentSnapshot) {
    if (a.status === 'offline') await api.startAgent(a.config.id);
    else await api.stopAgent(a.config.id);
    await store.refreshAgents();
  }

  async function deleteAgent(a: AgentSnapshot) {
    if (!confirm(`"${a.config.name}" ajanı ve tanım dosyaları silinsin mi? (Hafızası silinmez)`)) return;
    await api.deleteAgent(a.config.id);
    if (selectedId === a.config.id) setSelectedId(null);
    await store.refreshAgents();
  }

  const pendingCount = store.permissions.length;

  return (
    <div className="app">
      <header>
        <h1>🏢 Claude Manager</h1>
        <nav>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
            Panel
          </button>
          <button className={tab === 'terminal' ? 'active' : ''} onClick={() => setTab('terminal')} disabled={!selected}>
            Terminal{selected ? `: ${selected.config.name}` : ''}
          </button>
          <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
            Görevler
          </button>
          <button className={tab === 'prompts' ? 'active' : ''} onClick={() => setTab('prompts')}>
            Promptlar
          </button>
        </nav>
        <div className="spacer" />
        {pendingCount > 0 && <span className="badge warn">⚠ {pendingCount} izin bekliyor</span>}
        {store.usage && (
          <span className="totals" title="toplam token (tüm ajanlar)">
            Σ {fmtNum(totalTokens(store.usage.total))} token · {fmtCost(store.usage.total.costUSD)}
          </span>
        )}
        <span className={`conn ${store.connected ? 'on' : 'off'}`}>{store.connected ? '● bağlı' : '○ bağlantı yok'}</span>
      </header>

      <div className="layout">
        <aside>
          <button className="primary wide" onClick={() => setFormAgent('new')}>
            + Yeni Ajan
          </button>
          <div className="agent-list">
            {store.agents.map((a) => (
              <div
                key={a.config.id}
                className={`agent-row ${selectedId === a.config.id ? 'selected' : ''}`}
                onClick={() => openAgent(a.config.id)}
              >
                <span className={`dot dot-${a.status}`} />
                <span className="agent-row-name">{a.config.name}</span>
                {a.pendingPermissions.length > 0 && <span className="badge warn">!</span>}
                <span className="muted small">{fmtNum(totalTokens(a.usage))}</span>
              </div>
            ))}
            {store.agents.length === 0 && <div className="muted center">Henüz ajan yok.</div>}
          </div>
        </aside>

        <main>
          {tab === 'dashboard' && (
            <div className="card-grid">
              {store.agents.map((a) => (
                <AgentCard
                  key={a.config.id}
                  agent={a}
                  onOpen={() => openAgent(a.config.id)}
                  onEdit={() => setFormAgent(a)}
                  onDelete={() => void deleteAgent(a)}
                  onToggle={() => void toggleAgent(a)}
                />
              ))}
              {store.agents.length === 0 && (
                <div className="empty">
                  <h2>Ofisi kur 👷</h2>
                  <p>
                    "+ Yeni Ajan" ile ilk ajanını oluştur. Öneri: önce bir <strong>Patron (boss)</strong> oluştur
                    (Opus/Sonnet), sonra farklı uzmanlıklarda <strong>Çalışan</strong> ajanlar ekle (Haiku/Sonnet).
                    Boss'a ne istediğini anlat — işi ekibe kendisi dağıtır.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'terminal' &&
            (selected ? (
              <Terminal agent={selected} events={store.transcripts[selected.config.id] ?? []} />
            ) : (
              <div className="muted center">Soldan bir ajan seç.</div>
            ))}

          {tab === 'tasks' && <TaskBoard tasks={store.tasks} agents={store.agents} />}

          {tab === 'prompts' && (
            <PromptLibrary
              prompts={store.prompts}
              agents={store.agents}
              onChanged={() => void store.refreshPrompts()}
              onSent={(agentId) => openAgent(agentId)}
            />
          )}
        </main>
      </div>

      {formAgent !== null && (
        <AgentForm
          existing={formAgent === 'new' ? undefined : formAgent}
          onClose={() => setFormAgent(null)}
          onSaved={() => void store.refreshAgents()}
        />
      )}
    </div>
  );
}
