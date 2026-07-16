import { useEffect, useMemo, useRef } from 'react';
import type { AgentSnapshot } from '../types';
import { STATUS_LABEL } from '../format';
import {
  SIT_OPEN,
  SIT_BLINK,
  SLEEP_A,
  SLEEP_B,
  catColor,
  makePalette,
  drawSprite,
  OFFLINE_COLOR,
} from '../office/sprites';

const S = 3; // piksel ölçeği
const CELL_W = 62; // mantıksal piksel
const CELL_H = 74;
const PAD = 10;
const COLS = 4;

interface Cell {
  agent: AgentSnapshot;
  x: number; // mantıksal
  y: number;
}

function layout(agents: AgentSnapshot[]): { cells: Cell[]; w: number; h: number } {
  const bosses = agents.filter((a) => a.config.role === 'boss');
  const rest = agents.filter((a) => a.config.role !== 'boss');
  const cells: Cell[] = [];

  const bossCols = Math.max(bosses.length, 1);
  const restCols = Math.min(Math.max(rest.length, 1), COLS);
  const totalCols = Math.max(bosses.length ? bossCols : 0, rest.length ? restCols : 0, 2);
  const w = PAD * 2 + totalCols * CELL_W;

  let y = PAD;
  if (bosses.length) {
    const offset = PAD + ((totalCols - bosses.length) * CELL_W) / 2;
    bosses.forEach((a, i) => cells.push({ agent: a, x: offset + i * CELL_W, y }));
    y += CELL_H + 6;
  }
  if (rest.length) {
    const rows = Math.ceil(rest.length / restCols);
    rest.forEach((a, i) => {
      const col = i % restCols;
      const row = Math.floor(i / restCols);
      const inRow = row === rows - 1 ? rest.length - row * restCols : restCols;
      const offset = PAD + ((totalCols - inRow) * CELL_W) / 2;
      cells.push({ agent: a, x: offset + col * CELL_W, y: y + row * CELL_H });
    });
    y += rows * CELL_H;
  }
  return { cells, w, h: y + PAD };
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#23262e';
  ctx.fillRect(0, 0, w * S, h * S);
  const tile = 8;
  for (let ty = 0; ty * tile < h; ty++) {
    for (let tx = 0; tx * tile < w; tx++) {
      if ((tx + ty) % 2 === 0) continue;
      ctx.fillStyle = '#262a33';
      ctx.fillRect(tx * tile * S, ty * tile * S, tile * S, tile * S);
    }
  }
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#7e2f35';
  ctx.fillRect((x + 4) * S, (y + 4) * S, (CELL_W - 8) * S, (CELL_H - 26) * S);
  ctx.fillStyle = '#96444a';
  ctx.fillRect((x + 6) * S, (y + 6) * S, (CELL_W - 12) * S, (CELL_H - 30) * S);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, working: boolean, tick: number): void {
  const deskY = y + 36;
  // masa gövdesi
  ctx.fillStyle = '#1c1622';
  ctx.fillRect((x + 10) * S, (deskY - 1) * S, (CELL_W - 20) * S, 8 * S);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect((x + 11) * S, deskY * S, (CELL_W - 22) * S, 6 * S);
  ctx.fillStyle = '#a06c3f';
  ctx.fillRect((x + 11) * S, deskY * S, (CELL_W - 22) * S, 2 * S);
  // masa ayakları
  ctx.fillStyle = '#6e4628';
  ctx.fillRect((x + 13) * S, (deskY + 6) * S, 2 * S, 3 * S);
  ctx.fillRect((x + CELL_W - 15) * S, (deskY + 6) * S, 2 * S, 3 * S);
  // laptop: ekran masanın üstünde, kedinin sağ yanında (gövdeyi örtmesin)
  const lx = x + CELL_W / 2 + 3;
  ctx.fillStyle = '#2b2433';
  ctx.fillRect(lx * S, (deskY - 8) * S, 10 * S, 8 * S);
  const glow = working ? (tick % 2 ? '#7fd4ff' : '#5db8ea') : '#454c5c';
  ctx.fillStyle = glow;
  ctx.fillRect((lx + 1) * S, (deskY - 7) * S, 8 * S, 6 * S);
  if (working) {
    // ekranda kayan "kod" satırları
    ctx.fillStyle = '#eaf7ff';
    for (let i = 0; i < 3; i++) {
      const wLine = 2 + ((tick + i * 2) % 5);
      ctx.fillRect((lx + 2) * S, (deskY - 6 + i * 2) * S, wLine * S, S);
    }
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = '#e8c33c';
  ctx.fillRect((cx + 5) * S, (cy - 3) * S, 6 * S, 2 * S);
  ctx.fillRect((cx + 5) * S, (cy - 5) * S, S, 2 * S);
  ctx.fillRect((cx + 8) * S, (cy - 5) * S, S, 2 * S);
  ctx.fillRect((cx + 10) * S, (cy - 5) * S, S, 2 * S);
  ctx.fillStyle = '#c9482f';
  ctx.fillRect((cx + 7) * S, (cy - 2) * S, 2 * S, S);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = '#cfd6e4';
  ctx.fillRect((cx + 7) * S, (cy - 4) * S, 2 * S, 2 * S);
  ctx.fillRect((cx + 6) * S, (cy - 3) * S, 4 * S, S);
}

function bubble(ctx: CanvasRenderingContext2D, pxX: number, pxY: number, text: string, bg: string, fg: string): void {
  ctx.font = `bold ${4 * S}px monospace`;
  const w = ctx.measureText(text).width + 4 * S;
  const h = 6 * S;
  const bx = pxX - w / 2;
  const by = pxY - h;
  ctx.fillStyle = bg;
  ctx.fillRect(bx, by, w, h);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pxX, by + h / 2 + S / 2);
  // balon kuyruğu
  ctx.fillStyle = bg;
  ctx.fillRect(pxX - S, by + h, 2 * S, S);
}

