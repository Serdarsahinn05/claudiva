import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentManager } from '../agents/manager.js';
import type { Task } from '../types.js';
import { DATA_DIR } from '../paths.js';

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const MAX_RESULT_LEN = 20_000;
/** Ajan bildirmeden sustuysa görevin yedekle kapatılacağı süre. */
const GRACE_MS = 90_000;

export interface TaskInput {
  title: string;
  prompt: string;
  assignedTo: string;
  assignedBy: string;
  /** Zincirde: önceki adımın sonucu prompt'a eklensin mi (varsayılan: evet). */
  passResult?: boolean;
  /**
   * Bu görev hangi görevin İÇİNDE doğdu (delegasyon zinciri).
   *
   * `assignedBy` "kim verdi"yi söylüyor ama HANGİ İŞ İÇİN sorusunu değil.
   * Kanıt bu ayrımda kayboluyordu: kullanıcı boss'a iş verir, boss onu
   * çalışana delege eder, dosyayı çalışan yazar — dosya dokunuşu ALT görevin
   * kimliğini taşır ve üst görevin raporu "hiçbir dosyaya dokunulmadı" der.
   * Ölçüldü (Faz 3): rapor "FAZ3-TEST.md oluşturuldu" diyordu, kanıt boştu.
   */
  parentTaskId?: string;
}

/**
 * Dispatches tasks to agent sessions and tracks their lifecycle.
 *
 * ## Tamamlanma nasıl anlaşılır
 *
 * **Birincil: ajanın kendi bildirimi** (`mcp__task__complete_task`). Turlardan
 * bağımsız olduğu için tek sağlam sinyal bu.
 *
 * Eskiden eşleştirme konumsaldı (ajan başına FIFO, her tur en eski görevi
 * kapatırdı) ve bir görev çalışırken ajana terminalden mesaj yazmak o sohbet
 * turunu görevin sonucu sanıp görevi yanlış metinle kapatıyordu. Jeton taşımak
 * bunu tek başına çözmüyor, çünkü ölçtüğümüz üzere gönderilen mesaj ile biten
 * tur 1:1 değil: tur sürerken gelen mesaj o turun içine emiliyor ve Monitor
 * gibi arka plan bildirimleri mesajsız yeni tur doğuruyor.
 *
 * **Yedek: sessizlik.** Ajan bildirmeyi unutursa görev sonsuza dek açık
 * kalmasın diye, son turdan `GRACE_MS` sonra hâlâ açık görevler o turun
 * metniyle kapatılır. Son turun metni kullanılır — ilk turunki değil — çünkü
 * iş gerçekten en son turda bitmiş olur.
 */
export class TaskQueue extends EventEmitter {
  private tasks = new Map<string, Task>();
  private waiters = new Map<string, { resolve: (t: Task) => void }>();
  /** Ajan başına yedek kapanış zamanlayıcısı. */
  private grace = new Map<string, NodeJS.Timeout>();
  /** Ajan başına son tur sonucu — yedek kapanışta sonuç metni olarak kullanılır. */
  private lastTurn = new Map<string, { text: string; isError: boolean }>();
  private saveTimer: NodeJS.Timeout | null = null;
  private wired = new Set<string>();

  constructor(private manager: AgentManager) {
    super();
  }

  init(): void {
    if (fs.existsSync(TASKS_FILE)) {
      try {
        const arr = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8')) as Task[];
        for (const t of arr) {
          // Süren tur süreçle birlikte öldü; kayıt bayat.
          if (t.status === 'running') {
            t.status = 'failed';
            t.result = 'Sunucu yeniden başlatıldı; görev yarıda kaldı.';
          }
          // `pending` KORUNUR. Eskiden bu da `failed` yapılıyordu; zincirler
          // bunun üstüne kurulsaydı sunucu her yeniden başladığında sessizce
          // ölürlerdi. Bağımlılıkları aşağıda çözülür.
          this.tasks.set(t.id, t);
        }
        this.resumeChains();
      } catch {
        // start fresh
      }
    }
  }

  /**
   * Açılışta bekleyen adımları bağımlılıklarına göre yerleştirir: bağımlılık
   * bittiyse adım fırlatılır, başarısızsa adım da başarısız olur, hâlâ
   * bekliyorsa dokunulmaz (o adım bittiğinde `finish()` devralır).
   */
  private resumeChains(): void {
    for (const task of this.tasks.values()) {
      if (task.status !== 'pending') continue;
      const dep = task.dependsOn ? this.tasks.get(task.dependsOn) : undefined;
      if (!task.dependsOn) this.launch(task);
      else if (!dep) this.finish(task.id, 'failed', 'Bağlı olduğu görev kayıtlarda yok.');
      else if (dep.status === 'done') this.launch(task);
      else if (dep.status === 'failed') {
        this.finish(task.id, 'failed', `Önceki adım başarısız oldu (${dep.id}); zincir durduruldu.`);
      }
    }
  }

