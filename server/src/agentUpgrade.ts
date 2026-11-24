/**
 * Var olan kurulumlardaki paket ajanlarını GÜNCELLER, kullanıcının elini
 * değdirdiği hiçbir şeye dokunmadan.
 *
 * Neden ayrı: `seedAgents()` yalnız ilk çalıştırmada kopyalar; sonradan pakete
 * eklenen bir skill (ör. find-skills) ya da düzeltilen bir rol adı mevcut
 * kullanıcıya hiç ulaşmıyordu.
 *
 * Üç kural:
 *  1. **Ad/açıklama** yalnız değer ESKİ paket değerine BİREBİR eşitse yenilenir.
 *     Eşit değilse kullanıcı düzenlemiştir, dokunulmaz.
 *  2. **Skill'ler** `<ajan>/.seeded-skills` manifestiyle izlenir. Pakette olup
 *     manifestte olmayan skill YENİDİR ve kopyalanır. Manifestte olup diskte
 *     olmayan skill kullanıcı tarafından SİLİNMİŞTİR, geri getirilmez.
 *     Manifest yoksa başlangıç değeri, 0.1.x paketinde olan skill listesidir
 *     (LEGACY tablosu). Bu olmasa kullanıcının sildiği eski bir skill "yeni"
 *     sanılıp geri gelirdi.
 *  3. **İçerik** (`personality.md`, `.claude-plugin/plugin.json`, her
 *     `skills/<s>/SKILL.md` ya da pasif hâli `SKILL.md.disabled`) yalnız diskteki
 *     dosyanın özeti ESKİ bir paket sürümüne eşitse (`LEGACY_CONTENT`) paketteki
 *     sürümle değiştirilir; pasif skill adını korur. Bilinmeyen özet = kullanıcı
 *     düzenlemiştir, dokunulmaz. Yalnız VAR OLAN dosya yazılır; silinen geri gelmez.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_CONTENT } from './agentLegacyContent.js';

interface Legacy {
  /** 0.1.x paketindeki ad ve açıklama: yalnız bunlara eşitse yenilenir. */
  names: string[];
  descriptions: string[];
  /** 0.1.x paketiyle tohumlanmış skill dizinleri. */
  skills: string[];
}

