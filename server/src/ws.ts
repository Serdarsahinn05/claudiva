import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export type WsPayload =
  | { type: 'agent_status'; agentId: string; status: string; activity?: string }
  | { type: 'agent_event'; agentId: string; event: unknown }
  | { type: 'permission_request'; request: unknown }
  | { type: 'permission_resolved'; agentId: string; requestId: string }
  | {
      type: 'usage';
      usage: unknown;
      context?: Record<string, number>;
      /** Ajan başına SON TURUN payı; tümel toplamdan türetilemediği için ayrı taşınır. */
      turns?: Record<string, unknown>;
      budget?: unknown;
    }
  | { type: 'agents_changed' }
  | { type: 'commands_changed'; agentId: string; commands: unknown }
  | { type: 'task_update'; task: unknown }
  /** Tarayıcı durumu değişti — ajan da sürebildiği için panel yoklamayla öğrenemez. */
  | { type: 'browser_state'; state: unknown };

/** Bir yolun kendi WebSocket sunucusu (ör. `/ws/browser` kare akışı). */
export type WsRoute = (socket: WebSocket) => void;

/**
 * Broadcast-only WebSocket hub; clients never send anything but pings.
 *
 * Yükseltmeler (upgrade) BURADA yola göre dağıtılır. `server` seçeneğiyle iki
 * WebSocketServer aynı HTTP sunucusuna bağlanırsa her biri kendi yolu olmayan
 * isteği 400 ile keser (ws 8 `handleUpgrade` → `abortHandshake`), yani ikinci
 * bir yol hiç çalışmaz. Bu yüzden `noServer` + elle yönlendirme.
 */
export class WsHub {
  private wss: WebSocketServer;
  private routes = new Map<string, { wss: WebSocketServer; onSocket: WsRoute }>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (socket) => {
      socket.on('error', () => socket.terminate());
    });
    server.on('upgrade', (req, socket, head) => {
      const path = (req.url ?? '').split('?')[0];
      if (path === '/ws') {
        this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
        return;
      }
      const route = this.routes.get(path);
      if (route) {
        route.wss.handleUpgrade(req, socket, head, (ws) => {
          ws.on('error', () => ws.terminate());
          route.onSocket(ws);
        });
        return;
      }
      socket.destroy();
    });
  }

  /** Ek bir WebSocket yolu (yayın değil, bağlantı başına akış). */
  route(path: string, onSocket: WsRoute): void {
    this.routes.set(path, { wss: new WebSocketServer({ noServer: true }), onSocket });
  }

  broadcast(payload: WsPayload): void {
    const data = JSON.stringify(payload);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }
}
