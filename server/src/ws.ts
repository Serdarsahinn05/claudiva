import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export type WsPayload =
  | { type: 'agent_status'; agentId: string; status: string; activity?: string }
  | { type: 'agent_event'; agentId: string; event: unknown }
  | { type: 'permission_request'; request: unknown }
  | { type: 'permission_resolved'; agentId: string; requestId: string }
  | { type: 'usage'; usage: unknown }
  | { type: 'agents_changed' }
  | { type: 'task_update'; task: unknown };

/** Broadcast-only WebSocket hub; clients never send anything but pings. */
export class WsHub {
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket) => {
      socket.on('error', () => socket.terminate());
    });
  }

  broadcast(payload: WsPayload): void {
    const data = JSON.stringify(payload);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }
}
