import { useEffect, useMemo, useState } from 'react';
import { useStore } from './useStore';
import { api } from './api';
import { AgentCard } from './components/AgentCard';
import { AgentForm } from './components/AgentForm';
import { Terminal } from './components/Terminal';
import { Bridge } from './components/Bridge';
import { Rail, ICONS } from './components/Rail';
import { TaskBoard } from './components/TaskBoard';
import { PromptLibrary } from './components/PromptLibrary';
import { Office } from './components/Office';
import { Changes } from './components/Changes';
import { ThemePicker } from './components/ThemePicker';
import { Settings } from './components/Settings';
import { CommandPalette, agentCommands, themeCommands, type Command } from './components/CommandPalette';
import { useHotkey } from './useHotkey';
import { dismissBoot } from './boot';
import { fmtCost, fmtNum, totalTokens } from './format';
import type { AgentSnapshot } from './types';

type Tab = 'bridge' | 'office' | 'dashboard' | 'terminal' | 'tasks' | 'prompts' | 'changes';

const TAB_TITLE: Record<Tab, string> = {
  bridge: 'Köprü',
  office: 'Ofis',
  dashboard: 'Panel',
  terminal: 'Terminal',
  tasks: 'Görevler',
  prompts: 'Promptlar',
  changes: 'Değişiklikler',
};

