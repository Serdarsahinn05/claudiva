import { Router, type Request, type Response } from 'express';
import type { AgentManager } from '../agents/manager.js';
import type { TaskQueue } from '../tasks/queue.js';
import type { PromptStore } from '../prompts/store.js';
import { MEMORY_DIR, PROJECT_DIR } from '../paths.js';
import { systemInfo } from './system.js';

function handle(fn: (req: Request, res: Response) => unknown | Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent) res.json(result ?? { ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  };
}

export function createRoutes(manager: AgentManager, tasks: TaskQueue, prompts: PromptStore): Router {
  const r = Router();

  // ------------------------------------------------------------- agents
  r.get('/agents', handle(() => manager.list()));

  r.post('/agents', handle((req) => manager.create(req.body)));

  /** Panel sırası — :id rotasından ÖNCE gelmeli, yoksa "order" id sanılır. */
  r.put('/agents/order', handle((req) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) throw new Error('ids dizisi gerekli.');
    return manager.reorder(ids.map(String));
  }));

  r.put('/agents/:id', handle((req) => manager.update(req.params.id, req.body)));

  r.delete('/agents/:id', handle((req) => manager.remove(req.params.id)));

  r.get('/agents/:id/transcript', handle((req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    return s.transcript;
  }));

  r.post('/agents/:id/start', handle((req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    s.start();
    return manager.snapshot(s);
  }));

  r.post('/agents/:id/stop', handle(async (req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    await s.stop();
    return manager.snapshot(s);
  }));

  r.post('/agents/:id/message', handle((req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new Error('Boş mesaj gönderilemez.');
    s.send(text);
  }));

  r.post('/agents/:id/interrupt', handle(async (req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    await s.interrupt();
  }));

  /**
   * Panelin istemci tarafı komut çıktısını döküme yazar (ajana gönderilmez).
   * Ajan kapalıyken de çalışır — döküm oturumdan bağımsız tutulur.
   */
  r.post('/agents/:id/local', handle((req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    const { kind, text } = req.body ?? {};
    const k = kind === 'user' || kind === 'error' ? kind : 'local';
    s.pushLocal(k, String(text ?? ''));
  }));

  /** Panelin "/clear" komutu: yalnızca görünen dökümü siler, ajanın bağlamı durur. */
  r.post('/agents/:id/clear', handle((req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    s.transcript.length = 0;
  }));

  r.post('/agents/:id/permission', handle((req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    const { requestId, allow, message } = req.body ?? {};
    if (!s.resolvePermission(String(requestId), Boolean(allow), message)) {
      throw new Error('İzin isteği bulunamadı (zaman aşımına uğramış olabilir).');
    }
  }));

  // -------------------------------------------------------------- tasks
  r.get('/tasks', handle(() => tasks.list()));

  r.post('/tasks', handle((req) => {
    const { title, prompt, assignedTo } = req.body ?? {};
    return tasks.dispatch({
      title: String(title ?? 'Görev'),
      prompt: String(prompt ?? ''),
      assignedTo: String(assignedTo ?? ''),
      assignedBy: 'user',
    });
  }));

  // -------------------------------------------------------------- usage
  r.get('/usage', handle(() => manager.usageSummary()));

  /**
   * Panelin "/usage" komutunun verisi: kendi token sayımımız + (varsa) hesabın
   * claude.ai plan kotası. Plan kotası deneysel bir SDK metodundan geldiği ve
   * açık oturum gerektirdiği için null olabilir; panel buna göre davranır.
   */
  r.get('/usage/detail', handle(async () => ({
    tracked: manager.usageSummary(),
    plan: await manager.planUsage(),
  })));

  // ------------------------------------------------------------ prompts
  r.get('/prompts', handle(() => prompts.list()));
  r.post('/prompts', handle((req) => prompts.create(req.body)));
  r.put('/prompts/:id', handle((req) => prompts.update(req.params.id, req.body)));
  r.delete('/prompts/:id', handle((req) => {
    prompts.remove(req.params.id);
  }));

  // --------------------------------------------------------------- misc
  r.get('/info', handle(() => ({ memoryDir: MEMORY_DIR, projectDir: PROJECT_DIR })));

  /** Köprü ekranının telemetrisi: host makine, proje ve Claude/SDK bilgileri. */
  r.get('/system', handle(() => systemInfo()));

  return r;
}
