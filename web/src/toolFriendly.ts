/**
 * Araç çağrısının kod bilmeyen biri için okunur karşılığı (sade döküm).
 *
 * Ham ad (`mcp__team__delegate_task`) ve JSON argümanı yerine tek kısa cümle:
 * "Görev verdi → Kıdemli Geliştirici: Faz 3 dosyası". Tanınmayan araç
 * `mcp__sunucu__` öneki atılmış adıyla kalır; uydurma açıklama yazılmaz.
 */
import { L } from './i18n';

type Input = Record<string, unknown>;

function parse(inputStr: string): Input {
  try {
    const v = JSON.parse(inputStr) as unknown;
    return v && typeof v === 'object' ? (v as Input) : {};
  } catch {
    return {}; // 2000 karakterde kesilmiş olabilir
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const base = (p: string) => p.split(/[\\/]/).pop() || p;
const host = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};

export function friendlyTool(toolName: string, inputStr: string, nameOf: (id: string) => string): string {
  const i = parse(inputStr);
  const f = L.friendly;
  const short = toolName.replace(/^mcp__.+?__/, '');
  switch (short) {
    case 'delegate_task':
      return f.delegate(nameOf(str(i.agent_id)), str(i.title));
    case 'delegate_tasks':
      return f.delegateMany(Array.isArray(i.tasks) ? i.tasks.length : 0);
    case 'complete_task':
      return i.failed ? f.completeFailed : f.complete;
    case 'check_task':
      return f.checkTask;
    case 'list_agents':
      return f.listAgents;
    case 'set_model':
      return f.setModel(str(i.model));
  }
  if (toolName.startsWith('mcp__browser__')) return f.browser;
  switch (toolName) {
    case 'Read':
      return f.read(base(str(i.file_path)));
    case 'Write':
      return f.write(base(str(i.file_path)));
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return f.edit(base(str(i.file_path) || str(i.notebook_path)));
    case 'Bash':
      return f.bash;
    case 'Grep':
    case 'Glob':
      return f.search;
    case 'WebFetch':
      return f.fetch(host(str(i.url)));
    case 'WebSearch':
      return f.webSearch(str(i.query));
    case 'ToolSearch':
      return f.toolSearch;
    case 'TodoWrite':
      return f.todo;
    case 'AskUserQuestion': {
      const q = Array.isArray(i.questions) ? (i.questions[0] as { question?: unknown } | undefined) : undefined;
      return f.ask(typeof q?.question === 'string' ? q.question : '');
    }
    case 'Skill':
      return f.skill(str(i.skill) || str(i.command));
  }
  return short;
}
