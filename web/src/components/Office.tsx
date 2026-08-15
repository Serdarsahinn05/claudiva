/**
 * Canlı ofis sekmesi: pixel-agents tarzı tile-tabanlı ofis motorunu
 * panel durum akışına bağlar. Karakterler ajanların gerçek durumunu yansıtır:
 * çalışırken masada yazar/okur, boştayken gezinir, izin beklerken baloncuk çıkarır.
 */
import { useEffect, useRef, useState } from 'react';
import { loadOfficeAssets, type OfficeAssets } from '../office/assets';
import { generateOffice } from '../office/autoLayout';
import { MAX_DELTA_TIME_SEC } from '../office/constants';
import { OfficeState } from '../office/officeState';
import { renderOffice } from '../office/renderer';
import { TILE_SIZE } from '../office/types';
import { STATUS_LABEL } from '../format';
import type { AgentSnapshot, AgentStatus, Task } from '../types';

const ZOOM = 3;

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  onOpen: (agentId: string) => void;
}

/** Ajan anlık görüntülerini motor çağrılarına çevirir */
function syncAgents(state: OfficeState, agents: AgentSnapshot[], firstSync: boolean): void {
  const seen = new Set<string>();
  for (const a of agents) {
    const id = a.config.id;
    seen.add(id);
    if (!state.characters.has(id)) {
      state.addAgent(id, a.config.name, a.config.role, firstSync);
    }
    const ch = state.characters.get(id)!;
    ch.name = a.config.name;
    ch.role = a.config.role;

    const status: AgentStatus = a.status;
    state.setAgentOffline(id, status === 'offline');
    if (status !== 'offline') {
      const prevActive = ch.isActive;
      // waiting = izin bekliyor → masasında oturmaya devam etsin (aktif poz)
      state.setAgentActive(id, status === 'working' || status === 'waiting');
      // Tur bitti: yeşil onay baloncuğu
      if (prevActive && status === 'idle' && !firstSync) {
        state.showWaitingBubble(id);
      }
    }
    state.setAgentTool(id, a.currentActivity ?? null);
    state.setAgentTokens(id, a.contextTokens ?? 0);

    if (a.pendingPermissions.length > 0) {
      state.showPermissionBubble(id);
    } else {
      state.clearPermissionBubble(id);
    }
  }
  // Kaldırılan ajanlar despawn olur
  for (const ch of state.getCharacters()) {
    if (!seen.has(ch.id)) state.removeAgent(ch.id);
  }
}

export function Office({ agents, tasks, onOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<OfficeAssets | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const stateRef = useRef<OfficeState | null>(null);
  const rosterKeyRef = useRef('');
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const processedTasksRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    loadOfficeAssets().then(setAssets, (e: Error) => setAssetError(e.message));
  }, []);

  // Kadro değişince düzeni yeniden üret; diğer değişimlerde sadece durum eşle
  useEffect(() => {
    const rosterKey = agents
      .map((a) => `${a.config.id}:${a.config.role}`)
      .sort()
      .join('|');
    if (!stateRef.current) {
      if (agents.length === 0) return;
      stateRef.current = new OfficeState(
        generateOffice(agents.map((a) => ({ id: a.config.id, role: a.config.role }))),
      );
      rosterKeyRef.current = rosterKey;
      syncAgents(stateRef.current, agents, true);
      return;
    }
    if (rosterKey !== rosterKeyRef.current) {
      rosterKeyRef.current = rosterKey;
      // Yeni kadroya göre düzeni yeniden kur (silinenler despawn animasyonunu
      // yeni düzende oynatır)
      const roster = agents.map((a) => ({ id: a.config.id, role: a.config.role }));
      stateRef.current.rebuildFromOffice(generateOffice(roster));
    }
    syncAgents(stateRef.current, agents, false);
  }, [agents]);

  // Delegasyon: yeni görev koşmaya başlayınca atayan, atananın masasına yürür
  useEffect(() => {
    if (!processedTasksRef.current) {
      // İlk yüklemedeki eski görevleri tetikleme
      processedTasksRef.current = new Set(tasks.map((t) => t.id));
      return;
    }
    const state = stateRef.current;
    for (const t of tasks) {
      if (processedTasksRef.current.has(t.id)) continue;
      processedTasksRef.current.add(t.id);
      if (state && t.assignedBy && t.assignedBy !== t.assignedTo) {
        state.visitAgent(t.assignedBy, t.assignedTo);
      }
    }
  }, [tasks]);

  // Oyun döngüsü
  useEffect(() => {
    if (!assets) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_DELTA_TIME_SEC);
      last = now;
      const state = stateRef.current;
      if (!state || !canvas || !ctx || !assets) return;

      const w = state.layout.cols * TILE_SIZE * ZOOM;
      const h = state.layout.rows * TILE_SIZE * ZOOM;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      state.update(dt);
      const statuses = new Map<string, AgentStatus>(
        agentsRef.current.map((a) => [a.config.id, a.status]),
      );
      renderOffice(ctx, state, assets, statuses, STATUS_LABEL, ZOOM);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [assets]);

  function worldPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * (canvas.width / rect.width)) / ZOOM,
      y: ((e.clientY - rect.top) * (canvas.height / rect.height)) / ZOOM,
    };
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = worldPos(e);
    const state = stateRef.current;
    if (!pos || !state) return;
    const id = state.getCharacterAt(pos.x, pos.y);
    if (id) onOpen(id);
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = worldPos(e);
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!pos || !state || !canvas) return;
    const id = state.getCharacterAt(pos.x, pos.y);
    state.hoveredAgentId = id;
    canvas.style.cursor = id ? 'pointer' : 'default';
  }

  if (assetError || agents.length === 0) {
    return assetError ? (
      <div className="empty">
        <h2>Ofis yüklenemedi</h2>
        <p className="muted">{assetError}</p>
      </div>
    ) : (
      <div className="empty">
        <h2>Ofis boş</h2>
        <p>"Yeni ajan" ile ilk çalışanı işe al — masasına oturup seni bekleyecek.</p>
      </div>
    );
  }

  return (
    <div className="office-wrap">
      {/* Tuval plakaya oturtulur: hafif renk uyumu + tarama çizgisi katmanı */}
      <div className="viewscreen">
        <span className="viewscreen-label">Canlı ofis</span>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMove}
          style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
          title="Bir karaktere tıklayınca terminali açılır"
        />
      </div>
      {/* Efsane: durum işaretleri gökyüzündekiyle aynı dili konuşur */}
      <div className="office-legend">
        <span><span className="led led-working" />çalışıyor</span>
        <span><span className="led led-idle" />boşta</span>
        <span><span className="led led-waiting" />onay bekliyor</span>
        <span><span className="led led-offline" />kapalı</span>
        <span className="muted">karaktere tıkla → terminal</span>
      </div>
    </div>
  );
}
