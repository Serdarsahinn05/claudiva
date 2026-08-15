/**
 * Çalışma alanı yerleşimi.
 *
 * Panel artık SEKME DEĞİL. Eski kabukta aynı anda tek bölüm görünüyordu ve
 * terminale bakmak görevleri kaybetmek demekti; ürün ilkesi bunun tersini
 * söylüyor ("hepsi tek yerde", PRODUCT.md). Bu yüzden ekran üç yuvaya
 * (dock) bölünür ve her yuva kendi panelini AYNI ANDA gösterir.
 *
 *   sol  — bağlam yuvası (Ofis, Ajanlar, Promptlar…)
 *   orta — çalışma yuvası: terminaller ve kod, DÖŞELİ (birden fazla ajan yan yana)
 *   sağ  — izleme yuvası (Görevler, Hafıza, Değişiklikler…)
 *
 * İki farklı yerleşim mantığı var, çünkü iki farklı ihtiyaç var:
 *
 *   · Yan yuvalar SEKMELİDİR. Orada aynı anda bir panel okunur; ikisini birden
 *     göstermek 260px'lik bir sütunu ikiye bölüp ikisini de okunmaz yapardı.
 *   · Orta yuva DÖŞELİDİR. Asıl istenen buydu: birden fazla ajanın terminali
 *     aynı anda görünsün. Döşeme ızgarası kare köke göre büyür (1→1x1, 2→2x1,
 *     3-4→2x2, 5-6→3x2…), yani dördüncü terminali açmak diğerlerini
 *     kapatmaz, hepsini biraz küçültür.
 *
 * Panel hangi yuvada duracağını kendi bilmez; yerleşim burada, tek yerde
 * tutulur ve localStorage'a yazılır. Kullanıcı bir paneli yuvadan yuvaya
 * taşıyabildiği için "Ofis her zaman soldadır" gibi bir varsayım koda
 * gömülmemeli.
 */

export type PanelId =
  | 'survey'
  | 'office'
  | 'agents'
  | 'usage'
  | 'tasks'
  | 'code'
  | 'reports'
  | 'skills'
  | 'browser'
  | 'changes'
  | 'memory'
  | 'prompts';

export type DockId = 'left' | 'center' | 'right';

export interface PanelDef {
  id: PanelId;
  title: string;
  /** Panel başlığının altındaki tek satırlık tarif. */
  hint: string;
}

export const PANELS: Record<PanelId, PanelDef> = {
  survey: { id: 'survey', title: 'Genel Durum', hint: 'projenin şu anki aşaması' },
  office: { id: 'office', title: 'Ofis', hint: 'ajanların canlı yerleşimi' },
  agents: { id: 'agents', title: 'Ajanlar', hint: 'ekip dizini' },
  usage: { id: 'usage', title: 'Harcama', hint: 'token ve maliyet dökümü' },
  tasks: { id: 'tasks', title: 'Görevler', hint: 'dağıtım ve zincirler' },
  code: { id: 'code', title: 'Kod', hint: 'proje ağacı ve dosya içeriği' },
  reports: { id: 'reports', title: 'Raporlar', hint: 'ajan sonuçları ve kanıtı' },
  skills: { id: 'skills', title: 'Skill’ler', hint: 'kur, kaldır, aç/kapat' },
  browser: { id: 'browser', title: 'Browser', hint: 'ajanların da sürdüğü tarayıcı' },
  changes: { id: 'changes', title: 'Değişiklikler', hint: 'dosya farkları' },
  memory: { id: 'memory', title: 'Hafıza', hint: 'ajan hafıza haritası' },
  prompts: { id: 'prompts', title: 'Promptlar', hint: 'kayıtlı şablonlar' },
};

export const PANEL_IDS = Object.keys(PANELS) as PanelId[];

/**
 * Orta yuvanın bir gözü. Terminal bir "panel" değildir çünkü tekil değildir:
 * her açık ajan kendi gözünü alır. Bu yüzden döşeme birimi PanelId değil Tile.
 */
export type Tile =
  | { kind: 'terminal'; agentId: string }
  | { kind: 'panel'; id: PanelId };

export function tileKey(t: Tile): string {
  return t.kind === 'terminal' ? `t:${t.agentId}` : `p:${t.id}`;
}

export interface DockState {
  panels: PanelId[];
  /** Görünen panel. Liste boşsa null. */
  active: PanelId | null;
  /** Yuva daraltılmış mı (panelleri korur, yalnızca gizler). */
  open: boolean;
  /** Piksel genişlik; sürüklenerek değişir. */
  width: number;
}

export interface Layout {
  left: DockState;
  right: DockState;
  center: {
    tiles: Tile[];
    /** Tek gözü tam ekran yapar (tileKey). Diğerleri kapanmaz, gizlenir. */
    maximized: string | null;
  };
}

const DOCK_MIN = 220;
const DOCK_MAX = 640;

export const DEFAULT_LAYOUT: Layout = {
  left: { panels: ['office', 'agents', 'prompts'], active: 'office', open: true, width: 300 },
  right: { panels: ['tasks', 'memory', 'changes'], active: 'tasks', open: true, width: 340 },
  center: { tiles: [{ kind: 'panel', id: 'survey' }], maximized: null },
};

