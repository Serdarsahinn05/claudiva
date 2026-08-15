import { Router, type Request, type Response } from 'express';
import type { AgentManager } from '../agents/manager.js';
import type { InspectPart } from '../agents/backend.js';
import type { TaskQueue } from '../tasks/queue.js';
import type { PromptStore } from '../prompts/store.js';
import { MEMORY_DIR, PROJECT_DIR } from '../paths.js';
import { systemInfo } from './system.js';
import type { ChangeLog } from '../changes.js';
import { changedFiles, diffFile, headSha, isRepo, revertFile, safeResolve } from '../git.js';
import { listDir, readFile } from '../files.js';
import { readIcon } from '../fileIcons.js';
import { installFromGitHub, listSkills, removeSkill, setSkillEnabled, type SkillScope } from '../skills.js';
import {
  addSource,
  catalogView,
  installMany,
  listSources,
  refreshCatalog,
  removeSource,
} from '../skillCatalog.js';
import type { BrowserSession } from '../browser.js';
import { readMemoryGraph } from '../memory.js';

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

export function createRoutes(
  manager: AgentManager,
  tasks: TaskQueue,
  prompts: PromptStore,
  changes: ChangeLog,
  browser: BrowserSession,
): Router {
  const r = Router();

  // ------------------------------------------------------------- memory
  // Ajan hafıza haritası (Memory paneli): düğümler; kenarlar istemcide türetilir.
  r.get('/memory', handle(() => readMemoryGraph()));

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

  /**
   * Yerleşik slash komutlarının veri kaynağı (`/context`, `/model`, `/mcp`,
   * `/agents`, `/status`). `parts` virgüllü liste; verilmezse hepsi okunur.
   *
   * Parçalar ayrı ayrı en iyi çabayla okunur: biri okunamazsa `null` gelir,
   * istek yine 200 döner — `/status` gibi çok parçalı bir komut tek bir kırık
   * kontrol isteği yüzünden tümüyle başarısız olmasın diye.
   */
  r.get('/agents/:id/inspect', handle(async (req) => {
    const s = manager.get(req.params.id);
    if (!s) throw new Error('Ajan bulunamadı.');
    const all: InspectPart[] = ['context', 'models', 'agents', 'mcp', 'account'];
    const asked = String(req.query.parts ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter((p): p is InspectPart => (all as string[]).includes(p));
    return await s.inspect(asked.length ? asked : all);
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
    // Diskteki döküm de silinmezse yeniden başlatmada geri gelir.
    manager.store.clearTranscript(req.params.id);
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

  /** Zincir: adımlar sırayla çalışır, her adım bir öncekinin çıktısını alır. */
  r.post('/tasks/chain', handle((req) => {
    const raw = req.body?.steps;
    if (!Array.isArray(raw) || !raw.length) throw new Error('En az bir adım gerekli.');
    return tasks.createChain(
      raw.map((s: Record<string, unknown>, i: number) => ({
        title: String(s.title ?? `Adım ${i + 1}`),
        prompt: String(s.prompt ?? ''),
        assignedTo: String(s.assignedTo ?? ''),
        assignedBy: 'user',
        passResult: s.passResult !== false,
      })),
      'user',
    );
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

  /**
   * Tur tur harcama geçmişi — dashboard'un zaman eksenli grafikleri.
   * `since` kaydın başladığı an: ondan öncesi tur tur BÖLÜNEMEZ (eski toplamlar
   * zamansız sayaçlardı), panel bunu açıkça yazar.
   */
  r.get('/usage/history', handle(() => manager.history.list()));

  // ------------------------------------------------------------- bütçe
  /** Bugünkü harcama + sınır durumu; panel göstergesi ve Ayarlar bunu okur. */
  r.get('/budget', handle(() => ({ ...manager.budget(), settings: manager.settings.get() })));

  r.put('/settings', handle((req) => {
    manager.settings.update(req.body ?? {});
    return { ...manager.budget(), settings: manager.settings.get() };
  }));

  // ------------------------------------------------------------ changes
  /**
   * Çalışma ağacındaki değişiklikler + kim dokundu.
   *
   * git "ne değişti"yi, ChangeLog "kim değiştirdi"yi bilir; ikisi burada
   * birleşir. Git deposu değilse `isRepo:false` döner ve panel geri alma
   * düğmelerini kapatır — çökme yok.
   */
  r.get('/changes', handle(async () => {
    if (!(await isRepo())) return { isRepo: false, head: null, files: [] };
    const files = await changedFiles();
    return {
      isRepo: true,
      head: await headSha(),
      files: files.map((f) => ({ ...f, touches: changes.touchesFor(f.path) })),
    };
  }));

  r.get('/changes/diff', handle(async (req) => {
    const p = String(req.query.path ?? '');
    if (!p || !safeResolve(p)) throw new Error('Geçersiz yol.');
    return { path: p, diff: await diffFile(p) };
  }));

  /** Geri alma yıkıcıdır: commit'lenmemiş çalışmayı siler. Panel onay ister. */
  r.post('/changes/revert', handle(async (req) => {
    const p = String(req.body?.path ?? '');
    if (!p || !safeResolve(p)) throw new Error('Geçersiz yol.');
    if (!(await isRepo())) throw new Error('Bu klasör bir git deposu değil; geri alınamaz.');
    await revertFile(p);
    changes.forget(p);
    return { ok: true };
  }));

  // -------------------------------------------------------------- kod
  /**
   * Kod paneli: proje ağacı ve dosya içeriği (SALT OKUNUR).
   *
   * Ağaç TEMBEL — her istek tek bir dizini döndürür. Yazma ucu bilerek yok:
   * dosyayı değiştiren tek özne ajanın kendisi ve o zaten izin kapısından
   * geçiyor; panele ikinci bir yazma yolu açmak o kapıyı delerdi.
   */
  r.get('/files/tree', handle(async (req) => ({
    path: String(req.query.path ?? ''),
    entries: await listDir(String(req.query.path ?? '')),
  })));

  r.get('/files/read', handle(async (req) => {
    const p = String(req.query.path ?? '');
    if (!p) throw new Error('Yol gerekli.');
    const content = await readFile(p);
    // Kod panelinde "bu dosyaya kim dokundu" rozeti; git listesinden düşmüş
    // (commit'lenmiş) dosyalarda da atıf görünsün diye ayrıca eklenir.
    return { ...content, touches: changes.touchesFor(content.path) };
  }));

  /**
   * Dosya türü ikonu (Material Icon Theme, `node_modules`'tan okunur).
   *
   * `handle()` KULLANILMIYOR: o sarmalayıcı JSON döndürüyor, burada gövde
   * ham SVG. İkonlar tarayıcı paketine girmiyor, statik varlık gibi tek tek
   * çekiliyor (gerekçe: fileIcons.ts) — bu ucun ucuz olması bu yüzden önemli.
   *
   * `immutable` başlığı işin can damarı: ikon adı içeriğiyle birlikte
   * değişiyor (yeni ikon = yeni ad), dolayısıyla aynı ad hep aynı SVG.
   * Onsuz 60 satırlık bir ağaç her açılışta 60 istek atardı; başlıkla ikon
   * başına ÖMÜRDE BİR kez iniyor.
   */
  r.get('/file-icon/:name', (req, res) => {
    const raw = String(req.params.name ?? '');
    const svg = readIcon(raw.replace(/\.svg$/i, ''), req.query.light === '1');
    if (!svg) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(svg);
  });

  // ---------------------------------------------------------- raporlar
  /**
   * Sonuçlanmış görevler + KANITI. Ajanın rapor metni kendi anlatısı;
   * `files` ise ölçülmüş olan — o görev sırasında gerçekten yazılan dosyalar
   * (`ChangeLog.filesForTask`). İkisi yan yana durmadan rapor doğrulanamaz.
   */
  r.get('/reports', handle(() => {
    const all = tasks.list();

    /**
     * Kanıt ALT AĞAÇTAN toplanır, yalnız görevin kendisinden değil.
     *
     * Delegasyonda dosyayı üst görev değil torunu yazıyor: kullanıcı boss'a iş
     * verir, boss çalışana delege eder, dosya dokunuşu ALT görevin kimliğini
     * taşır. Yalnız `filesForTask(t.id)` bakılınca üst görevin raporu
     * "hiçbir dosyaya dokunulmadı" diyordu — ölçülmüş bir yanlış negatif.
     */
    const childrenOf = new Map<string, typeof all>();
    for (const t of all) {
      if (!t.parentTaskId) continue;
      const list = childrenOf.get(t.parentTaskId) ?? [];
      list.push(t);
      childrenOf.set(t.parentTaskId, list);
    }

    const collect = (id: string, seen = new Set<string>()): ReturnType<typeof changes.filesForTask> => {
      // Döngü koruması: parentTaskId veriden geliyor, kendine işaret eden
      // bozuk bir kayıt sunucuyu sonsuz özyinelemeye sokmamalı.
      if (seen.has(id)) return [];
      seen.add(id);
      const own = changes.filesForTask(id);
      for (const c of childrenOf.get(id) ?? []) own.push(...collect(c.id, seen));
      return own;
    };

    // Yalnız KÖK görevler listelenir; alt görevler kendi raporlarıyla değil,
    // ait oldukları işin altında görünür (aksi hâlde aynı iş iki kez okunur).
    return all
      .filter((t) => (t.status === 'done' || t.status === 'failed') && !t.parentTaskId)
      .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
      .map((t) => {
        const files = collect(t.id);
        // Aynı dosyaya birden çok dokunuş olabilir; en yenisi temsil eder.
        const uniq = new Map<string, (typeof files)[number]>();
        for (const f of files.sort((a, b) => b.ts - a.ts)) if (!uniq.has(f.path)) uniq.set(f.path, f);
        return {
          task: t,
          files: [...uniq.values()],
          subtasks: (childrenOf.get(t.id) ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            assignedTo: c.assignedTo,
            status: c.status,
            result: c.result,
          })),
        };
      });
  }));

  // ----------------------------------------------------------- browser
  /**
   * Panelin tarayıcı yüzeyi. Kullanıcı burada KENDİ sürüyor, o yüzden izin
   * sorulmuyor — ajan aynı tarayıcıyı MCP araçlarıyla sürdüğünde mevcut
   * `canUseTool` kapısı zaten devrede (bkz. browserTools.ts).
   */
  r.get('/browser/state', handle(() => browser.state()));

  r.post('/browser/navigate', handle((req) => browser.navigate(String(req.body?.url ?? ''))));

  r.post('/browser/act', handle(async (req) => {
    const { action, x, y, text: t, submit, dy } = req.body ?? {};
    switch (action) {
      case 'click':
        return await browser.click(Number(x) || 0, Number(y) || 0);
      case 'type':
        return await browser.type(String(t ?? ''), submit === true);
      case 'scroll':
        return await browser.scroll(Number(dy) || 0);
      case 'back':
        return await browser.back();
      case 'reload':
        return await browser.reload();
      default:
        throw new Error(`Bilinmeyen eylem: ${action}`);
    }
  }));

  /** PNG ikili olarak döner; base64'e sarmak %33 şişirirdi. */
  r.get('/browser/screenshot', handle(async (_req, res) => {
    const png = await browser.screenshot();
    res.type('png').set('Cache-Control', 'no-store').send(png);
  }));

  r.post('/browser/close', handle(async () => {
    await browser.close();
    return { ok: true };
  }));

  // ------------------------------------------------------------ skills
  r.get('/skills', handle(() => listSkills()));

  /** Etkin/pasif: `SKILL.md` ↔ `SKILL.md.disabled` (bkz. skills.ts). */
  r.post('/skills/toggle', handle((req) => {
    const { id, enabled } = req.body ?? {};
    if (!id) throw new Error('Skill kimliği gerekli.');
    return setSkillEnabled(String(id), Boolean(enabled));
  }));

  /** YIKICI: dizini tamamen siler. Panel onay modalı gösteriyor. */
  r.delete('/skills', handle((req) => {
    const id = String(req.query.id ?? '');
    if (!id) throw new Error('Skill kimliği gerekli.');
    removeSkill(id);
    return { ok: true };
  }));

  /**
   * GitHub'dan kurulum. Ağdan dosya indirip kullanıcının diskine yazar —
   * bu yüzden hedef kök `skills.ts` içindeki üç bilinen kapsamla sınırlı ve
   * arşiv değil TEK TEK dosyalar çekiliyor (bkz. installFromGitHub).
   */
  r.post('/skills/install', handle(async (req) => {
    const { repo, skillPath, scope, agentId } = req.body ?? {};
    if (!repo || !skillPath) throw new Error('repo ve skillPath gerekli.');
    return await installFromGitHub({
      repo: String(repo),
      skillPath: String(skillPath),
      scope: (scope === 'project' || scope === 'agent' ? scope : 'global') as SkillScope,
      agentId: agentId ? String(agentId) : undefined,
    });
  }));

  // ------------------------------------------------- skill katalogu (keşif)

  /** Önbellekten okur — ağa ÇIKMAZ. Panel her açılışta GitHub'ı yormasın. */
  r.get('/skills/catalog', handle(() => catalogView()));

  /** Ağa çıkan tek uç: bütün kaynakları yeniden tarar ve önbelleği yazar. */
  r.post('/skills/catalog/refresh', handle(async () => {
    await refreshCatalog();
    return catalogView();
  }));

  r.get('/skills/sources', handle(() => listSources()));

  r.post('/skills/sources', handle((req) => {
    const { repo, label } = req.body ?? {};
    if (!repo) throw new Error('Depo gerekli.');
    return addSource(String(repo), label ? String(label) : undefined);
  }));

  r.delete('/skills/sources', handle((req) => {
    const repo = String(req.query.repo ?? '');
    if (!repo) throw new Error('Depo gerekli.');
    return removeSource(repo);
  }));

  /**
   * Toplu kurulum. Kapsam BİR KEZ alınır ve hepsine uygulanır; her satırın
   * sonucu ayrı döner, bir hata diğerlerini iptal etmez (bkz. installMany).
   */
  r.post('/skills/install-many', handle(async (req) => {
    const { items, scope, agentId } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) throw new Error('Kurulacak skill seçilmedi.');

    const parsed = items.map((raw: unknown) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      if (!it.repo || !it.skillPath) throw new Error('Her satırda repo ve skillPath olmalı.');
      return {
        id: String(it.id ?? `${String(it.repo)}:${String(it.skillPath)}`),
        repo: String(it.repo),
        skillPath: String(it.skillPath),
        name: it.name ? String(it.name) : undefined,
      };
    });

    const target = (scope === 'project' || scope === 'agent' ? scope : 'global') as SkillScope;
    if (target === 'agent' && !agentId) throw new Error('Ajan kapsamı için ajan seçilmeli.');

    return await installMany(parsed, target, agentId ? String(agentId) : undefined);
  }));

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
