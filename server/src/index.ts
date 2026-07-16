import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { ensureDirs } from './paths.js';
import { AgentManager } from './agents/manager.js';
import { TaskQueue } from './tasks/queue.js';
import { PromptStore } from './prompts/store.js';
import { createTeamServer, TEAM_TOOL_RULES } from './boss/tools.js';
import { createRoutes } from './api/routes.js';
import { WsHub } from './ws.js';

const PORT = Number(process.env.PORT ?? 4600);

ensureDirs();

const manager = new AgentManager();
const tasks = new TaskQueue(manager);
const prompts = new PromptStore();

// Delegating roles get the in-process "team" MCP server (list/delegate/check).
manager.sessionDecorator = (session) => {
  if (session.config.role !== 'worker') {
    session.extraMcpServers = { team: createTeamServer(manager, tasks, session.config.id) };
    session.extraAllowedTools = TEAM_TOOL_RULES;
  }
};

manager.init();
tasks.init();
prompts.init();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', createRoutes(manager, tasks, prompts));

const server = http.createServer(app);
const hub = new WsHub(server);

manager.on('agent_status', (agentId, status, activity) =>
  hub.broadcast({ type: 'agent_status', agentId, status, activity }),
);
manager.on('agent_event', (agentId, event) => hub.broadcast({ type: 'agent_event', agentId, event }));
manager.on('permission_request', (request) => hub.broadcast({ type: 'permission_request', request }));
manager.on('permission_resolved', (agentId, requestId) =>
  hub.broadcast({ type: 'permission_resolved', agentId, requestId }),
);
manager.on('usage', (usage) => hub.broadcast({ type: 'usage', usage }));
manager.on('agents_changed', () => hub.broadcast({ type: 'agents_changed' }));
tasks.on('task_update', (task) => hub.broadcast({ type: 'task_update', task }));

server.listen(PORT, () => {
  console.log(`claude-manager server: http://localhost:${PORT} (ws: /ws)`);
});

async function shutdown() {
  console.log('Kapanıyor: ajan oturumları durduruluyor...');
  await manager.stopAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