const STORAGE_KEY = 'claude-manager.layout.v1';

/**
 * Kayıtlı yerleşimi okur. Doğrulama gevşek DEĞİL: sürüm atlandığında ya da
 * dosya elle bozulduğunda panel açılmamazlık edemez, bu yüzden şekli
 * tutmayan her şey varsayılana düşer. Tek tek alan onarmak yerine bütünü
 * reddetmek bilinçli — yarı geçerli bir yerleşim (var olmayan panel id'si
 * taşıyan bir yuva) sessizce boş bir kutu olarak görünürdü.
 */
export function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_LAYOUT);
    const l = JSON.parse(raw) as Layout;
    if (!l?.left?.panels || !l?.right?.panels || !l?.center?.tiles) {
      return structuredClone(DEFAULT_LAYOUT);
    }
    const clean = (d: DockState): DockState => {
      const panels = d.panels.filter((p) => p in PANELS);
      return {
        panels,
        active: panels.includes(d.active as PanelId) ? d.active : panels[0] ?? null,
        open: d.open !== false,
        width: clampWidth(d.width),
      };
    };
    return {
      left: clean(l.left),
      right: clean(l.right),
      center: {
        tiles: l.center.tiles.filter(
          (t) => t && (t.kind === 'terminal' ? !!t.agentId : t.id in PANELS),
        ),
        maximized: l.center.maximized ?? null,
      },
    };
  } catch {
    // localStorage kapalı ya da içerik bozuk — yerleşim kaybı önemli değil.
    return structuredClone(DEFAULT_LAYOUT);
  }
}

export function saveLayout(l: Layout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
  } catch {
    /* yukarıdaki gerekçe */
  }
}

export function clampWidth(w: number): number {
  return Math.max(DOCK_MIN, Math.min(DOCK_MAX, Math.round(w) || DOCK_MIN));
}

/** Bir panelin şu an hangi yuvada olduğunu bulur (hiçbirinde değilse null). */
export function dockOf(l: Layout, id: PanelId): DockId | null {
  if (l.left.panels.includes(id)) return 'left';
  if (l.right.panels.includes(id)) return 'right';
  if (l.center.tiles.some((t) => t.kind === 'panel' && t.id === id)) return 'center';
  return null;
}

/**
 * Döşeme ızgarasının sütun sayısı. Kare köke yuvarlanır: göz sayısı arttıkça
 * ızgara kare kalır (2→2x1, 4→2x2, 6→3x2, 9→3x3). Satır sayısı CSS'te
 * otomatik akar, burada yalnızca sütun bildirilir.
 */
export function gridCols(n: number): number {
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 6) return Math.ceil(n / 2);
  return Math.ceil(Math.sqrt(n));
}

/* ═══════════════════════════════════════════════ sürükle-bırak sözleşmesi
 *
 * İKİ AYRI MIME tipi var ve bu bilerek böyle: HTML5 sürüklemesinde
 * `dataTransfer.getData()` `dragover` sırasında OKUNAMAZ (yalnızca `drop`
 * anında). Bırakma hedefinin "bunu kabul ediyor muyum" kararını sürükleme
 * sürerken vermesi gerekiyor ve o an elde yalnızca `types` listesi var.
 * Tek bir MIME kullanıp yükün içine tür yazsaydık, yan yuva bir terminali
 * kabul edip edemeyeceğini ancak bırakıldıktan sonra anlardı — yani imleç
 * "bırakabilirsin" derdi, bırakınca hiçbir şey olmazdı.
 */

/** Panel sürükleniyor: üç yuvanın hepsine bırakılabilir. */
export const DND_PANEL = 'application/x-cm-panel';

/**
 * Terminal gözü sürükleniyor: YALNIZCA çalışma alanında sıralanabilir.
 * Yan yuvaya bırakılamaz — 300px'lik bir sütunda döküm okunmuyor; oraya
 * bırakılabilmesi, işe yaramayan bir yerleşimi mümkün kılmak olurdu.
 */
export const DND_TERMINAL = 'application/x-cm-terminal';

/** Diziye ekleme: `index` verilmezse sona. Kaynak dizi değişmez. */
export function insertAt<T>(list: T[], item: T, index?: number): T[] {
  const next = [...list];
  next.splice(index ?? next.length, 0, item);
  return next;
}

/**
 * Bir öğeyi dizide yeni konuma taşır.
 *
 * Hedef indeks, öğe HENÜZ ÇIKARILMAMIŞKEN sayılan indekstir (kullanıcının
 * ekranda gördüğü boşluk). Çıkarma işlemi soldaki bir konumu kaydırdığı için
 * hedef, kaynağın sağındaysa bir azaltılır — bu düzeltme olmadan bir öğeyi
 * bir adım sağa taşımak hiçbir şey yapmaz (kendi eski yerine geri düşer).
 */
export function moveWithin<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to > from ? to - 1 : to, 0, item);
  return next;
}
