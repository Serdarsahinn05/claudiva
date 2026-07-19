import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { ensureDirs, INSTALL_ROOT, PROJECT_DIR, HOME_DIR } from './paths.js';
import { AgentManager } from './agents/manager.js';
import { TaskQueue } from './tasks/queue.js';
import { PromptStore } from './prompts/store.js';
import { createTeamServer, TEAM_TOOL_RULES } from './boss/tools.js';
import { createTaskServer, TASK_TOOL_RULES } from './tasks/tools.js';
import { createSelfServer, SELF_TOOL_RULES } from './agents/selfTools.js';
import { createRoutes } from './api/routes.js';
import { ChangeLog } from './changes.js';
import { WsHub } from './ws.js';

const PORT = Number(process.env.PORT ?? 4600);

ensureDirs();

const manager = new AgentManager();
const tasks = new TaskQueue(manager);
const prompts = new PromptStore();
const changes = new ChangeLog();

// Delegating roles get the in-process "team" MCP server (list/delegate/check).
// Every agent gets the "self" server (set_model) unless autoModel is disabled.
manager.sessionDecorator = (session) => {
  const mcpServers: typeof session.extraMcpServers = {};
  const allowedTools: string[] = [];
  if (session.config.autoModel !== false) {
    mcpServers.self = createSelfServer(session);
    allowedTools.push(...SELF_TOOL_RULES);
  }
  if (session.config.role !== 'worker') {
    mcpServers.team = createTeamServer(manager, tasks, session.config.id);
    allowedTools.push(...TEAM_TOOL_RULES);
  }
  // Görev bitişini ajan kendi bildirir; her rol görev alabildiği için istisnasız.
  mcpServers.task = createTaskServer(tasks, session.config.id);
  allowedTools.push(...TASK_TOOL_RULES);
  session.extraMcpServers = mcpServers;
  session.extraAllowedTools = allowedTools;
};

manager.init();
tasks.init();
prompts.init();
changes.init();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', createRoutes(manager, tasks, prompts, changes));

// Derlenmiş panel varsa aynı porttan servis edilir; `claude-manager` komutu
// böylece tek süreçle çalışır (vite dev sunucusu gerekmez).
const webDist = path.join(INSTALL_ROOT, 'web', 'dist');
if (fs.existsSync(path.join(webDist, 'index.html'))) {
  app.use(express.static(webDist));
  // SPA: /api ve /ws dışındaki her yol index.html'e düşer
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

const server = http.createServer(app);
const hub = new WsHub(server);

manager.on('agent_status', (agentId, status, activity) =>
  hub.broadcast({ type: 'agent_status', agentId, status, activity }),
);
manager.on('agent_event', (agentId, event) => {
  // Dosya yazan araç çağrılarını atfa kaydet: git "ne değişti"yi bilir ama
  // "kim değiştirdi"yi bilmez. Görev bağlamı kuyruktan okunur.
  const ev = event as { kind?: string; toolName?: string; input?: string };
  if (ev?.kind === 'tool_use') {
    changes.record(agentId, ev.toolName, ev.input, tasks.currentTaskFor(agentId));
  }
  hub.broadcast({ type: 'agent_event', agentId, event });
});
manager.on('permission_request', (request) => hub.broadcast({ type: 'permission_request', request }));
manager.on('permission_resolved', (agentId, requestId) =>
  hub.broadcast({ type: 'permission_resolved', agentId, requestId }),
);
manager.on('usage', (usage) =>
  hub.broadcast({ type: 'usage', usage, context: manager.contextSnapshot(), budget: manager.budget() }),
);
manager.on('agents_changed', () => hub.broadcast({ type: 'agents_changed' }));
manager.on('commands_changed', (agentId, commands) =>
  hub.broadcast({ type: 'commands_changed', agentId, commands })
);
tasks.on('task_update', (task) => hub.broadcast({ type: 'task_update', task }));

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n  Port ${PORT} kullanımda — muhtemelen kapanmamış bir claude-manager süreci var.\n` +
        `  Başka port için: claude-manager --port 4700\n`
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  Claude Manager  →  http://localhost:${PORT}`);
  console.log(`  Proje:  ${PROJECT_DIR}`);
  console.log(`  Ekip:   ${path.join(HOME_DIR, 'agents')}\n`);
});

async function shutdown() {
  console.log('Kapanıyor: ajan oturumları durduruluyor...');
  await manager.stopAll();
  // Döküm 300ms tamponlanarak yazılıyor; kapanışta tamponda kalanı kaybetme.
  manager.store.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
