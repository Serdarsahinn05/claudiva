import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PromptTemplate } from '../types.js';
import { PROMPTS_DIR } from '../paths.js';

const FILE = path.join(PROMPTS_DIR, 'prompts.json');

const DEFAULTS: PromptTemplate[] = [
  {
    id: 'ozet',
    title: 'Durum özeti',
    description: 'Ajandan mevcut işinin kısa durumunu ister',
    template: 'Şu anda üzerinde çalıştığın işin durumunu 3-5 maddede özetle: ne bitti, ne kaldı, engel var mı?',
    tags: ['genel'],
  },
  {
    id: 'hafiza-yaz',
    title: 'Hafızaya kaydet',
    description: 'Bu oturumda öğrenilenleri kalıcı hafızaya yazdırır',
    template: 'Bu konuşmada öğrendiğin kalıcı değerdeki bilgileri (kararlar, tercihler, proje bilgisi) hafıza klasörüne markdown dosyaları olarak kaydet. Var olan dosyaları güncelle, tekrar oluşturma.',
    tags: ['hafıza'],
  },
  {
    id: 'plan-yap',
    title: 'Plan yap (boss)',
    description: 'Boss için: işi analiz edip ekibe dağıtım planı yapar',
    template: 'Şu isteği analiz et, alt görevlere böl, her görevi ekipteki en uygun ajana delegate_task ile ata (bağımsız görevleri paralel dağıt) ve sonuçları toplayıp bana tek bir özet rapor sun:\n\n<istek buraya>',
    tags: ['boss'],
  },
];

export class PromptStore {
  private prompts: PromptTemplate[] = [];

  init(): void {
    if (fs.existsSync(FILE)) {
      try {
        this.prompts = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
        return;
      } catch {
        // fall through to defaults
      }
    }
    this.prompts = DEFAULTS;
    this.save();
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
    if (!p) throw new Error('Prompt bulunamadı.');
    Object.assign(p, patch);
    this.save();
    return p;
  }

  remove(id: string): void {
    const idx = this.prompts.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('Prompt bulunamadı.');
    this.prompts.splice(idx, 1);
    this.save();
  }

  private save(): void {
    fs.writeFileSync(FILE, JSON.stringify(this.prompts, null, 2), 'utf-8');
  }
}
