import { S } from '../i18n.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PromptTemplate } from '../types.js';
import { PROMPTS_DIR } from '../paths.js';

const FILE = path.join(PROMPTS_DIR, 'prompts.json');

export class PromptStore {
  private prompts: PromptTemplate[] = [];

  init(): void {
    if (fs.existsSync(FILE)) {
      try {
        this.prompts = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
        return;
      } catch {
        // bozuk dosya -> boş kütüphaneyle başla
      }
    }
    // Varsayılan prompt yok: eskiden buradaki üç şablon artık skill
    // (/durum-ozeti, /hafiza-yaz, /plan-yap) olarak geliyor.
    this.prompts = [];
  }

  list(): PromptTemplate[] {
    return this.prompts;
  }

  create(input: Omit<PromptTemplate, 'id'>): PromptTemplate {
    const prompt: PromptTemplate = { id: randomUUID().slice(0, 8), ...input };
    this.prompts.push(prompt);
    this.save();
    return prompt;
  }

  update(id: string, patch: Partial<Omit<PromptTemplate, 'id'>>): PromptTemplate {
    const p = this.prompts.find((x) => x.id === id);
    if (!p) throw new Error(S.promptNotFound);
    Object.assign(p, patch);
    this.save();
    return p;
  }

  remove(id: string): void {
    const idx = this.prompts.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error(S.promptNotFound);
    this.prompts.splice(idx, 1);
    this.save();
  }

  private save(): void {
    fs.writeFileSync(FILE, JSON.stringify(this.prompts, null, 2), 'utf-8');
  }
}
