import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from './useStore';
import { useLayout } from './useLayout';
import { api } from './api';
import { AgentCatalog } from './components/AgentCatalog';
import { AgentForm } from './components/AgentForm';
import { Terminal } from './components/Terminal';
import { Survey } from './components/Survey';
import { Rail, ICONS } from './components/Rail';
import { TaskBoard } from './components/TaskBoard';
import { PromptLibrary } from './components/PromptLibrary';
import { Office } from './components/Office';
import { Changes } from './components/Changes';
import { Memory } from './components/Memory';
import { UsageBoard } from './components/UsageBoard';
import { Code } from './components/Code';
import { Reports } from './components/Reports';
import { Skills } from './components/Skills';
import { Browser } from './components/Browser';
import { ThemePicker } from './components/ThemePicker';
import { Settings } from './components/Settings';
import { TeamTabs } from './components/TeamTabs';
import { Orchestrator } from './components/Orchestrator';
import { CenterGrid, SideDock, type CenterTile } from './components/Workspace';
import { CommandPalette, agentCommands, themeCommands, type Command } from './components/CommandPalette';
import { useHotkey } from './useHotkey';
import { dismissBoot } from './boot';
import { fmtCost, fmtNum, totalTokens } from './format';
import { ALL_TEAMS, agentsInTeam, tasksInTeam, teamsOf } from './teams';
import { PANELS, tileKey, type PanelId } from './workspace';
import type { AgentSnapshot } from './types';

