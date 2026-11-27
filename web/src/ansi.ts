/**
 * ANSI SGR → biçimli parçalar (statusline çıktısı için). Kütüphane yok:
 * yalnız renk/kalın/soluk/italik/alt çizgi; diğer kaçış dizileri (OSC 8
 * bağlantı, imleç hareketi) atılır. Çıktı `dangerouslySetInnerHTML` İSTEMEZ,
 * React düğümü olarak çizilir (Kod panelindeki ilkeyle aynı).
 */
export interface AnsiSpan {
  text: string;
  color?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// xterm'in varsayılan 16 rengi (koyu terminal kartında okunur; statusline
// betikleri koyu terminal için yazılıyor).
const BASIC = [
  '#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
  '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff',
];

function color256(n: number): string {
  if (n < 16) return BASIC[n];
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v},${v},${v})`;
  }
  const i = n - 16;
  const c = (x: number) => (x === 0 ? 0 : 55 + x * 40);
  return `rgb(${c(Math.floor(i / 36))},${c(Math.floor(i / 6) % 6)},${c(i % 6)})`;
}

// OSC (…BEL ya da …ST) ve SGR dışındaki CSI dizileri atılır.
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CSI = /\x1b\[([0-9;]*)([A-Za-z])/g;

export function parseAnsi(input: string): AnsiSpan[] {
  const text = input.replace(OSC, '');
  const out: AnsiSpan[] = [];
  let st: Omit<AnsiSpan, 'text'> = {};
  let last = 0;
  for (const m of text.matchAll(CSI)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), ...st });
    last = m.index! + m[0].length;
    if (m[2] !== 'm') continue;
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) st = {};
      else if (c === 1) st = { ...st, bold: true };
      else if (c === 2) st = { ...st, dim: true };
      else if (c === 3) st = { ...st, italic: true };
      else if (c === 4) st = { ...st, underline: true };
      else if (c === 22) st = { ...st, bold: false, dim: false };
      else if (c === 23) st = { ...st, italic: false };
      else if (c === 24) st = { ...st, underline: false };
      else if (c >= 30 && c <= 37) st = { ...st, color: BASIC[c - 30] };
      else if (c >= 90 && c <= 97) st = { ...st, color: BASIC[c - 90 + 8] };
      else if (c === 39) st = { ...st, color: undefined };
      else if (c >= 40 && c <= 47) st = { ...st, bg: BASIC[c - 40] };
      else if (c >= 100 && c <= 107) st = { ...st, bg: BASIC[c - 100 + 8] };
      else if (c === 49) st = { ...st, bg: undefined };
      else if (c === 38 || c === 48) {
        const key = c === 38 ? 'color' : 'bg';
        if (codes[i + 1] === 2) {
          st = { ...st, [key]: `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})` };
          i += 4;
        } else if (codes[i + 1] === 5) {
          st = { ...st, [key]: color256(codes[i + 2] ?? 0) };
          i += 2;
        }
      }
    }
  }
  if (last < text.length) out.push({ text: text.slice(last), ...st });
  return out.filter((s) => s.text);
}
