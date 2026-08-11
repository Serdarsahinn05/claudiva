/**
 * Araç çağrısı input'unu (tool_use olayındaki JSON string) çözer. Terminal
 * skinleri (Claude/Codex/Grok) bunu ortak kullanır: her biri farklı gösterir
 * ama parse mantığı tek yerde.
 */
export interface ParsedTool {
  /** Küçük harf eylem (oku/düzenle/çalıştır…) — Grok kompakt biçimi. */
  verb: string;
  /** Gerçek araç adı (Read/Edit…) — Claude biçimi. */
  label: string;
  /** Birincil argüman: dosya yolu / komut / desen / url. */
  arg: string;
  file?: string;
  command?: string;
  /** Edit/Write/MultiEdit ise çıkarılan diff. */
  diff?: { removed: string[]; added: string[] };
}

const VERBS: Record<string, string> = {
  Read: 'oku',
  Write: 'yaz',
  Edit: 'düzenle',
  MultiEdit: 'düzenle',
  NotebookEdit: 'düzenle',
  Bash: 'çalıştır',
  Grep: 'ara',
  Glob: 'bul',
  WebFetch: 'getir',
  WebSearch: 'ara',
  Task: 'görev',
  TodoWrite: 'todo',
};

export function parseTool(toolName: string, inputStr: string): ParsedTool {
  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(inputStr) as Record<string, unknown>;
  } catch {
    // Girdi kesilmiş (2000 karakter sınırı) ya da bozuk olabilir.
  }
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const file = str(input.file_path) ?? str(input.path) ?? str(input.notebook_path);
  const command = str(input.command);
  const arg = file ?? command ?? str(input.pattern) ?? str(input.url) ?? (inputStr && inputStr !== '{}' ? inputStr : '');

  let diff: ParsedTool['diff'];
  if (toolName === 'Edit' && typeof input.old_string === 'string') {
    diff = { removed: input.old_string.split('\n'), added: String(input.new_string ?? '').split('\n') };
  } else if (toolName === 'Write' && typeof input.content === 'string') {
    diff = { removed: [], added: input.content.split('\n') };
  } else if (toolName === 'MultiEdit' && Array.isArray(input.edits)) {
    const removed: string[] = [];
    const added: string[] = [];
    for (const e of input.edits as { old_string?: unknown; new_string?: unknown }[]) {
      if (typeof e?.old_string === 'string') removed.push(...e.old_string.split('\n'));
      if (typeof e?.new_string === 'string') added.push(...e.new_string.split('\n'));
    }
    diff = { removed, added };
  }

  return { verb: VERBS[toolName] ?? toolName.toLowerCase(), label: toolName, arg, file, command, diff };
}

/** Diff satır sayısı özeti: "+12 −1". */
export function diffCounts(diff: { removed: string[]; added: string[] }): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`+${diff.added.length}`);
  if (diff.removed.length) parts.push(`−${diff.removed.length}`);
  return parts.length ? `(${parts.join(' ')})` : '';
}
