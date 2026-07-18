import { api } from './api';
import type { AgentSnapshot, SlashCommand } from './types';

/**
 * Claude Code CLI'da bazı komutlar istemci tarafında işlenir; model onları hiç
 * görmez (/usage, /clear, /help gibi). Panel de aynısını yapar: aşağıdaki
 * komutlar ajana GÖNDERİLMEZ, burada çalışıp terminale kendi çıktısını basar.
 *
 * Buraya girmeyen her şey (skill'ler dahil) eskisi gibi ajana gider.
 */
export interface LocalCommand {
  name: string;
  aliases?: string[];
  description: string;
  /** Çıktı metni döndürür; null dönerse terminale bir şey yazılmaz. */
  run: (ctx: LocalContext) => Promise<string | null>;
}

export interface LocalContext {
  agent: AgentSnapshot;
  args: string;
  /** Terminaldeki dökümü temizler (sunucudaki kayıt da silinir). */
  clearTranscript: () => Promise<void>;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** "2026-07-18T12:20:00Z" -> "18 Tem 12:20" */
function fmtReset(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Yüzdeyi 20 karakterlik bir çubuğa çevirir. */
function bar(pct: number): string {
  const filled = Math.max(0, Math.min(20, Math.round((pct / 100) * 20)));
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
}

interface RateWindow {
  utilization?: number;
  resets_at?: string;
}

interface PlanUsage {
  rate_limits_available?: boolean;
  rate_limits?: Record<string, RateWindow | null>;
}

/** Plan penceresi anahtarlarının okunabilir adları. */
const WINDOW_LABEL: Record<string, string> = {
  five_hour: '5 saatlik',
  seven_day: '7 günlük',
  seven_day_opus: '7 günlük (Opus)',
  seven_day_sonnet: '7 günlük (Sonnet)',
};

async function usageOutput(ctx: LocalContext): Promise<string> {
  const { tracked, plan } = await api.usageDetail();
  const lines: string[] = [];

  const t = tracked.total;
  lines.push('Bu projedeki kullanım (claude-manager sayımı)');
  lines.push(
    `  ${fmtTokens(t.inputTokens + t.outputTokens)} token · $${t.costUSD.toFixed(4)} · ${t.requests} istek`,
  );

  const rows = Object.entries(tracked.perAgent).filter(([, u]) => u.requests > 0);
  if (rows.length) {
    lines.push('');
    for (const [id, u] of rows.sort((a, b) => b[1].costUSD - a[1].costUSD)) {
      const name = id === ctx.agent.config.id ? `${id} (bu ajan)` : id;
      lines.push(`  ${name.padEnd(24)} ${fmtTokens(u.inputTokens + u.outputTokens).padStart(7)} · $${u.costUSD.toFixed(4)}`);
    }
  }

  const p = plan as PlanUsage | null;
  const windows = p?.rate_limits ? Object.entries(p.rate_limits) : [];
  const usable = windows.filter(
    (e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number',
  );

  lines.push('');
  if (p?.rate_limits_available && usable.length) {
    lines.push('Hesap plan kotası');
    for (const [key, win] of usable) {
      const label = WINDOW_LABEL[key] ?? key;
      const reset = fmtReset(win.resets_at);
      lines.push(
        `  ${label.padEnd(18)} ${bar(win.utilization!)} %${String(win.utilization).padStart(3)}${reset ? `  ↻ ${reset}` : ''}`,
      );
    }
  } else {
    lines.push('Hesap plan kotası okunamadı.');
    lines.push('  En az bir ajanın çalışıyor olması gerekiyor (kota açık oturumdan okunur).');
  }

  return lines.join('\n');
}

export const LOCAL_COMMANDS: LocalCommand[] = [
  {
    name: 'usage',
    aliases: ['cost'],
    description: 'Token/maliyet sayımı ve hesabın plan kotası',
    run: usageOutput,
  },
  {
    name: 'clear',
    description: 'Terminal dökümünü temizler (ajanın bağlamı korunur)',
    run: async (ctx) => {
      await ctx.clearTranscript();
      return null;
    },
  },
  {
    name: 'help',
    description: 'Komutları listeler',
    run: async (ctx) => {
      const local = LOCAL_COMMANDS.map(
        (c) => `  /${c.name.padEnd(16)} ${c.description}${c.aliases?.length ? ` (= /${c.aliases.join(', /')})` : ''}`,
      );
      const agentCmds = (ctx.agent.commands ?? []).filter((c) => !isLocal(c.name));
      return [
        'Panelde çalışan komutlar (ajana gönderilmez)',
        ...local,
        '',
        `Ajana giden komutlar: ${agentCmds.length} tane — "/" yazıp listeden seç.`,
        'Diğer her şey doğrudan ajana görev olarak gider.',
      ].join('\n');
    },
  },
];

const LOCAL_NAMES = new Set(LOCAL_COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]));

export function isLocal(name: string): boolean {
  return LOCAL_NAMES.has(name.toLowerCase());
}

/** Girdi yerel bir komutsa onu döndürür; değilse null (ajana gitmeli). */
export function matchLocal(input: string): { cmd: LocalCommand; args: string } | null {
  const m = /^\/(\S+)\s*(.*)$/s.exec(input.trim());
  if (!m) return null;
  const name = m[1].toLowerCase();
  const cmd = LOCAL_COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
  return cmd ? { cmd, args: m[2] } : null;
}

/** Yerel komutları "/" menüsünde de göstermek için SlashCommand biçimine çevirir. */
export function localAsSlashCommands(): SlashCommand[] {
  return LOCAL_COMMANDS.map((c) => ({
    name: c.name,
    description: `(panel) ${c.description}`,
    aliases: c.aliases,
  }));
}
