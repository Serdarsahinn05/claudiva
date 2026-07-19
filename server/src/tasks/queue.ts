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
          // Anything left running from a previous process is stale.
          if (t.status === 'running' || t.status === 'pending') {
            t.status = 'failed';
            t.result = 'Sunucu yeniden başlatıldı; görev yarıda kaldı.';
          }
          this.tasks.set(t.id, t);
        }
      } catch {
        // start fresh
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
  dispatch(input: { title: string; prompt: string; assignedTo: string; assignedBy: string }): Task {
    const session = this.manager.get(input.assignedTo);
    if (!session) throw new Error(`Ajan bulunamadı: ${input.assignedTo}`);
    this.wireAgent(input.assignedTo);

    /**
     * Bütçe kapısı. send() de kontrol ediyor ama görev oradan sessizce
     * düşerdi: kayıt `running` kalır, hiç turn_complete gelmez ve görev
     * sonsuza kadar asılı görünürdü. Burada açıkça `failed` yazıyoruz.
     */
    const gate = this.manager.canWork(input.assignedTo);
    if (!gate.ok) {
      const blocked: Task = {
        id: randomUUID().slice(0, 8),
        title: input.title,
        prompt: input.prompt,
        assignedTo: input.assignedTo,
        assignedBy: input.assignedBy,
        status: 'failed',
        result: gate.reason,
        createdAt: Date.now(),
        finishedAt: Date.now(),
      };
      this.tasks.set(blocked.id, blocked);
      this.emit('task_update', blocked);
      this.persist();
      return blocked;
    }

    const task: Task = {
      id: randomUUID().slice(0, 8),
      title: input.title,
      prompt: input.prompt,
      assignedTo: input.assignedTo,
      assignedBy: input.assignedBy,
      status: 'running',
      createdAt: Date.now(),
      startedAt: Date.now(),
    };
    this.tasks.set(task.id, task);

    session.send(
      `# Görev (id: ${task.id}) — atayan: ${input.assignedBy}\n` +
        `## ${input.title}\n\n${input.prompt}\n\n` +
        `Görevi tamamla. Bitirdiğinde SON İŞ olarak mcp__task__complete_task aracını ` +
        `task_id="${task.id}" ve sonucu özetleyen bir summary ile çağır; görev ancak ` +
        `bu çağrıyla kapanır. Yapamadıysan aynı aracı failed=true ile çağır.`,
      task.id,
    );

    this.emit('task_update', task);
    this.persist();
    return task;
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
  }

  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.writeFileSync(TASKS_FILE, JSON.stringify(this.list(), null, 2), 'utf-8');
    }, 500);
  }
}
