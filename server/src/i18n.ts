/**
 * Sunucunun dili — İKİ ayrı kitle var, karıştırma:
 *
 * 1. **Ajana giden metin** (araç açıklamaları, görev çerçevesi, ret mesajları,
 *    model hatırlatması, sınıflandırıcı istemi) HER ZAMAN İngilizcedir ve bu
 *    modülden geçmez. Ajan zaten kullanıcının dilinde cevap veriyor (kişilik
 *    dosyaları), İngilizce daha az token tutuyor ve Türkçe çerçeve İngilizce
 *    kullanıcının alt ajanlarını Türkçe cevaba itiyordu (2026-11-25 ölçüldü).
 * 2. **Kullanıcıya görünen metin** (döküm notları, görev sonucu notları,
 *    hata mesajları, konsol çıktısı) buradan, `S` ile okunur.
 *
 * Dil: önce işletim sisteminin dili (`LANG`/`LC_ALL`/`Intl`), panel bağlanınca
 * kendi arayüz dilini `PUT /api/locale` ile bildirir. Bildirimden önce
 * yazılan notlar (açılıştaki resume notu gibi) işletim sistemi dilinde kalır;
 * not yazıldığı anın dilinde dökümde kalıcıdır.
 */
import type { AgentConfig } from './types.js';

export type Locale = 'tr' | 'en';

function detect(): Locale {
  const env = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '';
  let tag = env;
  if (!tag) {
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      tag = '';
    }
  }
  return tag.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let current: Locale = detect();

export function getLocale(): Locale {
  return current;
}

export function setLocale(next: unknown): Locale {
  if (next === 'tr' || next === 'en') current = next;
  return current;
}

