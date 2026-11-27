/**
 * Mesajın hangi SOHBETTEN gönderildiği (Sohbet modu).
 *
 * Bir ajanın tek dökümü var; aynı lider hem "Tüm ekip"te, hem kendi takım
 * grubunda, hem de özel sohbette konuşuyor. Etiket olmadan her konuşma
 * ajanın dökümünün TAMAMINI gösteriyordu: özel mesaj bütün gruplara,
 * ekip işi özel sohbete düşüyordu (kullanıcı hata bildirimi, 2026-11-27).
 *
 * Grup gönderimi mesajın sonuna `⟪claudiva:sohbet=<grup anahtarı>⟫` ekler;
 * akış onu okuyup keser (`readConvTag`). Özel sohbet etiket EKLEMEZ:
 * etiketsiz ve brifsiz mesaj o ajanın özel sohbetidir. Böylece eski dökümler
 * de doğru ayrılır: eski brifler gruplara, düz mesajlar özel sohbete.
 */
const OPEN = '⟪claudiva:sohbet=';
const CLOSE = '⟫';
const RE = /\n*⟪claudiva:sohbet=([^⟫\n]*)⟫/;

/** `/komut` etiketlenmez: argümanına eklenen satır komutu bozar. */
export function withConvTag(text: string, groupKey: string): string {
  if (text.startsWith('/')) return text;
  return `${text}\n\n${OPEN}${groupKey}${CLOSE}`;
}

export function readConvTag(text: string): { text: string; group: string | null } {
  const m = RE.exec(text);
  if (!m) return { text, group: null };
  return { text: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trimEnd(), group: m[1] };
}