export default function App() {
  const store = useStore();
  const L = useLayout();

  const [team, setTeam] = useState<string>(ALL_TEAMS);
  const [focusedTile, setFocusedTile] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [formAgent, setFormAgent] = useState<AgentSnapshot | null | 'new'>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ------------------------------------------------------------- kapsam
  const teams = useMemo(() => teamsOf(store.agents), [store.agents]);
  const teamAgents = useMemo(() => agentsInTeam(store.agents, team), [store.agents, team]);
  const teamTasks = useMemo(() => tasksInTeam(store.tasks, teamAgents, team), [store.tasks, teamAgents, team]);
  const teamLabel = team === ALL_TEAMS ? 'Tüm ekip' : team;

  /**
   * Seçili takım ortadan kalkabilir (son üyesi başka takıma taşınır, ajan
   * silinir). O zaman kapsam var olmayan bir adda takılı kalır ve panel
   * boş görünür — sessizce "tümü"ne düşülür.
   */
  useEffect(() => {
    if (team !== ALL_TEAMS && store.agents.length && !teams.some((t) => t.name === team)) {
      setTeam(ALL_TEAMS);
    }
  }, [teams, team, store.agents.length]);

  // Açılış perdesi veri gelir gelmez kalkar (sabit süre yok — bkz. boot.ts).
  useEffect(() => {
    if (store.ready) dismissBoot();
  }, [store.ready]);

  // ---------------------------------------------------------- terminaller
  /** Ortada gözü açık olan ajanlar (silinmiş ajanlar elenir). */
  const openTerminalIds = useMemo(() => {
    const alive = new Set(store.agents.map((a) => a.config.id));
    return L.layout.center.tiles
      .filter((t) => t.kind === 'terminal' && alive.has(t.agentId))
      .map((t) => (t as { agentId: string }).agentId);
  }, [L.layout.center.tiles, store.agents]);

  /**
   * Açık her terminalin dökümü yüklenmeli. Eskiden tek seçili ajan vardı ve
   * tek bir efekt yetiyordu; döşeli terminalde her yeni göz kendi geçmişini
   * ister — yoksa terminal boş açılır ve ancak bir sonraki olayda dolar.
   */
  useEffect(() => {
    for (const id of openTerminalIds) {
      if (!store.transcripts[id]) void store.loadTranscript(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTerminalIds]);

  const openTerminal = useCallback(
    (id: string) => {
      L.openTerminal(id);
      setFocusedTile(`t:${id}`);
    },
    [L],
  );

  // -------------------------------------------------------------- eylemler
  async function toggleAgent(a: AgentSnapshot) {
    if (a.status === 'offline') await api.startAgent(a.config.id);
    else await api.stopAgent(a.config.id);
    await store.refreshAgents();
  }

  const [bulkBusy, setBulkBusy] = useState(false);
  const allOffline = teamAgents.length > 0 && teamAgents.every((a) => a.status === 'offline');
  const allAutoApprove = teamAgents.length > 0 && teamAgents.every((a) => a.config.autoApprove);

  /**
   * Toplu başlat/durdur. Hedef SEÇİLİ TAKIMDIR: "tümünü durdur" derken
   * kullanıcı ekranda gördüğü ekibi kastediyor, gizlenmiş bir takımı değil.
   * Filtrelemeye gerek yok, start()/stop() doğru durumdaki ajanda no-op.
   */
  async function toggleAllAgents() {
    if (bulkBusy || teamAgents.length === 0) return;
    setBulkBusy(true);
    try {
      const starting = allOffline;
      await Promise.all(
        teamAgents.map((a) => (starting ? api.startAgent(a.config.id) : api.stopAgent(a.config.id))),
      );
      await store.refreshAgents();
    } finally {
      setBulkBusy(false);
    }
  }

  async function toggleAllAutoApprove() {
    if (bulkBusy || teamAgents.length === 0) return;
    setBulkBusy(true);
    try {
      const next = !allAutoApprove;
      await Promise.all(teamAgents.map((a) => api.updateAgent(a.config.id, { autoApprove: next })));
      await store.refreshAgents();
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteAgent(a: AgentSnapshot) {
    if (!confirm(`"${a.config.name}" ajanı ve tanım dosyaları silinsin mi? (Hafızası silinmez)`)) return;
    await api.deleteAgent(a.config.id);
    L.closeTile(`t:${a.config.id}`);
    await store.refreshAgents();
  }

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

  const pendingCount = store.permissions.length;
  const activeCount = store.agents.filter((a) => a.status !== 'offline').length;

  // ------------------------------------------------------- panel gövdeleri
  /**
   * Panel içeriği yuvadan bağımsız üretilir: aynı panel solda da ortada da
   * sağda da aynı bileşendir. Kapsam süzgeci (takım) burada tek noktada
   * uygulanıyor — her panelin ayrı ayrı takımı bilmesi gerekmiyor.
   */
  const renderPanel = useCallback(
    (id: PanelId) => {
      switch (id) {
        case 'survey':
          return (
            <Survey
              agents={teamAgents}
              tasks={teamTasks}
              usage={store.usage}
              budget={store.budget}
              projectDir={store.projectDir}
              selectedId={focusedTile?.startsWith('t:') ? focusedTile.slice(2) : null}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenAgent={openTerminal}
            />
          );
        case 'office':
          return <Office agents={teamAgents} tasks={teamTasks} onOpen={openTerminal} />;
        case 'agents':
          return teamAgents.length > 0 ? (
            <AgentCatalog
              agents={teamAgents}
              onOpen={openTerminal}
              onEdit={(a) => setFormAgent(a)}
              onDelete={(a) => void deleteAgent(a)}
              onToggle={(a) => void toggleAgent(a)}
              onToggleAll={() => void toggleAllAgents()}
              onToggleAllAutoApprove={() => void toggleAllAutoApprove()}
              busy={bulkBusy}
              showTeam={team === ALL_TEAMS && teams.length > 1}
            />
          ) : (
            <div className="empty">
              <h2>Ekibi kur</h2>
              <p>
                "Yeni ajan" ile ilk ajanını oluştur. Öneri: önce bir <strong>patron</strong> oluştur
                (Opus/Sonnet), sonra farklı uzmanlıklarda <strong>çalışan</strong> ajanlar ekle
                (Haiku/Sonnet).
              </p>
              <p>Patrona ne istediğini anlat — işi ekibe kendisi dağıtır.</p>
            </div>
          );
        case 'usage':
          return <UsageBoard agents={teamAgents} usage={store.usage} budget={store.budget} />;
        case 'tasks':
          return <TaskBoard tasks={teamTasks} agents={teamAgents} />;
        case 'code':
          return <Code agents={store.agents} />;
        case 'reports':
          return <Reports agents={teamAgents} />;
        case 'skills':
          return <Skills agents={store.agents} />;
        case 'browser':
          return <Browser pushed={store.browserState} />;
        case 'changes':
          return <Changes agents={store.agents} />;
        case 'memory':
          return <Memory />;
        case 'prompts':
          return (
            <PromptLibrary
              prompts={store.prompts}
              agents={teamAgents}
              onChanged={() => void store.refreshPrompts()}
              onSent={openTerminal}
            />
          );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamAgents, teamTasks, store.usage, store.budget, store.prompts, store.projectDir, focusedTile,
     bulkBusy, team, teams.length, store.agents, store.browserState],
  );

  // ------------------------------------------------------------ orta gözler
  const centerTiles = useMemo<CenterTile[]>(() => {
    const byId = new Map(store.agents.map((a) => [a.config.id, a]));
    const inTeam = new Set(teamAgents.map((a) => a.config.id));

    return L.layout.center.tiles.flatMap<CenterTile>((t) => {
      if (t.kind === 'panel') {
        return [{
          key: tileKey(t),
          title: PANELS[t.id].title,
          hint: PANELS[t.id].hint,
          body: renderPanel(t.id),
          panelId: t.id,
        }];
      }
      const agent = byId.get(t.agentId);
      // Silinmiş ajanın gözü çizilmez; takım dışındaki gözler KAPANMAZ,
      // yalnızca kapsam dışında oldukları için gizlenir — takıma dönünce
      // aynı terminal yerinde durur.
      if (!agent || !inTeam.has(t.agentId)) return [];
      return [{
        key: tileKey(t),
        title: agent.config.name,
        hint: agent.currentActivity && agent.status === 'working' ? agent.currentActivity : undefined,
        badge: (
          <span className="tile-badge">
            <span className={`led led-${agent.status}`} />
            <span className="tile-model">{agent.currentModel ?? agent.config.model}</span>
            {/* Tur payı toplamdan AYRI okunur: `usage` tümel toplam olduğu için
                "şu an ne kadar yakıyor" sorusunu tek başına yanıtlamıyor. */}
            {agent.lastTurn && (
              <span className="tile-turn" title={`son tur · ${fmtCost(agent.lastTurn.costUSD)}`}>
                +{fmtNum(totalTokens(agent.lastTurn))}
              </span>
            )}
            <span className="tile-tok" title={`toplam · ${fmtCost(agent.usage.costUSD)}`}>
              {fmtNum(totalTokens(agent.usage))}
            </span>
          </span>
        ),
        body: (
          <Terminal
            agent={agent}
            events={store.transcripts[agent.config.id] ?? []}
            projectDir={store.projectDir}
            agents={teamAgents}
            tasks={teamTasks}
            usage={store.usage}
            budget={store.budget}
            connected={store.connected}
            onCleared={() => void store.loadTranscript(agent.config.id)}
            onAgentsChanged={() => void store.refreshAgents()}
          />
        ),
      }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L.layout.center.tiles, store.agents, store.transcripts, teamAgents, teamTasks,
      store.usage, store.budget, store.connected, store.projectDir, renderPanel]);

  // -------------------------------------------------------- panel görünürlüğü
  const visiblePanels = useMemo(() => {
    const s = new Set<PanelId>();
    for (const p of L.layout.left.panels) if (L.layout.left.open && L.layout.left.active === p) s.add(p);
    for (const p of L.layout.right.panels) if (L.layout.right.open && L.layout.right.active === p) s.add(p);
    for (const t of L.layout.center.tiles) if (t.kind === 'panel') s.add(t.id);
    return s;
  }, [L.layout]);

  const togglePanel = useCallback(
    (id: PanelId) => {
      if (visiblePanels.has(id)) L.closePanel(id);
      else L.showPanel(id);
    },
    [visiblePanels, L],
  );

  // ---------------------------------------------------------- komut paleti
  useHotkey('mod+k', () => setPaletteOpen((v) => !v));

  const commands = useMemo<Command[]>(
    () => [
      ...(Object.keys(PANELS) as PanelId[]).map((p) => ({
        id: `panel:${p}`,
        label: `${PANELS[p].title} panelini ${visiblePanels.has(p) ? 'kapat' : 'aç'}`,
        hint: 'panel',
        keywords: `panel bolum ${p}`,
        run: () => togglePanel(p),
      })),
      ...teams.map((t) => ({
        id: `team:${t.name}`,
        label: `${t.name} takımına geç`,
        hint: `${t.count} ajan`,
        keywords: `takim team ${t.name}`,
        run: () => setTeam(t.name),
      })),
      { id: 'team-all', label: 'Tüm takımlar', hint: 'kapsam', keywords: 'tumu hepsi takim', run: () => setTeam(ALL_TEAMS) },
      { id: 'new-agent', label: 'Yeni ajan', hint: 'oluştur', keywords: 'ekle create', run: () => setFormAgent('new') },
      { id: 'settings', label: 'Ayarlar', hint: 'bütçe', keywords: 'bütçe limit sınır', run: () => setSettingsOpen(true) },
      { id: 'theme-picker', label: 'Görünüm…', hint: 'plaka', keywords: 'tema renk plaka premium', run: () => setThemeOpen(true) },
      { id: 'layout-reset', label: 'Yerleşimi sıfırla', hint: 'düzen', keywords: 'duzen yerlesim reset panel', run: () => L.reset() },
      {
        id: 'toggle-all-agents',
        label: allOffline ? `${teamLabel}: tüm ajanları başlat` : `${teamLabel}: tüm ajanları durdur`,
        hint: 'toplu',
        keywords: 'hepsi tumu baslat durdur',
        run: () => void toggleAllAgents(),
      },
      {
        id: 'toggle-all-auto-approve',
        label: allAutoApprove ? 'Otomatik onayı kapat' : 'Otomatik onayı aç',
        hint: 'toplu',
        keywords: 'oto onay izin hepsi tumu',
        run: () => void toggleAllAutoApprove(),
      },
      ...agentCommands(teamAgents, openTerminal, (a) => void toggleAgent(a)),
      ...themeCommands(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamAgents, teams, visiblePanels, allOffline, allAutoApprove, teamLabel],
  );

  const panelBadge = useCallback(
    (id: PanelId) => {
      if (id === 'tasks') return teamTasks.filter((t) => t.status === 'running').length || undefined;
      if (id === 'agents') return pendingCount || undefined;
      return undefined;
    },
    [teamTasks, pendingCount],
  );

  return (
    <div className="app">
      <header>
        <h1>claude-manager</h1>

        <TeamTabs agents={store.agents} value={team} onChange={setTeam} />

        <div className="spacer" />

        {pendingCount > 0 && <span className="badge warn">{pendingCount} izin bekliyor</span>}
        {store.usage && (
          <span className="totals" title="toplam token (tüm ajanlar)">
            <span className="readout-key">TOPLAM</span> {fmtNum(totalTokens(store.usage.total))} tok ·{' '}
            {fmtCost(store.usage.total.costUSD)}
          </span>
        )}
        {activeCount > 0 && (
          <span className="totals" title="çalışan ajan sayısı">
            <span className="readout-key">AÇIK</span> {activeCount}/{store.agents.length}
          </span>
        )}
        <span className={`conn ${store.connected ? 'on' : 'off'}`}>
          <span className={`led ${store.connected ? 'led-idle' : 'led-offline'}`} />
          {store.connected ? 'bağlı' : 'bağlantı yok'}
        </span>
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
        <button className="icon-btn" onClick={() => setThemeOpen(true)} title="Görünüm" aria-label="Görünüm">
          {ICONS.plate}
        </button>
        <button className="icon-btn" onClick={L.reset} title="Yerleşimi sıfırla" aria-label="Yerleşimi sıfırla">
          {ICONS.layout}
        </button>
        <button className="primary" onClick={() => setFormAgent('new')}>
          Yeni ajan
        </button>
      </header>

      <div className="layout">
        <Rail
          visible={visiblePanels}
          onTogglePanel={togglePanel}
          panelBadge={panelBadge}
          agents={teamAgents}
          openTerminals={new Set(openTerminalIds)}
          onOpenTerminal={openTerminal}
          onReorder={(id, d) => void moveAgent(id, d)}
          dragId={dragId}
          dropIndex={dropIndex}
          onDragState={(d, i) => {
            setDragId(d);
            setDropIndex(i);
          }}
          onCommitReorder={(i) => void commitReorder(i)}
          foot={store.projectDir}
        />

        <SideDock
          side="left"
          dock={L.layout.left}
          render={renderPanel}
          onActivate={(id) => L.setActive('left', id)}
          onToggle={() => L.toggleDock('left')}
          onWidth={(w) => L.setDockWidth('left', w)}
          onDock={L.movePanel}
          onClose={L.closePanel}
        />

        <CenterGrid
          tiles={centerTiles}
          maximized={L.layout.center.maximized}
          focused={focusedTile}
          onFocus={setFocusedTile}
          onToggleMax={L.toggleMaximize}
          onClose={L.closeTile}
          onDock={L.movePanel}
          onMoveTile={L.moveTile}
          empty={
            <div className="empty">
              <h2>Çalışma alanı boş</h2>
              <p>
                Soldaki <strong>Ekip</strong> listesinden bir ajana bas — terminali burada açılır.
                Birden fazla ajana basarsan hepsi yan yana döşenir.
              </p>
              <p>
                Bir panelin sekmesini ya da başlığını tutup <strong>buraya sürükleyebilirsin</strong>;
                yuvalar arasında da aynı şekilde taşınır.
              </p>
            </div>
          }
        />

        <SideDock
          side="right"
          dock={L.layout.right}
          render={renderPanel}
          onActivate={(id) => L.setActive('right', id)}
          onToggle={() => L.toggleDock('right')}
          onWidth={(w) => L.setDockWidth('right', w)}
          onDock={L.movePanel}
          onClose={L.closePanel}
        />
      </div>

      <Orchestrator teamAgents={teamAgents} teamLabel={teamLabel} onOpenTerminal={openTerminal} />

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}

      {themeOpen && <ThemePicker onClose={() => setThemeOpen(false)} />}

      {settingsOpen && (
        <Settings
          budget={store.budget}
          agents={store.agents}
          onResetLayout={L.reset}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => void store.refreshBudget()}
        />
      )}

      {formAgent !== null && (
        <AgentForm
          existing={formAgent === 'new' ? undefined : formAgent}
          teams={teams.map((t) => t.name)}
          onClose={() => setFormAgent(null)}
          onSaved={() => void store.refreshAgents()}
        />
      )}
    </div>
  );
}
