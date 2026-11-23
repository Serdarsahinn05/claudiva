/**
 * Var olan kurulumlardaki paket ajanlarını GÜNCELLER, kullanıcının elini
 * değdirdiği hiçbir şeye dokunmadan.
 *
 * Neden ayrı: `seedAgents()` yalnız ilk çalıştırmada kopyalar; sonradan pakete
 * eklenen bir skill (ör. find-skills) ya da düzeltilen bir rol adı mevcut
 * kullanıcıya hiç ulaşmıyordu.
 *
 * İki kural:
 *  1. **Ad/açıklama** yalnız değer ESKİ paket değerine BİREBİR eşitse yenilenir.
 *     Eşit değilse kullanıcı düzenlemiştir, dokunulmaz.
 *  2. **Skill'ler** `<ajan>/.seeded-skills` manifestiyle izlenir. Pakette olup
 *     manifestte olmayan skill YENİDİR ve kopyalanır. Manifestte olup diskte
 *     olmayan skill kullanıcı tarafından SİLİNMİŞTİR, geri getirilmez.
 *     Manifest yoksa başlangıç değeri, 0.1.x paketinde olan skill listesidir
 *     (LEGACY tablosu). Bu olmasa kullanıcının sildiği eski bir skill "yeni"
 *     sanılıp geri gelirdi.
 */
import fs from 'node:fs';
import path from 'node:path';

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
