import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export type WsPayload =
  | { type: 'agent_status'; agentId: string; status: string; activity?: string }
  | { type: 'agent_event'; agentId: string; event: unknown }
  | { type: 'permission_request'; request: unknown }
  | { type: 'permission_resolved'; agentId: string; requestId: string }
  | { type: 'usage'; usage: unknown; context?: Record<string, number> }
  | { type: 'agents_changed' }
  | { type: 'commands_changed'; agentId: string; commands: unknown }
  | { type: 'task_update'; task: unknown };

/** Broadcast-only WebSocket hub; clients never send anything but pings. */
export class WsHub {
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    // HTTP sunucusu dinlemeye başlayamazsa (ör. EADDRINUSE) ws bu hatayı kendi
    // üzerinden yeniden yayar. Dinleyici olmazsa Node ham bir stack trace ile
    // çöker; asıl mesajı index.ts'teki server.on('error') basıyor.
    this.wss.on('error', () => {});
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