  list(): Task[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Şu an bu ajanda işlenen turun görev kimliği (sohbet turunda undefined).
   * Dosya değişikliği atfı kullanır. Kaynak oturumun kendisi — kuyrukta ayrı
   * bir kopya tutmak iki durumun ayrışması demek olurdu.
   */
  currentTaskFor(agentId: string): string | undefined {
    return this.manager.get(agentId)?.currentTaskId;
  }

  /**
   * Dispatch a task to an agent. Returns the task immediately; use
   * `waitFor()` to await completion.
   */
  dispatch(input: TaskInput): Task {
    if (!this.manager.get(input.assignedTo)) {
      throw new Error(`Ajan bulunamadı: ${input.assignedTo}`);
    }
    const task = this.create(input);
    this.launch(task);
    return task;
  }

  /**
   * Zincir oluşturur: ilk adım hemen başlar, kalanlar bir öncekine bağlı
   * `pending` doğar. Adım bittiğinde `finish()` bir sonrakini fırlatır.
   */
  createChain(steps: TaskInput[], assignedBy: string): Task[] {
    if (!steps.length) throw new Error('Zincir en az bir adım içermeli.');
    for (const s of steps) {
      if (!this.manager.get(s.assignedTo)) throw new Error(`Ajan bulunamadı: ${s.assignedTo}`);
    }
    const chainId = randomUUID().slice(0, 8);
    const created: Task[] = [];
    let prev: Task | undefined;
    for (const [i, step] of steps.entries()) {
      const task = this.create({
        ...step,
        assignedBy: step.assignedBy || assignedBy,
        chainId,
        stepIndex: i,
        dependsOn: prev?.id,
        status: prev ? 'pending' : undefined,
      });
      created.push(task);
      prev = task;
    }
    this.launch(created[0]);
    return created;
  }

  /**
   * Var olan bir görevin ardına adım ekler (ajanların `delegate_task
   * after_task_id` yolu). Önceki görev zincirin parçası değilse burada bir
   * zincire dönüşür, böylece panel ikisini birlikte gösterir.
   */
  chainAfter(prevId: string, input: TaskInput): Task {
    const prev = this.tasks.get(prevId);
    if (!prev) throw new Error(`Görev bulunamadı: ${prevId}`);
    if (!this.manager.get(input.assignedTo)) throw new Error(`Ajan bulunamadı: ${input.assignedTo}`);

    if (!prev.chainId) {
      prev.chainId = randomUUID().slice(0, 8);
      prev.stepIndex = 0;
      this.emit('task_update', prev);
    }
    const step = this.create({
      ...input,
      chainId: prev.chainId,
      stepIndex: (prev.stepIndex ?? 0) + 1,
      dependsOn: prevId,
      status: 'pending',
    });

    // Bağlandığı görev çoktan bitmişse beklemenin anlamı yok.
    if (prev.status === 'done') this.launch(step);
    else if (prev.status === 'failed') {
      this.finish(step.id, 'failed', `Önceki adım başarısız oldu (${prevId}); zincir durduruldu.`);
    }
    this.persist();
    return step;
  }

  /** Kaydı oluşturur; `status` verilmezse `pending` doğar ve fırlatılmaz. */
  private create(input: TaskInput & { status?: 'pending'; chainId?: string; stepIndex?: number; dependsOn?: string }): Task {
    const task: Task = {
      id: randomUUID().slice(0, 8),
      title: input.title,
      prompt: input.prompt,
      assignedTo: input.assignedTo,
      assignedBy: input.assignedBy,
      status: 'pending',
      createdAt: Date.now(),
      ...(input.chainId ? { chainId: input.chainId, stepIndex: input.stepIndex } : {}),
      ...(input.dependsOn ? { dependsOn: input.dependsOn } : {}),
      ...(input.passResult === false ? { passResult: false } : {}),
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
    };
    this.tasks.set(task.id, task);
    this.emit('task_update', task);
    this.persist();
    return task;
  }

  /**
   * Bekleyen bir görevi ajana gönderir. Bütçe kapısı burada: `send()` de
   * kontrol ediyor ama görev oradan sessizce düşerdi — kayıt `running` kalır,
   * hiç sonuç gelmez ve görev sonsuza kadar asılı görünürdü.
   */
  private launch(task: Task): void {
    if (task.status !== 'pending') return;
    const session = this.manager.get(task.assignedTo);
    if (!session) {
      this.finish(task.id, 'failed', `Ajan bulunamadı: ${task.assignedTo}`);
      return;
    }
    this.wireAgent(task.assignedTo);

    const gate = this.manager.canWork(task.assignedTo);
    if (!gate.ok) {
      this.finish(task.id, 'failed', gate.reason);
      return;
    }

    task.status = 'running';
    task.startedAt = Date.now();

    // Zincirde önceki adımın çıktısı, aksi belirtilmedikçe prompt'un başına eklenir.
    const dep = task.dependsOn ? this.tasks.get(task.dependsOn) : undefined;
    const carried =
      dep && task.passResult !== false && dep.result
        ? `## Önceki adımın çıktısı — "${dep.title}" (${dep.assignedTo})\n\n${dep.result}\n\n---\n\n`
        : '';

    session.send(
      `# Görev (id: ${task.id}) — atayan: ${task.assignedBy}\n` +
        `## ${task.title}\n\n${carried}${task.prompt}\n\n` +
        `Görevi tamamla. Bitirdiğinde SON İŞ olarak mcp__task__complete_task aracını ` +
        `task_id="${task.id}" ve sonucu özetleyen bir summary ile çağır; görev ancak ` +
        `bu çağrıyla kapanır. Yapamadıysan aynı aracı failed=true ile çağır.`,
      task.id,
    );

    this.emit('task_update', task);
    this.persist();
  }

  /** Bu göreve bağlı bekleyen adımlar. */
  private dependentsOf(taskId: string): Task[] {
    return [...this.tasks.values()].filter((t) => t.dependsOn === taskId && t.status === 'pending');
  }

  waitFor(taskId: string, timeoutMs = 15 * 60 * 1000): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new Error('Görev bulunamadı.'));
    if (task.status === 'done' || task.status === 'failed') return Promise.resolve(task);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(taskId);
        resolve(this.tasks.get(taskId)!);
      }, timeoutMs);
      this.waiters.set(taskId, {
        resolve: (t) => {
          clearTimeout(timer);
          resolve(t);
        },
      });
    });
  }

  private wireAgent(agentId: string): void {
    if (this.wired.has(agentId)) return;
    const session = this.manager.get(agentId);
    if (!session) return;
    this.wired.add(agentId);
    session.on('turn_complete', (resultText: string, isError: boolean, taskId?: string) => {
      this.lastTurn.set(agentId, { text: resultText, isError });
      // Tur hatayla bittiyse ajan complete_task'ı çağıramaz — hemen kapat.
      // Jeton burada güvenilir: hata turu, göreve ait olan turun ta kendisidir.
      if (taskId && isError) this.finish(taskId, 'failed', resultText);
      this.armGrace(agentId);
    });
    // Oturum sonuçlanmamış bir görev turuyla kapandı; sonsuz `running` olmasın.
    session.on('turn_abandoned', (taskId: string) => {
      this.finish(taskId, 'failed', 'Oturum kapandı; görev yarıda kaldı.');
    });
  }

  /** Bu ajanda hâlâ açık olan görevler. */
  private openFor(agentId: string): Task[] {
    return [...this.tasks.values()].filter((t) => t.assignedTo === agentId && t.status === 'running');
  }

  /**
   * Yedek kapanışı kur/ertele. Her tur sonunda çağrılır: ajan konuşmaya devam
   * ettiği sürece sayaç sıfırlanır, ancak gerçekten sustuğunda çalışır.
   */
  private armGrace(agentId: string): void {
    clearTimeout(this.grace.get(agentId));
    this.grace.delete(agentId);
    if (!this.openFor(agentId).length) return;

    const timer = setTimeout(() => {
      this.grace.delete(agentId);
      const last = this.lastTurn.get(agentId);
      for (const task of this.openFor(agentId)) {
        this.finish(
          task.id,
          last?.isError ? 'failed' : 'done',
          `${last?.text ?? '(sonuç yok)'}\n\n— Not: ajan görevi complete_task ile kapatmadı; ` +
            `sonuç son turun çıktısından alındı.`,
        );
      }
    }, GRACE_MS);
    timer.unref?.(); // yedek zamanlayıcı süreci ayakta tutmasın
    this.grace.set(agentId, timer);
  }

  /** Ajanın kendi bildirimi (mcp__task__complete_task). Birincil kapanış yolu. */
  complete(taskId: string, status: 'done' | 'failed', summary: string): void {
    const task = this.tasks.get(taskId);
    this.finish(taskId, status, summary);
    // Bu ajanda başka açık görev kalmadıysa yedek zamanlayıcı boşuna beklemesin.
    if (task) this.armGrace(task.assignedTo);
  }

  private finish(taskId: string, status: 'done' | 'failed', resultText: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'done' || task.status === 'failed') return;
    task.status = status;
    task.result = resultText.slice(0, MAX_RESULT_LEN);
    task.finishedAt = Date.now();
    this.emit('task_update', task);
    this.persist();
    const waiter = this.waiters.get(taskId);
    if (waiter) {
      this.waiters.delete(taskId);
      waiter.resolve(task);
    }

    // Zinciri ilerlet. Başarısızlık aşağı doğru yayılır: bir adım yapılamadıysa
    // sonraki adım eksik girdiyle çalışıp yanıltıcı bir sonuç üretmesin.
    for (const next of this.dependentsOf(taskId)) {
      if (status === 'done') this.launch(next);
      else this.finish(next.id, 'failed', `Önceki adım başarısız oldu (${taskId}); zincir durduruldu.`);
    }
  }

  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.writeFileSync(TASKS_FILE, JSON.stringify(this.list(), null, 2), 'utf-8');
    }, 500);
  }
}