const tr = {
  // oturum notları (döküm)
  sessionResumed: (model: string) => `Oturum sürdürülüyor (model: ${model})`,
  sessionStarted: (model: string) => `Oturum başlatıldı (model: ${model})`,
  taskStoppedByUser: 'Görev kullanıcı tarafından durduruldu.',
  modelSwitch: (from: string, to: string, reason?: string) => `Model geçişi: ${from} → ${to}${reason ? ` — ${reason}` : ''}`,
  modelSwitchFailed: 'Model değiştirilemedi (oturum akış durumunda değil).',
  resumeFallback: 'Önceki oturum yüklenemedi (kayıt eskimiş olabilir); sıfırdan başlatıldı.',
  reasonTurnEnded: 'tur bitti — temel modele dönüş',
  reasonRouter: (why: string) => `yönlendirici: ${why}`,
  sessionError: (msg: string) => `Oturum hatası: ${msg}`,
  // görev sonucu notları
  taskInterruptedByRestart: 'Sunucu yeniden başlatıldı; görev yarıda kaldı.',
  depMissing: 'Bağlı olduğu görev kayıtlarda yok.',
  chainStopped: (id: string) => `Önceki adım başarısız oldu (${id}); zincir durduruldu.`,
  agentNotFound: (id: string) => `Ajan bulunamadı: ${id}`,
  taskNotFound: (id?: string) => (id ? `Görev bulunamadı: ${id}` : 'Görev bulunamadı.'),
  chainNeedsStep: 'Zincir en az bir adım içermeli.',
  sessionClosedTask: 'Oturum kapandı; görev yarıda kaldı.',
  noResult: '(sonuç yok)',
  graceNote: '— Not: ajan görevi complete_task ile kapatmadı; sonuç son turun çıktısından alındı.',
  budgetExceeded: (spent: string, limit: string) => `Günlük bütçe sınırı aşıldı ($${spent} / $${limit}). Yeni iş kabul edilmiyor.`,
  budgetExceededTask: (spent: string, limit: string) =>
    `Günlük bütçe sınırı aşıldı ($${spent} / $${limit}). Sınırı Ayarlar'dan değiştirebilirsin.`,
  agentBudgetExceeded: (name: string, spent: string, limit: string) =>
    `"${name}" ajanının günlük sınırı aşıldı ($${spent} / $${limit}).`,
  // yönlendirici gerekçeleri (görev kartında görünür)
  whyBusy: 'oturum meşgul, model korundu',
  whyFallback: 'kural emin değil, sınıflandırıcı cevap vermedi: temel model',
  whyClassifier: 'sınıflandırıcı',
  whyWarm: (target: string, kept: string) => ` (sıcak oturum, ${target} yerine ${kept} korundu)`,
  whyLong: (n: number) => `uzun görev (${n} kelime)`,
  whyWide: 'geniş kapsam işareti',
  whyShortRead: 'kısa okuma/soru',
  whyDetailed: 'ayrıntılı değişiklik',
  // tarayıcı
  badUrl: 'Adres çözümlenemedi.',
  httpOnly: 'Yalnızca http ve https adresleri açılabilir.',
  noPlaywright: 'Playwright kurulu değil (npm i -w server playwright-core).',
  noChromium: (msg: string) =>
    `Chromium başlatılamadı — indirilmemiş olabilir: npx playwright-core install chromium. (${msg})`,
  // skill / dosya / git / prompt hataları
  skillNotFound: 'Skill bulunamadı.',
  skillStateUnreadable: 'Skill durumu okunamadı.',
  skillPathOutside: 'Skill yolu beklenen kökün dışında.',
  repoFormat: 'Depo "sahip/depo" biçiminde olmalı.',
  agentScopeNeeded: 'Ajan kapsamı için ajan seçilmeli.',
  badSkillPath: 'Geçersiz skill yolu.',
  noSkillMd: (dir: string) => `"${dir}" altında SKILL.md bulunamadı.`,
  targetOutside: 'Hedef yol kapsam kökünün dışına çıkıyor.',
  alreadyInstalled: (folder: string) => `"${folder}" zaten kurulu. Önce kaldır.`,
  downloadFailed: (p: string, status: number) => `İndirilemedi: ${p} (${status})`,
  skillMdAfterInstall: 'Kurulum sonrası SKILL.md okunamadı.',
  githubRateLimit: 'GitHub istek kotası doldu (kimlik doğrulamasız sınır saatte 60). Bir süre sonra yeniden dene.',
  treeTruncated: 'Depo ağacı çok büyük, liste eksik olabilir.',
  aitmplUnreachable: (msg: string) => `aitmpl kataloğu okunamadı (${msg}); son kayıtlı liste gösteriliyor.`,
  templateNotFound: 'Şablon katalogda yok; listeyi yenile.',
  badRepoLink: 'GitHub bağlantısı ya da "sahip/depo" bekleniyor.',
  skillsShUnreachable: (msg: string) => `skills.sh’e ulaşılamadı (${msg}).`,
  skillNotInRepo: (skill: string, repo: string) => `"${skill}" ${repo} içinde bulunamadı.`,
  noSkillsInRepo: (repo: string) => `${repo} içinde SKILL.md bulunamadı.`,
  pathOutside: 'Yol proje dizininin dışında.',
  notAFile: 'Bu bir dosya değil.',
  diffTruncated: '\n… (fark çok uzun, kırpıldı)',
  promptNotFound: 'Prompt bulunamadı.',
  unknownProvider: (p: string) => `Bilinmeyen sağlayıcı: ${p}`,
  // konsol
  badConfig: (file: string) => `Bozuk config atlandı: ${file}`,
  orderWriteFailed: (file: string) => `Sıra yazılamadı: ${file}`,
  upgradeConfigFailed: (id: string, msg: string) => `[claudiva] ${id} yapılandırması güncellenemedi: ${msg}`,
  upgradeSkillsFailed: (id: string, msg: string) => `[claudiva] ${id} skill'leri güncellenemedi: ${msg}`,
  upgradeContentFailed: (id: string, msg: string) => `[claudiva] ${id} dosya içerikleri güncellenemedi: ${msg}`,
  upgradeFileFailed: (file: string, msg: string) => `[claudiva] ${file} güncellenemedi: ${msg}`,
  skillRenamed: (id: string, from: string, to: string) => `[claudiva] ${id}: skill ${from} → ${to} olarak yeniden adlandırıldı`,
  skillRenameKept: (id: string, from: string, to: string) =>
    `[claudiva] ${id}: ${from} skill'i değiştirilmiş, olduğu gibi bırakıldı (paketteki yeni adı: ${to})`,
  migrated: (from: string, to: string) => `[claudiva] ${from} → ${to} taşındı.`,
  migrateFailed: (from: string, msg: string) => `[claudiva] ${from} taşınamadı (${msg}); eski klasör kullanılıyor.`,
  bannerProject: 'Proje:',
  bannerTeam: 'Ekip:',
  shuttingDown: 'Kapanıyor: ajan oturumları durduruluyor...',
  portInUse: (port: number) =>
    `\n  Port ${port} kullanımda — muhtemelen kapanmamış bir claudiva süreci var.\n` +
    `  Başka port için: claudiva --port 4700\n`,
  routeFailed: (id: string, msg: string) => `[claudiva] yönlendirme başarısız (${id}): ${msg}`,
};

