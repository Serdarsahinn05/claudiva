import { dateLocale } from '../../i18n';
/** Sohbet bileşenlerinin ortak biçimleyicileri (bileşen dosyası yalnız bileşen dışa aktarsın diye ayrı). */
export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return s.toLocaleUpperCase('tr');
}

/**
 * Ajan metninde yalnız iki satır içi işaret çizilir: **kalın** ve `kod`.
 * Tam bir markdown ayrıştırıcısı değil (bilerek): başlık, liste ve tablo
 * `pre-wrap` ile zaten okunuyor, sohbette kaba ** işaretleri ise göze batıyordu.
 * HTML dizgesi ÜRETİLMEZ; parçalar düz metin olarak React'e verilir.
 */
export type InlinePart = { kind: 'text' | 'bold' | 'code'; text: string };

export function inlineParts(src: string): InlinePart[] {
  const out: InlinePart[] = [];
  const re = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    out.push(m[1] !== undefined ? { kind: 'bold', text: m[1] } : { kind: 'code', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}
