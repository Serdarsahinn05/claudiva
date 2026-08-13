import fs from 'node:fs';
import path from 'node:path';
import { MEMORY_DIR } from './paths.js';
import type { MemoryNode } from './types.js';

/**
 * Ajan hafızası = `<proje>/.claude-manager/memory/<ajanId|shared>/*.md`.
 * Her dosya tek bir hafıza: frontmatter (name/description/metadata.type) +
 * gövdede `[[dosya-adi]]` bağlantıları (hafiza-yaz skill'inin ürettiği biçim).
 *
 * Burada düğüm listesi çıkarılır; kenarlar istemcide `[[link]]` → düğüm
 * eşlemesiyle türetilir. AI yok, dosyalar zaten açık bir grafik.
 */
const LINK_RE = /\[\[([^\]]+)\]\]/g;

function parseFront(raw: string): { name?: string; description?: string; type?: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { body: raw };
  const front = m[1];
  const pick = (k: string): string | undefined => {
    const r = new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, 'm').exec(front);
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : undefined;
  };
  return { name: pick('name'), description: pick('description'), type: pick('type'), body: m[2] };
}

export function readMemoryGraph(): { nodes: MemoryNode[] } {
  const nodes: MemoryNode[] = [];
  if (!fs.existsSync(MEMORY_DIR)) return { nodes };

  for (const dir of fs.readdirSync(MEMORY_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const agentId = dir.name;
    const adir = path.join(MEMORY_DIR, agentId);
    let files: string[] = [];
    try {
      files = fs.readdirSync(adir);
    } catch {
      continue;
    }
    for (const f of files) {
      // MEMORY.md yalnızca insan-okur indeks; grafikte düğüm değil.
      if (!f.endsWith('.md') || f.toLowerCase() === 'memory.md') continue;
      const slug = f.slice(0, -3);
      let raw = '';
      try {
        raw = fs.readFileSync(path.join(adir, f), 'utf8');
      } catch {
        continue;
      }
      const { name, description, type, body } = parseFront(raw);
      const links = [...body.matchAll(LINK_RE)].map((m) => m[1].trim());
      const firstLine = body.trim().split('\n').find((l) => l.trim()) ?? '';
      nodes.push({
        id: `${agentId}/${slug}`,
        agentId,
        slug,
        name: name ?? slug,
        description: description ?? firstLine.slice(0, 140),
        type: type ?? 'note',
        content: body.trim(),
        links,
      });
    }
  }
  return { nodes };
}
