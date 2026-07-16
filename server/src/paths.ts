import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root: server/src -> server -> root */
export const ROOT = path.resolve(here, '..', '..');

export const AGENTS_DIR = path.join(ROOT, 'agents');
export const MEMORY_DIR = path.join(ROOT, 'memory');
export const SHARED_MEMORY_DIR = path.join(MEMORY_DIR, 'shared');
export const WORKSPACES_DIR = path.join(ROOT, 'workspaces');
export const PROMPTS_DIR = path.join(ROOT, 'prompts');
export const DATA_DIR = path.join(ROOT, 'data');

export function ensureDirs(): void {
  for (const d of [AGENTS_DIR, MEMORY_DIR, SHARED_MEMORY_DIR, WORKSPACES_DIR, PROMPTS_DIR, DATA_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function agentDir(id: string): string {
  return path.join(AGENTS_DIR, id);
}

export function agentMemoryDir(id: string): string {
  return path.join(MEMORY_DIR, id);
}

export function agentWorkspaceDir(id: string): string {
  return path.join(WORKSPACES_DIR, id);
}
