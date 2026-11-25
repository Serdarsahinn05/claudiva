import { S } from './i18n.js';
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
import { BrowserSession } from './browser.js';
import { createBrowserServer } from './browserTools.js';
import { WsHub } from './ws.js';

const PORT = Number(process.env.PORT ?? 4600);

ensureDirs();

const manager = new AgentManager();
const tasks = new TaskQueue(manager);
const prompts = new PromptStore();
const changes = new ChangeLog();
/** Tek bir tarayıcı, kullanıcı ve ajanlar ORTAK kullanır — ajanın açtığı
 *  sayfayı kullanıcı panelde canlı görsün diye (bkz. browserTools.ts). */
const browser = new BrowserSession();

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
  /**
   * Tarayıcı da istisnasız her role verilir — ama BİLEREK `allowedTools`'a
   * EKLENMEZ.
   *
   * Ölçüldü: `allowedTools`'taki bir araç `canUseTool`'a HİÇ sorulmadan
   * çalışıyor. Diğer iç araçlar (self/team/task) için bu doğru — model
   * değiştirmek ya da görev delege etmek panelin kendi içinde kalır. Tarayıcı
   * ise dış dünyaya çıkıyor: listeye eklendiğinde oto-onayı KAPALI bir ajan
   * bile izinsiz sayfa açıyordu. Listeden çıkarınca çağrı normal izin kapısına
   * düşer ve panelde izin bandı görünür.
   */
  mcpServers.browser = createBrowserServer(browser);
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
app.use('/api', createRoutes(manager, tasks, prompts, changes, browser));

// Derlenmiş panel varsa aynı porttan servis edilir; `claudiva` komutu
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
  hub.broadcast({
    type: 'usage',
    usage,
    context: manager.contextSnapshot(),
    turns: manager.turnSnapshot(),
    budget: manager.budget(),
  }),
);
manager.on('agents_changed', () => hub.broadcast({ type: 'agents_changed' }));
manager.on('commands_changed', (agentId, commands) =>
  hub.broadcast({ type: 'commands_changed', agentId, commands })
);
tasks.on('task_update', (task) => hub.broadcast({ type: 'task_update', task }));
// Tarayıcıyı ajan da sürüyor; panel yoklamayla haber alamazdı (bkz. browser.ts).
browser.onChange = (state) => hub.broadcast({ type: 'browser_state', state });

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      S.portInUse(PORT)
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  Claudiva  →  http://localhost:${PORT}`);
  const pad = Math.max(S.bannerProject.length, S.bannerTeam.length) + 1;
  console.log(`  ${S.bannerProject.padEnd(pad)} ${PROJECT_DIR}`);
  console.log(`  ${S.bannerTeam.padEnd(pad)} ${path.join(HOME_DIR, 'agents')}\n`);
});

async function shutdown() {
  console.log(S.shuttingDown);
  await manager.stopAll();
  // Döküm 300ms, harcama geçmişi 500ms tamponlanarak yazılıyor; kapanışta
  // tamponda kalanı kaybetme.
  manager.store.flush();
  manager.history.flush();
  // Headless Chromium ayrı bir süreç; kapatılmazsa arkada asılı kalır.
  await browser.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