/** Mürettebat listesinin görüneceği bölümler — diğerlerinde yer kaplamasın. */
const ROSTER_TABS = new Set<Tab>(['dashboard', 'terminal']);

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('bridge');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formAgent, setFormAgent] = useState<AgentSnapshot | null | 'new'>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const selected = store.agents.find((a) => a.config.id === selectedId) ?? null;

  // Açılış perdesi veri gelir gelmez kalkar (sabit süre yok — bkz. boot.ts).
  useEffect(() => {
    if (store.ready) dismissBoot();
  }, [store.ready]);

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

  const [bulkBusy, setBulkBusy] = useState(false);
  const allOffline = store.agents.length > 0 && store.agents.every((a) => a.status === 'offline');
  const allAutoApprove = store.agents.length > 0 && store.agents.every((a) => a.config.autoApprove);

  /**
   * Tek düğmeyle tümünü başlat/durdur. Hedefi filtrelemeye gerek yok:
   * start()/stop() zaten doğru durumdaki ajanda no-op (bkz. session.ts),
   * yani karışık durumda (bazısı çalışıyor) bile güvenle herkese uygulanır.
   */
  async function toggleAllAgents() {
    if (bulkBusy || store.agents.length === 0) return;
    setBulkBusy(true);
    try {
      const starting = allOffline;
      await Promise.all(
        store.agents.map((a) => (starting ? api.startAgent(a.config.id) : api.stopAgent(a.config.id))),
      );
      await store.refreshAgents();
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleAllAutoApprove() {
    if (bulkBusy || store.agents.length === 0) return;
    setBulkBusy(true);
    try {
      const next = !allAutoApprove;
      await Promise.all(store.agents.map((a) => api.updateAgent(a.config.id, { autoApprove: next })));
      await store.refreshAgents();
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteAgent(a: AgentSnapshot) {
    if (!confirm(`"${a.config.name}" ajanı ve tanım dosyaları silinsin mi? (Hafızası silinmez)`)) return;
    await api.deleteAgent(a.config.id);
    if (selectedId === a.config.id) setSelectedId(null);
    await store.refreshAgents();
  }

  const pendingCount = store.permissions.length;
  const activeCount = store.agents.filter((a) => a.status !== 'offline').length;

  // ---------------------------------------------------------- komut paleti
  useHotkey('mod+k', () => setPaletteOpen((v) => !v));

  const commands = useMemo<Command[]>(
    () => [
      ...(Object.keys(TAB_TITLE) as Tab[])
        // Terminal ancak bir ajan seçiliyken anlamlı; palet ölü bir sekmeye atmasın.
        .filter((t) => t !== 'terminal' || selected)
        .map((t) => ({
          id: `tab:${t}`,
          label: `${TAB_TITLE[t]}'e git`,
          hint: 'bölüm',
          keywords: `sekme bölüm ${t}`,
          run: () => setTab(t),
        })),
      { id: 'new-agent', label: 'Yeni ajan', hint: 'oluştur', keywords: 'ekle create', run: () => setFormAgent('new') },
      { id: 'new-task', label: 'Yeni görev', hint: 'görevler', keywords: 'ata zincir', run: () => setTab('tasks') },
      { id: 'settings', label: 'Ayarlar', hint: 'bütçe', keywords: 'bütçe limit sınır', run: () => setSettingsOpen(true) },
      { id: 'theme-picker', label: 'Tema seç…', hint: 'görünüm', keywords: 'tema renk', run: () => setThemeOpen(true) },
      {
        id: 'toggle-all-agents',
        label: allOffline ? 'Tüm ajanları başlat' : 'Tüm ajanları durdur',
        hint: 'toplu',
        keywords: 'hepsi tumu baslat durdur',
        run: () => void toggleAllAgents(),
      },
      {
        id: 'toggle-all-auto-approve',
        label: allAutoApprove ? 'Tüm ajanlarda otomatik onayı kapat' : 'Tüm ajanlarda otomatik onayı aç',
        hint: 'toplu',
        keywords: 'oto onay izin hepsi tumu',
        run: () => void toggleAllAutoApprove(),
      },
      ...agentCommands(store.agents, openAgent, (a) => void toggleAgent(a)),
      ...themeCommands(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.agents, selected],
  );

  /** Sürüklenen ajanı hedef sıraya taşıyıp sunucuya yazar. */
  async function commitReorder(toIndex: number) {
    const ids = store.agents.map((a) => a.config.id);
    const from = ids.indexOf(dragId ?? '');
    setDragId(null);
    setDropIndex(null);
    if (from === -1 || from === toIndex) return;
    const next = [...ids];
    next.splice(toIndex, 0, next.splice(from, 1)[0]);
    await api.reorderAgents(next).catch(() => {});
    await store.refreshAgents();
  }

  /** Klavyeyle bir adım yukarı/aşağı taşır. */
  async function moveAgent(id: string, delta: number) {
    const ids = store.agents.map((a) => a.config.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    await api.reorderAgents(next).catch(() => {});
    await store.refreshAgents();
  }

  return (
    <div className="app">
      <header>
        <h1>CLAUDE MANAGER</h1>
        <span className="header-sub">{TAB_TITLE[tab]}{tab === 'terminal' && selected ? ` · ${selected.config.name}` : ''}</span>
        <div className="spacer" />
        {pendingCount > 0 && <span className="badge warn">⚠ {pendingCount} izin bekliyor</span>}
        {store.usage && (
          <span className="totals" title="toplam token (tüm ajanlar)">
            <span className="readout-key">Σ</span> {fmtNum(totalTokens(store.usage.total))} tok ·{' '}
            {fmtCost(store.usage.total.costUSD)}
          </span>
        )}
        {activeCount > 0 && (
          <span className="totals" title="çalışan ajan sayısı">
            <span className="readout-key">AKTİF</span> {activeCount}/{store.agents.length}
          </span>
        )}
        <span className={`conn ${store.connected ? 'on' : 'off'}`}>
          <span className={`led ${store.connected ? 'led-idle' : 'led-offline'}`} />
          {store.connected ? 'bağlantı aktif' : 'bağlantı yok'}
        </span>
        {/* Kısayol keşfedilebilir olsun: tıklanabilir bir ipucu */}
        <button className="kbd-hint" onClick={() => setPaletteOpen(true)} title="Komut paleti">
          {navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl+'}K
        </button>
        <button
          className={`icon-btn${store.budget?.exceeded ? ' alarm' : store.budget?.warn ? ' warn' : ''}`}
          onClick={() => setSettingsOpen(true)}
          title={
            store.budget?.limitUSD
              ? `Bugün $${store.budget.spentUSD.toFixed(4)} / $${store.budget.limitUSD.toFixed(2)}`
              : 'Ayarlar · bütçe sınırı'
          }
          aria-label="Ayarlar"
        >
          {ICONS.settings}
        </button>
        <button className="icon-btn" onClick={() => setThemeOpen(true)} title="Tema seç" aria-label="Tema seç">
          {ICONS.theme}
        </button>
        <button className="primary" onClick={() => setFormAgent('new')}>
          + Ajan
        </button>
      </header>

      <div className="layout">
        <Rail
          active={tab}
          onSelect={(id) => setTab(id as Tab)}
          items={[
            { id: 'bridge', label: 'Köprü', icon: ICONS.bridge },
            { id: 'office', label: 'Ofis', icon: ICONS.office },
            { id: 'dashboard', label: 'Panel', icon: ICONS.panel },
            { id: 'terminal', label: 'Terminal', icon: ICONS.terminal, disabled: !selected, badge: pendingCount || undefined },
            { id: 'tasks', label: 'Görevler', icon: ICONS.tasks },
            { id: 'prompts', label: 'Promptlar', icon: ICONS.prompts },
            { id: 'changes', label: 'Değişim', icon: ICONS.changes },
          ]}
        />

        {/* Mürettebat listesi yalnızca ajan seçiminin anlamlı olduğu bölümlerde */}
        {ROSTER_TABS.has(tab) && (
        <aside>
          <div className="roster-title">
            Mürettebat · {store.agents.length}
            <span className="roster-hint">sürükle → sırala</span>
          </div>
          {store.agents.length > 0 && (
            <div className="roster-actions">
              <button
                className="roster-action"
                disabled={bulkBusy}
                onClick={() => void toggleAllAgents()}
                title={allOffline ? 'Tüm ajanları başlat' : 'Tüm ajanları durdur'}
              >
                {allOffline ? 'Tümünü başlat' : 'Tümünü durdur'}
              </button>
              <button
                className={`roster-action${allAutoApprove ? ' warn' : ''}`}
                disabled={bulkBusy}
                onClick={() => void toggleAllAutoApprove()}
                title="Araç izin isteklerini onay istemeden otomatik kabul et"
              >
                {allAutoApprove ? 'Oto-onayı kapat' : 'Tümünde oto-onay aç'}
              </button>
            </div>
          )}
          <div className="agent-list">
            {store.agents.map((a, i) => (
              <div
                key={a.config.id}
                className={
                  `agent-row ${selectedId === a.config.id ? 'selected' : ''}` +
                  (dragId === a.config.id ? ' dragging' : '') +
                  (dropIndex === i && dragId && dragId !== a.config.id ? ' drop-target' : '')
                }
                onClick={() => openAgent(a.config.id)}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  setDragId(a.config.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropIndex(i);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void commitReorder(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openAgent(a.config.id);
                    return;
                  }
                  // Klavyeyle sıralama: Alt + yukarı/aşağı
                  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    void moveAgent(a.config.id, e.key === 'ArrowUp' ? -1 : 1);
                  }
                }}
              >
                <span className="agent-grip" aria-hidden="true">⋮⋮</span>
                <span className={`led led-${a.status}`} />
                <span className="agent-row-name">{a.config.name}</span>
                {a.pendingPermissions.length > 0 && <span className="badge warn">!</span>}
                <span className="agent-row-tokens">{fmtNum(totalTokens(a.usage))}</span>
              </div>
            ))}
            {store.agents.length === 0 && <div className="muted center">Mürettebat boş.</div>}
          </div>
        </aside>
        )}

        <main>
          {tab === 'bridge' && (
            <Bridge
              agents={store.agents}
              tasks={store.tasks}
              usage={store.usage}
              budget={store.budget}
              projectDir={store.projectDir}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenOffice={() => setTab('office')}
              onOpenAgent={openAgent}
            />
          )}

          {tab === 'office' && <Office agents={store.agents} tasks={store.tasks} onOpen={openAgent} />}

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
              <Terminal
                agent={selected}
                events={store.transcripts[selected.config.id] ?? []}
                projectDir={store.projectDir}
                agentCount={store.agents.length}
                onCleared={() => void store.loadTranscript(selected.config.id)}
              />
            ) : (
              <div className="muted center">Soldan bir ajan seç.</div>
            ))}

          {tab === 'tasks' && <TaskBoard tasks={store.tasks} agents={store.agents} />}

          {tab === 'changes' && <Changes agents={store.agents} />}

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

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}

      {themeOpen && <ThemePicker onClose={() => setThemeOpen(false)} />}

      {settingsOpen && (
        <Settings
          budget={store.budget}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => void store.refreshBudget()}
        />
      )}

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
