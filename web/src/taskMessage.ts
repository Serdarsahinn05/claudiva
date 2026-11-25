/**
 * Görev kuyruğunun çalışana yazdığı mesajı tanır (server/src/tasks/queue.ts).
 *
 * Önek 2026-11-25'te İngilizceye geçti (`# Task (id: … — assigned by: …`);
 * eski dökümler `# Görev (id: … — atayan: …` taşır. İKİSİ de tanınmak zorunda:
 * tanınmazsa eski görev mesajları sohbete ve terminale ham çerçeve olarak döker.
 */
const PREFIXES = ['# Task (id:', '# Görev (id:'];

export function isTaskMessage(text: string): boolean {
  return PREFIXES.some((p) => text.startsWith(p));
}

/** Görevi atayan ajanın kimliği (başlık satırından). */
export function taskAssigner(text: string): string {
  return /(?:assigned by|atayan):\s*([^\n]+)/.exec(text)?.[1]?.trim() ?? '';
}