/** `git show v0.1.1:agents/<id>/config.json` değerleri. Elle değiştirme. */
const LEGACY: Record<string, Legacy> = {
  "boss": {
    names: ["Boss"],
    descriptions: [
      "Üst akıl: kullanıcının isteğini analiz eder, büyük parçalara böler, Tech Lead'e veya doğrudan uzmanlara delege eder, sonuçları sentezleyip tek rapor sunar. Kod yazmaz.",
    ],
    skills: ["durum-ozeti","gorev-bolme","hafiza-yaz","ikinci-gorus","is-baslat","ozellik-yeni"],
  },
  "tech-lead": {
    names: ["Tech Lead"],
    descriptions: [
      "Teknik yönetici: Boss'tan veya kullanıcıdan gelen çok parçalı teknik işleri uzmanlara dağıtır, ara çıktıları kalite kontrolünden geçirir, birleştirip teslim eder. Gerekirse küçük düzeltmeleri kendisi yapar.",
    ],
    skills: ["durum-ozeti","hafiza-yaz","ikinci-gorus","kalite-kontrol","plan-yap"],
  },
  "senior-dev": {
    names: ["Senior Developer"],
    descriptions: [
      "Kıdemli yazılımcı: TypeScript/Node/React başta olmak üzere kod yazma, refactor, hata ayıklama ve mimari kararlar. Temiz, test edilebilir kod üretir; değişikliği derleyip doğrulamadan teslim etmez.",
    ],
    skills: ["durum-ozeti","hafiza-yaz","hata-avi","hata-ayiklama","ikinci-gorus","refactor","temiz-kod"],
  },
  "frontend-dev": {
    names: ["Frontend Developer"],
    descriptions: [
      "Arayüz uzmanı: React/TypeScript bileşenleri, CSS, erişilebilirlik ve etkileşim tasarımı. Estetik ama abartısız, tutarlı ve responsive arayüzler kurar; mevcut tasarım diline uyum sağlar.",
    ],
    skills: ["arayuz-ilkeleri","durum-ozeti","hafiza-yaz","ikinci-gorus","ui-bilesen"],
  },
  "reviewer": {
    names: ["Code Reviewer"],
    descriptions: [
      "Kod incelemecisi: verilen diff/dosyaları doğruluk, güvenlik ve bakım açısından inceler; bulguları önem sırasına göre, kanıtlı ve eyleme dönük raporlar. Kod yazmaz, sadece inceler.",
    ],
    skills: ["durum-ozeti","hafiza-yaz","ikinci-gorus","inceleme-yap","kod-inceleme"],
  },
  "tester": {
    names: ["Tester"],
    descriptions: [
      "Test uzmanı: birim/entegrasyon testleri yazar, mevcut testleri çalıştırır, hataları yeniden üretip net raporlar. Kırılgan test yazmaz; davranışı test eder, implementasyonu değil.",
    ],
    skills: ["durum-ozeti","hafiza-yaz","ikinci-gorus","test-stratejisi","test-yaz"],
  },
  "researcher": {
    names: ["Researcher"],
    descriptions: [
      "Araştırmacı: web araştırması, dokümantasyon/kütüphane keşfi, karşılaştırma ve özet. Her iddiaya kaynak gösterir; bulamadığını 'bulamadım' diye raporlar, uydurmaz.",
    ],
    skills: ["arastir","arastirma-yontemi","durum-ozeti","hafiza-yaz","ikinci-gorus"],
  },
  "docs": {
    names: ["Docs Writer"],
    descriptions: [
      "Dokümantasyoncu: README, kullanım kılavuzu, API dokümanı, sürüm notu ve commit/PR metni yazar. Kodu okuyup doğrular; koddan doğrulayamadığı hiçbir davranışı dokümana yazmaz.",
    ],
    skills: ["commit-pr","dokuman-guncelle","dokuman-stili","durum-ozeti","hafiza-yaz","ikinci-gorus"],
  },
};

const MANIFEST = '.seeded-skills';

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Pakete gömülü ajanın diskteki kopyasını günceller. Hata fırlatmaz. */
export function upgradeSeededAgent(
  bundledDir: string,
  targetDir: string,
  copyDir: (src: string, dest: string) => void
): void {
  const id = path.basename(bundledDir);
  const legacy = LEGACY[id];
  try {
    upgradeConfig(bundledDir, targetDir, legacy);
  } catch (err) {
    console.warn(`[claudiva] ${id} yapılandırması güncellenemedi: ${(err as Error).message}`);
  }
  try {
    upgradeSkills(bundledDir, targetDir, legacy, copyDir);
  } catch (err) {
    console.warn(`[claudiva] ${id} skill'leri güncellenemedi: ${(err as Error).message}`);
  }
  try {
    upgradeContent(bundledDir, targetDir, id);
  } catch (err) {
    console.warn(`[claudiva] ${id} dosya içerikleri güncellenemedi: ${(err as Error).message}`);
  }
}

