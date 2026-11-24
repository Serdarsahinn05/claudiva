/**
 * JEV yönlendiricisi — kural katmanı (0 token, 0 ms).
 *
 * Bir görevin büyüklüğünü metinden kestirir. Emin değilse `null` döner ve
 * karar sınıflandırıcıya (classifier.ts) kalır. Bilerek TUTUCU: yanlış
 * "küçük" kararı işi zayıf modele verir, kaliteyi düşürür; yanlış "emin
 * değilim" kararı yalnız ~$0.0006 ve ~2.3 sn tutar (ölçüldü, SONRAKI-ISLER §2).
 *
 * Kalıplar Türkçe + İngilizce: ajan dosyaları İngilizce, kullanıcı Türkçe yazar.
 */
export type Tier = 'small' | 'medium' | 'large';

export interface RuleVerdict {
  tier: Tier;
  /** İnsan okunur gerekçe (görev kaydına ve panele gider). */
  why: string;
}

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * Sözcük BAŞI sınırıyla seçenek listesi. JS'in `\b`'si ASCII'dir: `\b(özetle`
 * hiç eşleşmez, çünkü `ö` "kelime karakteri" sayılmaz. Unicode harf/rakam
 * sınıfıyla kurulur. Sözcük SONU bilerek serbest: "düzelt" → "düzeltir",
 * "düzeltilmeli" de eşleşsin (Türkçe ek alır).
 */
const startsWord = (alts: string[]) =>
  new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${alts.join('|')})`, 'u');

/**
 * Bir şey DEĞİŞTİREN fiiller: varsa iş en az "orta". Ad olarak da geçen
 * kökler BİLEREK yok: "kur" (kurulum), "change" (changes, CHANGELOG) okuma
 * isteklerini değişiklik sandırıyordu (ölçüldü).
 */
const CHANGE = startsWord([
  'düzelt', 'ekle', 'yaz', 'güncelle', 'değiştir', 'sil', 'kaldır', 'taşı', 'uygula', 'oluştur',
  'refactor', 'yeniden düzenle', 'implement', 'fix', 'add ', 'write', 'update', 'delete',
  'remove', 'create', 'build', 'rename',
]);

/** Yalnız OKUYAN fiiller/sorular. */
const READ = startsWord([
  'oku', 'listele', 'göster', 'özetle', 'özet', 'nedir', 'ne demek', 'kaç', 'hangi', 'nerede', 'açıkla',
  'bul', 'kontrol et', 'read', 'list', 'show', 'summari[sz]e', 'what', 'which', 'where', 'how many',
  'explain', 'find', 'look up', 'check',
]);

/** Büyüklük işaretleri: kapsam geniş ya da belirsiz. */
const LARGE = startsWord([
  'mimari', 'baştan', 'yeniden tasarla', 'tüm\\s+\\S+', 'bütün\\s+\\S+', 'her yer', 'uçtan uca',
  'plan çıkar', 'araştır', 'karşılaştır', 'neden yavaş', 'güvenlik denetimi', 'architecture',
  'redesign', 'rewrite', 'end[- ]to[- ]end', 'across the', 'all (?:the )?\\w+', 'investigate',
  'research', 'audit', 'migrat',
]);

export function classifyByRules(title: string, prompt: string): RuleVerdict | null {
  // Slash komutu: CLI'ın kendi işi, model seçimi anlamsız.
  if (prompt.trimStart().startsWith('/')) return null;

  const text = norm(`${title}\n${prompt}`);
  const count = text.split(/\s+/).filter(Boolean).length;

  if (count > 220) return { tier: 'large', why: `uzun görev (${count} kelime)` };
  if (LARGE.test(text)) return { tier: 'large', why: 'geniş kapsam işareti' };

  const changes = CHANGE.test(text);
  if (!changes && READ.test(text) && count <= 40) return { tier: 'small', why: 'kısa okuma/soru' };
  // Değiştiren ve ayrıntılı tarif edilmiş iş: orta. Kısa bir "düzelt"in
  // gerçekten küçük mü büyük mü olduğu metinden çıkmaz → kararsız bırak.
  if (changes && count > 40) return { tier: 'medium', why: 'ayrıntılı değişiklik' };
  return null;
}