type Dict = typeof tr;

const en: Dict = {
  sessionResumed: (model) => `Session resumed (model: ${model})`,
  sessionStarted: (model) => `Session started (model: ${model})`,
  taskStoppedByUser: 'Task stopped by the user.',
  modelSwitch: (from, to, reason) => `Model switch: ${from} → ${to}${reason ? ` — ${reason}` : ''}`,
  modelSwitchFailed: 'Could not change the model (the session is not streaming).',
  resumeFallback: 'Could not load the previous session (the record may be stale); started a fresh one.',
  reasonTurnEnded: 'turn ended — back to the base model',
  reasonRouter: (why) => `router: ${why}`,
  sessionError: (msg) => `Session error: ${msg}`,
  taskInterruptedByRestart: 'The server restarted; the task was left unfinished.',
  depMissing: 'The task it depends on is not in the records.',
  chainStopped: (id) => `The previous step failed (${id}); the chain was stopped.`,
  agentNotFound: (id) => `Agent not found: ${id}`,
  taskNotFound: (id) => (id ? `Task not found: ${id}` : 'Task not found.'),
  chainNeedsStep: 'A chain needs at least one step.',
  sessionClosedTask: 'The session closed; the task was left unfinished.',
  noResult: '(no result)',
  graceNote: '— Note: the agent did not close the task with complete_task; the result was taken from its last turn.',
  budgetExceeded: (spent, limit) => `Daily budget limit reached ($${spent} / $${limit}). No new work is accepted.`,
  budgetExceededTask: (spent, limit) => `Daily budget limit reached ($${spent} / $${limit}). You can change the limit in Settings.`,
  agentBudgetExceeded: (name, spent, limit) => `"${name}" reached its daily limit ($${spent} / $${limit}).`,
  whyBusy: 'session busy, model kept',
  whyFallback: 'rules unsure and the classifier did not answer: base model',
  whyClassifier: 'classifier',
  whyWarm: (target, kept) => ` (warm session, kept ${kept} instead of ${target})`,
  whyLong: (n) => `long task (${n} words)`,
  whyWide: 'broad-scope signal',
  whyShortRead: 'short read/question',
  whyDetailed: 'detailed change',
  badUrl: 'Could not parse the address.',
  httpOnly: 'Only http and https addresses can be opened.',
  noPlaywright: 'Playwright is not installed (npm i -w server playwright-core).',
  noChromium: (msg) => `Could not start Chromium — it may not be downloaded: npx playwright-core install chromium. (${msg})`,
  skillNotFound: 'Skill not found.',
  skillStateUnreadable: 'Could not read the skill state.',
  skillPathOutside: 'The skill path is outside the expected root.',
  repoFormat: 'The repository must look like "owner/repo".',
  agentScopeNeeded: 'Pick an agent for agent scope.',
  badSkillPath: 'Invalid skill path.',
  noSkillMd: (dir) => `No SKILL.md found under "${dir}".`,
  targetOutside: 'The target path leaves the scope root.',
  alreadyInstalled: (folder) => `"${folder}" is already installed. Remove it first.`,
  downloadFailed: (p, status) => `Could not download: ${p} (${status})`,
  skillMdAfterInstall: 'Could not read SKILL.md after installing.',
  githubRateLimit: 'GitHub request quota reached (60 per hour without authentication). Try again later.',
  treeTruncated: 'The repository tree is very large; the list may be incomplete.',
  aitmplUnreachable: (msg) => `Could not read the aitmpl catalog (${msg}); showing the last saved list.`,
  templateNotFound: 'Template not in the catalog; refresh the list.',
  badRepoLink: 'Expected a GitHub link or "owner/repo".',
  skillsShUnreachable: (msg) => `Could not reach skills.sh (${msg}).`,
  skillNotInRepo: (skill, repo) => `"${skill}" was not found in ${repo}.`,
  noSkillsInRepo: (repo) => `No SKILL.md found in ${repo}.`,
  pathOutside: 'The path is outside the project directory.',
  notAFile: 'This is not a file.',
  diffTruncated: '\n… (diff too long, truncated)',
  promptNotFound: 'Prompt not found.',
  unknownProvider: (p) => `Unknown provider: ${p}`,
  badConfig: (file) => `Skipped a broken config: ${file}`,
  orderWriteFailed: (file) => `Could not write the order: ${file}`,
  upgradeConfigFailed: (id, msg) => `[claudiva] could not update ${id}'s config: ${msg}`,
  upgradeSkillsFailed: (id, msg) => `[claudiva] could not update ${id}'s skills: ${msg}`,
  upgradeContentFailed: (id, msg) => `[claudiva] could not update ${id}'s files: ${msg}`,
  upgradeFileFailed: (file, msg) => `[claudiva] could not update ${file}: ${msg}`,
  skillRenamed: (id, from, to) => `[claudiva] ${id}: skill ${from} renamed to ${to}`,
  skillRenameKept: (id, from, to) => `[claudiva] ${id}: skill ${from} was edited, left as is (its new package name is ${to})`,
  migrated: (from, to) => `[claudiva] moved ${from} → ${to}.`,
  migrateFailed: (from, msg) => `[claudiva] could not move ${from} (${msg}); using the old folder.`,
  bannerProject: 'Project:',
  bannerTeam: 'Team:',
  shuttingDown: 'Shutting down: stopping agent sessions...',
  portInUse: (port) =>
    `\n  Port ${port} is in use — probably a claudiva process that did not shut down.\n` +
    `  For another port: claudiva --port 4700\n`,
  routeFailed: (id, msg) => `[claudiva] routing failed (${id}): ${msg}`,
};

const DICTS: Record<Locale, Dict> = { tr, en };

/** Kullanıcıya görünen metin; her erişimde o anki dili okur. */
export const S: Dict = new Proxy({} as Dict, {
  get: (_t, key: string) => DICTS[current][key as keyof Dict],
});

/**
 * Ajana gösterilecek ad/açıklama: paket ajanında İngilizce karşılık,
 * kullanıcı adı değiştirdiyse onun yazdığı (web/src/agentI18n.ts ile aynı kural).
 */
export function agentFacing(cfg: AgentConfig, key: 'name' | 'description'): string | undefined {
  const t = cfg.i18n;
  if (t && cfg[key] === t.tr?.[key] && t.en?.[key]) return t.en[key];
  return cfg[key];
}