function upgradeConfig(bundledDir: string, targetDir: string, legacy: Legacy | undefined): void {
  if (!legacy) return;
  const file = path.join(targetDir, 'config.json');
  const current = readJson<Record<string, unknown>>(file);
  const bundled = readJson<Record<string, unknown>>(path.join(bundledDir, 'config.json'));
  if (!current || !bundled) return;

  let changed = false;
  for (const key of ['name', 'description'] as const) {
    const known = key === 'name' ? legacy.names : legacy.descriptions;
    const value = current[key];
    if (typeof value === 'string' && known.includes(value) && value !== bundled[key]) {
      current[key] = bundled[key];
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n', 'utf8');
}

function upgradeSkills(
  bundledDir: string,
  targetDir: string,
  legacy: Legacy | undefined,
  copyDir: (src: string, dest: string) => void
): void {
  const bundledSkills = path.join(bundledDir, 'skills');
  if (!fs.existsSync(bundledSkills)) return;

  const manifestFile = path.join(targetDir, MANIFEST);
  const seeded = new Set(readJson<string[]>(manifestFile) ?? legacy?.skills ?? []);
  let changed = !fs.existsSync(manifestFile);

  for (const entry of fs.readdirSync(bundledSkills, { withFileTypes: true })) {
    if (!entry.isDirectory() || seeded.has(entry.name)) continue;
    const dest = path.join(targetDir, 'skills', entry.name);
    if (!fs.existsSync(dest)) copyDir(path.join(bundledSkills, entry.name), dest);
    seeded.add(entry.name);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(manifestFile, JSON.stringify([...seeded].sort(), null, 2) + '\n', 'utf8');
  }
}

/**
 * İçerik özeti: CRLF → LF ve sondaki boşluk kırpılır, sha256'nın ilk 16 hex
 * karakteri. Kırpma şart: eski bir kurulumun plugin.json'ları paketteki eski
 * sürümle birebir aynı içerikteydi ama sondaki satır sonu eksikti; tek bir
 * `\n` yüzünden hiç güncellenmedi (ölçüldü). Üretici betik
 * (server/scripts/legacy-hashes.mjs) AYNI kuralı kullanır.
 */
function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n').trimEnd()).digest('hex').slice(0, 16);
}

/**
 * Kural 3: dokunulmamış eski içerikleri paketteki sürümle değiştirir.
 * Dosya başına ayrı try: biri okunamazsa diğerleri yine güncellenir.
 */
/**
 * Sunucunun kendi ürettiği plugin manifesti mi? Eski `writeAgentFiles` ajan
 * HER güncellendiğinde `{ name, description: "<ad> skill'leri", version }`
 * yazıyordu; açıklama ajan adına göre değiştiği için özet tablosu bunu
 * tanıyamaz (ölçüldü: 7 kurulu manifest hiç güncellenmedi). Bu kalıp
 * kullanıcının elle yazacağı bir şey değil, güvenle değiştirilir.
 */
function isGeneratedManifest(text: string): boolean {
  try {
    const m = JSON.parse(text) as Record<string, unknown>;
    const keys = Object.keys(m).sort().join(',');
    return keys === 'description,name,version' && typeof m.description === 'string' && m.description.endsWith(" skill'leri");
  } catch {
    return false;
  }
}

function upgradeContent(bundledDir: string, targetDir: string, id: string): void {
  // LEGACY_CONTENT anahtarlarıyla aynı biçim: `/` ayraçlı, ajan dizinine göre göreli.
  const rels = ['personality.md', '.claude-plugin/plugin.json'];
  const bundledSkills = path.join(bundledDir, 'skills');
  if (fs.existsSync(bundledSkills)) {
    for (const entry of fs.readdirSync(bundledSkills, { withFileTypes: true })) {
      if (entry.isDirectory()) rels.push(`skills/${entry.name}/SKILL.md`);
    }
  }

  for (const rel of rels) {
    const known = LEGACY_CONTENT[`${id}/${rel}`] ?? [];
    const source = path.join(bundledDir, rel);
    if (!fs.existsSync(source)) continue;
    // Pasif skill `SKILL.md.disabled` olarak durur; adı korunarak güncellenir.
    const target = path.join(targetDir, rel);
    for (const file of [target, target + '.disabled']) {
      try {
        if (!fs.existsSync(file)) continue;
        const text = fs.readFileSync(file, 'utf8');
        const current = contentHash(text);
        const generated = rel === '.claude-plugin/plugin.json' && isGeneratedManifest(text);
        if (!known.includes(current) && !generated) continue;
        const bundled = fs.readFileSync(source, 'utf8');
        if (current !== contentHash(bundled)) fs.writeFileSync(file, bundled, 'utf8');
      } catch (err) {
        console.warn(`[claudiva] ${file} güncellenemedi: ${(err as Error).message}`);
      }
    }
  }
}
