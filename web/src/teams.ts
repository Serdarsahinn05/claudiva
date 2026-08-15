/**
 * Takımlar.
 *
 * Takımların AYRI BİR KAYIT DEFTERİ YOK — ajanlardan türetilirler. "Takım
 * oluştur / takım sil" diye bir işlem bilerek yok: bir ajanın takım alanına
 * yeni bir ad yazmak o takımı var eder, oradaki son ajanı da başka yere
 * taşımak yok eder. Böylece "üyesi olmayan takım" diye bir durum ortaya
 * çıkamaz ve iki yerde tutulan (defter + ajan alanı) bir gerçeğin ayrışma
 * ihtimali doğmaz.
 *
 * Takımı olmayan ajanlar kaybolmaz: `DEFAULT_TEAM` altında toplanırlar. Bu,
 * mevcut kurulumların (hiçbirinde takım alanı yok) panelde eskisi gibi
 * çalışmaya devam etmesini sağlar.
 */
import type { AgentSnapshot, Task } from './types';

/** "Tüm takımlar" sekmesinin değeri. Bir takım adı OLAMAZ (ajan adları
 *  serbest metin, ama bu değer iki alt çizgiyle çevrili). */
export const ALL_TEAMS = '__all__';

/** Takım alanı boş olan ajanların toplandığı ad. */
export const DEFAULT_TEAM = 'GENEL';

export interface TeamInfo {
  name: string;
  count: number;
  /** Şu an çevrimdışı olmayan üye sayısı — sekmedeki canlılık göstergesi. */
  active: number;
  /** Bu takımda onay bekleyen izin sayısı. */
  pending: number;
}

/** Bir ajanın takımı (boşsa DEFAULT_TEAM). */
export function teamOf(a: AgentSnapshot): string {
  return a.config.team?.trim() || DEFAULT_TEAM;
}

/**
 * Ajanlardan takım listesi. Sıra ajan sırasını izler (kullanıcının kendi
 * sürükleyerek kurduğu sıra), alfabetik DEĞİL: panelde ilk sırada duran ajan
 * hangi takımdaysa o takım da ilk sekmedir.
 */
export function teamsOf(agents: AgentSnapshot[]): TeamInfo[] {
  const map = new Map<string, TeamInfo>();
  for (const a of agents) {
    const name = teamOf(a);
    const info = map.get(name) ?? { name, count: 0, active: 0, pending: 0 };
    info.count++;
    if (a.status !== 'offline') info.active++;
    info.pending += a.pendingPermissions.length;
    map.set(name, info);
  }
  return [...map.values()];
}

/** Seçili takıma göre süzer; ALL_TEAMS ise hiçbir şey elenmez. */
export function agentsInTeam(agents: AgentSnapshot[], team: string): AgentSnapshot[] {
  if (team === ALL_TEAMS) return agents;
  return agents.filter((a) => teamOf(a) === team);
}

/**
 * Görevleri takıma göre süzer. Bir görev, ATANDIĞI ajan takımdaysa takımındır.
 * Görevi kimin verdiği (assignedBy) süzmeye girmez: patron başka takımdayken
 * bu takıma iş dağıtmış olabilir, o iş yine bu takımın işidir.
 */
export function tasksInTeam(tasks: Task[], teamAgents: AgentSnapshot[], team: string): Task[] {
  if (team === ALL_TEAMS) return tasks;
  const ids = new Set(teamAgents.map((a) => a.config.id));
  return tasks.filter((t) => ids.has(t.assignedTo));
}

/**
 * Ajan iş DAĞITABİLİR mi.
 *
 * Bu bir arayüz tercihi değil, sunucudaki gerçeğin yansıması: `worker` rolüne
 * `team` MCP sunucusu HİÇ verilmez (server/src/index.ts, sessionDecorator),
 * yani bir worker'a "ekibe dağıt" demek onu var olmayan bir araca yollamaktır.
 * Ajan bunu bir hata olarak değil, "bende böyle bir araç yok" diye bildirir —
 * yani sessizce yanlış iş yapılır. Kapıyı panelde tutuyoruz.
 */
export function canDelegate(a: AgentSnapshot): boolean {
  return a.config.role !== 'worker';
}

/**
 * Takımın lider ajanı — orkestratör çubuğunun işi kime vereceği.
 * Rol sırası: patron → yönetici → takım lideri → (yoksa) ilk ajan.
 *
 * Son adım bilerek bir worker'a düşebilir: yalnızca çalışanlardan kurulu bir
 * takıma da iş verilebilmeli. O durumda dağıtım olmaz, iş doğrudan o ajana
 * gider — `canDelegate` ile ayırt edilir ve çubuk bunu açıkça yazar.
 * `null` yalnızca takım tamamen boşsa döner.
 */
export function leadOf(teamAgents: AgentSnapshot[]): AgentSnapshot | null {
  const byRole = (role: string) => teamAgents.find((a) => a.config.role === role);
  return byRole('boss') ?? byRole('manager') ?? byRole('team-leader') ?? teamAgents[0] ?? null;
}
