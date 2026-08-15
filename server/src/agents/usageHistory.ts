import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';
import type { TokenUsage } from '../types.js';

const HISTORY_FILE = path.join(DATA_DIR, 'usage-history.json');

/**
 * Kaç tur saklanır. 5000 tur ≈ birkaç haftalık yoğun kullanım ve dosya birkaç
 * yüz KB'de kalır. Aşınca en eskiler düşer — bu bir defter değil, bir pencere.
 */
const MAX_TURNS = 5000;

/** Bir turun kaydı. `usage.json`daki toplamların AKSİNE zaman damgalı. */
export interface UsageTurn {
  ts: number;
  agentId: string;
  /** Turun gerçekten çalıştığı model (otomatik geçişle temelden sapmış olabilir). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUSD: number;
  /** Tur bir göreve aitse görev kimliği. */
  taskId?: string;
}

/**
 * Tur tur harcama geçmişi.
 *
 * NEDEN AYRI BİR DOSYA: `usage.json` yalnızca üç şey biliyor — tümel toplam,
 * ajan başına toplam ve BUGÜNKÜ pencere. Üçü de zamansız birer sayaç; onlardan
 * "harcama zaman içinde nasıl gitti" sorusu TÜRETİLEMEZ. Panelin zaman ekseni
 * olan her grafiği (alan grafiği, model dağılımı, saatlik yoğunluk) bu dosyaya
 * dayanır.
 *
 * Kayıt bu sürümle BAŞLAR: eski toplamlar (usage.json) geriye dönük tur tur
 * bölünemez. Panel bunu gizlemez, "kayıt başlangıcı" olarak yazar — yoksa
 * dashboard'daki toplamla grafikteki toplam sessizce çelişirdi.
 */
export class UsageHistory {
  private turns: UsageTurn[] = [];
  private saveTimer: NodeJS.Timeout | null = null;
  /** Kaydın başladığı an; panel "buradan öncesi yok" diyebilsin diye. */
  private since = Date.now();

  init(): void {
    if (!fs.existsSync(HISTORY_FILE)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as {
        since?: number;
        turns?: UsageTurn[];
      };
      this.turns = Array.isArray(raw.turns) ? raw.turns : [];
      this.since = raw.since ?? this.turns[0]?.ts ?? Date.now();
    } catch {
      // bozuk dosya -> sıfırdan başla; geçmiş kaybı paneli çalışmaz yapmaz
    }
  }

  append(agentId: string, model: string, usage: TokenUsage, taskId?: string): void {
    this.turns.push({
      ts: Date.now(),
      agentId,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      costUSD: usage.costUSD,
      taskId,
    });
    if (this.turns.length > MAX_TURNS) this.turns.splice(0, this.turns.length - MAX_TURNS);
    this.persist();
  }

  list(): { since: number; turns: UsageTurn[] } {
    return { since: this.since, turns: this.turns };
  }

  /** Kapanışta tamponu boşalt (500ms gecikmeli yazım son turu kaybetmesin). */
  flush(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.write();
  }

  private persist(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.write();
    }, 500);
  }

  private write(): void {
    try {
      fs.writeFileSync(
        HISTORY_FILE,
        JSON.stringify({ since: this.since, turns: this.turns }),
        'utf-8',
      );
    } catch {
      // geçmiş yazılamazsa panel yalnızca zaman eksenini kaybeder
    }
  }
}
