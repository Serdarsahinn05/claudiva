/**
 * Proje ayarları (`DATA_DIR/settings.json`).
 *
 * Şimdilik yalnızca bütçe sınırı tutuyor. Proje bazlı olması kasıtlı:
 * kullanım muhasebesi de (usage.json) proje bazlı, dolayısıyla sınır ile
 * harcama aynı kapsamda kalıyor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export interface Settings {
  /** Günlük toplam harcama tavanı (USD). 0/tanımsız = sınırsız. */
  dailyLimitUSD?: number;
  /** Bu yüzdeye ulaşınca panel uyarır (varsayılan %80). */
  warnAtPercent?: number;
}

const DEFAULTS: Settings = { warnAtPercent: 80 };

export class SettingsStore {
  private data: Settings = { ...DEFAULTS };

  init(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Settings;
      this.data = { ...DEFAULTS, ...parsed };
    } catch {
      this.data = { ...DEFAULTS }; // yok ya da bozuk
    }
  }

  get(): Settings {
    return { ...this.data };
  }

  update(patch: Settings): Settings {
    // Negatif ya da sayı olmayan değer sınırı anlamsız kılar; sessizce ele.
    const num = (v: unknown): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    if ('dailyLimitUSD' in patch) this.data.dailyLimitUSD = num(patch.dailyLimitUSD);
    if ('warnAtPercent' in patch) this.data.warnAtPercent = num(patch.warnAtPercent) ?? 80;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch {
      // yazılamazsa ayar bu oturumda geçerli kalır
    }
    return this.get();
  }
}
