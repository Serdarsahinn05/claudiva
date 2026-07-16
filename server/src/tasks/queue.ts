import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentManager } from '../agents/manager.js';
import type { Task } from '../types.js';
import { DATA_DIR } from '../paths.js';

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const MAX_RESULT_LEN = 20_000;

/**
 * Dispatches tasks to agent sessions and tracks their lifecycle.
 * Completion detection: messages to a session are processed in order, so each
 * `turn_complete` on an agent closes that agent's oldest running task.
 */
export class TaskQueue extends EventEmitter {
  private tasks = new Map<string, Task>();
  /** Per-agent FIFO of task ids awaiting a turn_complete. */
  private inFlight = new Map<string, string[]>();
  private waiters = new Map<string, { resolve: (t: Task) => void }>();
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
   * Dispatch a task to an agent. Returns the task immediately; use
   * `waitFor()` to await completion.
   */
  dispatch(input: { title: string; prompt: string; assignedTo: string; assignedBy: string }): Task {
    const session = this.manager.get(input.assignedTo);
    if (!session) throw new Error(`Ajan bulunamadı: ${input.assignedTo}`);
    this.wireAgent(input.assignedTo);

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
    const fifo = this.inFlight.get(input.assignedTo) ?? [];
    fifo.push(task.id);
    this.inFlight.set(input.assignedTo, fifo);

    session.send(
      `# Görev (id: ${task.id}) — atayan: ${input.assignedBy}\n` +
        `## ${input.title}\n\n${input.prompt}\n\n` +
        `Görevi tamamla ve sonucu net bir özetle bitir.`,
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
    session.on('turn_complete', (resultText: string, isError: boolean) => {
      const fifo = this.inFlight.get(agentId);
      const taskId = fifo?.shift();
      if (!taskId) return;
      const task = this.tasks.get(taskId);
      if (!task) return;
      task.status = isError ? 'failed' : 'done';
      task.result = resultText.slice(0, MAX_RESULT_LEN);
      task.finishedAt = Date.now();
      this.emit('task_update', task);
      this.persist();
      const waiter = this.waiters.get(taskId);
      if (waiter) {
        this.waiters.delete(taskId);
        waiter.resolve(task);
      }
    });
  }

  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.writeFileSync(TASKS_FILE, JSON.stringify(this.list(), null, 2), 'utf-8');
    }, 500);
  }
}
