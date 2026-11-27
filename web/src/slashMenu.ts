/**
 * `/` komut menüsünün saf eşleştirmesi (terminal ve sohbet ortak).
 * İki yüzey ayrı yazarsa biri yerel komutu tanır, öteki tanımaz.
 */
import type { AgentSnapshot, SlashCommand } from './types';
import { isLocal, localAsSlashCommands } from './localCommands';

/** Girdi bir slash komutu yazılıyorsa henüz tamamlanmamış komut adını verir. */
export function slashPrefix(input: string): string | null {
  const m = /^\/([^\s]*)$/.exec(input);
  return m ? m[1] : null;
}

/** Claude Code CLI'daki gibi: önce baştan eşleşenler, sonra içinde geçenler. */
export function matchCommands(commands: SlashCommand[], prefix: string): SlashCommand[] {
  const q = prefix.toLowerCase();
  if (!q) return commands;
  const names = (c: SlashCommand) => [c.name, ...(c.aliases ?? [])];
  const starts = commands.filter((c) => names(c).some((n) => n.toLowerCase().startsWith(q)));
  const contains = commands.filter(
    (c) => !starts.includes(c) && names(c).some((n) => n.toLowerCase().includes(q)),
  );
  return [...starts, ...contains];
}

/** Panelin kendi komutları başta; ajanınkiyle ad çakışırsa panel sürümü kazanır
 *  (yerel işlenir, ör. /clear). */
export function commandsFor(agent: AgentSnapshot | null | undefined): SlashCommand[] {
  const agentCmds = (agent?.commands ?? []).filter((c) => !isLocal(c.name));
  return [...localAsSlashCommands(), ...agentCmds];
}
