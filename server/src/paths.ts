import { S } from './i18n.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { upgradeSeededAgent } from './agentUpgrade.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Kurulum kökü (paketin kendisi): server/src -> server -> paket kökü */
export const INSTALL_ROOT = path.resolve(here, '..', '..');

/**
 * Claudiva iki ayrı yer kullanır:
 *
 *  ~/.claudiva/agents/     Ajan ekibi ve skill'leri — GLOBAL, her projede aynı.
 *  <proje>/.claudiva/      Göreve/projeye özel veri: hafıza, görevler, token sayımı.
 *
 * Ajanların çalışma dizini (cwd) projenin kökü olur; yani dosyaları doğrudan
 * senin projende yönetirler.
 *
 * Yollar modül yüklenirken çözülür, bu yüzden `bin/claudiva.js` ortam
 * değişkenlerini sunucuyu import etmeden ÖNCE ayarlar.
 *
 * ESKİ AD: proje önce "claude-manager" adını taşıyordu; klasörler `.claude-manager`
 * idi. Mevcut kurulumlar açılışta bir kez yeni ada taşınır (`migrateLegacyDir`).
 * Taşıma YOL ÇÖZÜMÜNDEN ÖNCE yapılmak zorunda: aşağıdaki sabitler modül
 * yüklenirken hesaplanıyor ve taşıma başarısızsa eski klasörü göstermeleri gerekiyor.
 */
const LEGACY_NAME = '.claude-manager';
const DATA_NAME = '.claudiva';

/**
 * Eski klasörü yeni ada taşır ve KULLANILACAK yolu döndürür.
 * - Yeni varsa: yeni kazanır (eskiye dokunulmaz).
 * - Yalnız eski varsa: yeniden adlandırılır; Windows'ta klasör kilitliyse
 *   (açık bir eski sunucu, editör) eski yol kullanılmaya devam edilir — veri
 *   kaybetmektense eski adda çalışmak.
 */
function migrateLegacyDir(legacy: string, next: string): string {
  try {
    if (fs.existsSync(next) || !fs.existsSync(legacy)) return next;
    fs.renameSync(legacy, next);
    console.log(S.migrated(legacy, next));
    return next;
  } catch (err) {
    console.warn(
      S.migrateFailed(legacy, (err as Error).message)
    );
    return legacy;
  }
}

const explicitHome = process.env.CLAUDIVA_HOME ?? process.env.CLAUDE_MANAGER_HOME;
export const HOME_DIR = explicitHome
  ? path.resolve(explicitHome)
  : migrateLegacyDir(path.join(os.homedir(), LEGACY_NAME), path.join(os.homedir(), DATA_NAME));

/**
 * Ajanların üzerinde çalıştığı proje kökü.
 *
 * Öncelik: `claudiva` CLI'ının ayarladığı değişken > npm'in INIT_CWD'si
 * (npm script'leri cwd'yi workspace klasörüne çevirdiği için `npm run dev`de
 * proje kökünü bu verir) > içinde bulunulan dizin.
 */
export const PROJECT_DIR = path.resolve(
  process.env.CLAUDIVA_PROJECT ??
    process.env.CLAUDE_MANAGER_PROJECT ??
    process.env.INIT_CWD ??
    process.cwd()
);

/** Bu projeye ait verilerin tutulduğu klasör. */
export const PROJECT_DATA_DIR = migrateLegacyDir(
  path.join(PROJECT_DIR, LEGACY_NAME),
  path.join(PROJECT_DIR, DATA_NAME)
);

/** Ajan tanımları global; ekip her projede hazır gelir. */
export const AGENTS_DIR = path.join(HOME_DIR, 'agents');

/**
 * Claude Code'un KENDİ kullanıcı dizini (`~/.claude`) — bu paketin
 * `~/.claude-manager`'ı ile ilgisi YOKTUR ve ondan türetilemez:
 * `CLAUDE_MANAGER_HOME` başka bir yere ayarlandığında ikisi tamamen ayrışır.
 * Global skill'ler, kullanıcı ayarları ve eklentiler burada durur.
 */
export const CLAUDE_USER_DIR = path.join(os.homedir(), '.claude');

export const MEMORY_DIR = path.join(PROJECT_DATA_DIR, 'memory');
export const SHARED_MEMORY_DIR = path.join(MEMORY_DIR, 'shared');
export const PROMPTS_DIR = path.join(PROJECT_DATA_DIR, 'prompts');
export const DATA_DIR = path.join(PROJECT_DATA_DIR, 'data');

export function ensureDirs(): void {
  for (const d of [AGENTS_DIR, MEMORY_DIR, SHARED_MEMORY_DIR, PROMPTS_DIR, DATA_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
  seedAgents();
}

/**
 * İlk çalıştırmada pakete gömülü varsayılan ekibi ~/.claude-manager/agents
 * altına kopyalar. Var olan ajanlara dokunmaz, böylece kullanıcının kendi
 * düzenlemeleri güncellemede ezilmez.
 */
function seedAgents(): void {
  const bundled = path.join(INSTALL_ROOT, 'agents');
  if (!fs.existsSync(bundled) || path.resolve(bundled) === path.resolve(AGENTS_DIR)) return;

  for (const entry of fs.readdirSync(bundled, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(AGENTS_DIR, entry.name);
    const source = path.join(bundled, entry.name);
    if (fs.existsSync(target)) {
      // Var olan ajan: yalnız kullanıcının dokunmadığı alanlar ve yeni skill'ler.
      upgradeSeededAgent(source, target, copyDir);
      continue;
    }
    copyDir(source, target);
  }
}

/**
 * Elle yazılmış özyinelemeli kopyalama. fs.cpSync, Türkçe karakter içeren ev
 * dizinlerinde Windows'ta EIO veriyor; bu sürüm mkdir + copyFile kullanır.
 */
function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

export function agentDir(id: string): string {
  return path.join(AGENTS_DIR, id);
}

export function agentMemoryDir(id: string): string {
  return path.join(MEMORY_DIR, id);
}

/**
 * Tüm ajanlar projenin kökünde çalışır — amaç zaten senin projendeki dosyaları
 * yönetmeleri. (Eskiden her ajan repo içindeki workspaces/<id> kumbarasındaydı.)
 */
export function agentWorkspaceDir(_id: string): string {
  return PROJECT_DIR;
}