interface Props {
  agents: AgentSnapshot[];
  onOpen: (agentId: string) => void;
}

export function Office({ agents, onOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const cellsRef = useRef<Cell[]>([]);

  const { w, h } = useMemo(() => layout(agents), [agents]);
  const hasAgents = agents.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = 0;

    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      if (now - last < 240) return; // ~4 fps piksel animasyonu
      last = now;
      if (!ctx) return;
      const tick = Math.floor(now / 480);
      const { cells, w, h } = layout(agentsRef.current);
      cellsRef.current = cells;

      drawFloor(ctx, w, h);

      for (const cell of cells) {
        const { agent, x, y } = cell;
        const { config, status, currentActivity, pendingPermissions } = agent;
        const isBoss = config.role === 'boss';
        const catX = x + (CELL_W - 16) / 2;
        const catY = y + 11;
        const centerPx = (x + CELL_W / 2) * S;

        if (isBoss) drawRug(ctx, x, y);

        // kedi
        const colors = status === 'offline' ? OFFLINE_COLOR : catColor(config.id);
        const palette = makePalette(colors.body, colors.shade);
        let sprite;
        if (status === 'working') {
          sprite = tick % 4 === 3 ? SIT_BLINK : SIT_OPEN;
        } else if (status === 'waiting') {
          sprite = SIT_OPEN;
        } else {
          sprite = tick % 2 ? SLEEP_A : SLEEP_B; // idle & offline: uyuyan kedi
        }
        const bob = status === 'working' && tick % 2 ? 1 : 0;
        drawSprite(ctx, sprite, palette, catX, catY + bob, S);

        // rol işareti
        if (isBoss) drawCrown(ctx, catX, catY + bob);
        else if (config.role === 'manager' || config.role === 'team-leader') drawStar(ctx, catX, catY + bob);

        // masa (kedinin önünde)
        drawDesk(ctx, x, y, status === 'working', tick);

        // durum baloncukları
        if (status === 'waiting' && pendingPermissions.length > 0) {
          const jump = tick % 2 ? 0 : 2 * S;
          bubble(ctx, centerPx, (y + 9) * S - jump, '!', '#d29922', '#1c1622');
        } else if (status === 'working' && currentActivity) {
          bubble(ctx, centerPx, (y + 9) * S, currentActivity.slice(0, 14), '#161a22', '#7fd4ff');
        } else if (status === 'idle') {
          ctx.font = `${4 * S}px monospace`;
          ctx.fillStyle = '#7d8698';
          ctx.textAlign = 'center';
          ctx.fillText('z', centerPx + 8 * S, (y + 13 - (tick % 3)) * S);
          ctx.fillText('z', centerPx + 11 * S, (y + 9 - ((tick + 1) % 3)) * S);
        }

        // isim + durum etiketi
        ctx.textAlign = 'center';
        ctx.font = `bold ${3.6 * S}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = status === 'offline' ? '#7d8698' : '#e6eaf2';
        ctx.fillText(config.name.slice(0, 16), centerPx, (y + 52) * S);
        ctx.font = `${3 * S}px 'Segoe UI', sans-serif`;
        const statusColors: Record<string, string> = {
          working: '#5db8ea',
          waiting: '#d29922',
          idle: '#3fb950',
          offline: '#7d8698',
        };
        ctx.fillStyle = statusColors[status] ?? '#7d8698';
        ctx.fillText(STATUS_LABEL[status] ?? status, centerPx, (y + 58) * S);
      }
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hasAgents]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) * (canvas.width / rect.width)) / S;
    const ly = ((e.clientY - rect.top) * (canvas.height / rect.height)) / S;
    const cell = cellsRef.current.find(
      (c) => lx >= c.x && lx <= c.x + CELL_W && ly >= c.y && ly <= c.y + CELL_H,
    );
    if (cell) onOpen(cell.agent.config.id);
  }

  if (agents.length === 0) {
    return (
      <div className="empty">
        <h2>Ofis boş 🐈</h2>
        <p>"+ Yeni Ajan" ile ilk kediyi işe al — masasına oturup seni bekleyecek.</p>
      </div>
    );
  }

  return (
    <div className="office-wrap">
      <canvas
        ref={canvasRef}
        width={w * S}
        height={h * S}
        onClick={handleClick}
        style={{ imageRendering: 'pixelated', cursor: 'pointer', maxWidth: '100%' }}
        title="Bir kediye tıklayınca terminali açılır"
      />
      <div className="office-legend muted">
        💤 boşta · 💻 çalışıyor · <span style={{ color: 'var(--yellow)' }}>!</span> onay bekliyor · gri = kapalı ·
        kediye tıkla → terminal
      </div>
    </div>
  );
}
