/**
 * Terminal dökümünde araç ayrıntısı: sade (varsayılan) ya da ayrıntılı.
 *
 * Sade görünümde art arda araç adımları tek, katlanmış ve okunur bir satıra
 * iner ("● 3 adım · Okudu: README.md · Görevi kapattı"); görev kuyruğunun
 * uzun "# Görev (id: …)" mesajı başlığına iner. Kod bilmeyen kullanıcı için
 * `mcp__team__delegate_task({...})` satırları gürültüydü (kullanıcı geri
 * bildirimi). Ayrıntılı görünüm bugünkü CLI benzeri dökümün aynısıdır.
 *
 * TEK GLOBAL tarayıcı tercihi; desen uiMode.ts ile aynı.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'claudiva.toolDetail';

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function setToolDetail(on: boolean): void {
  if (on === current) return;
  current = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* gizli sekme: yalnız bu oturum */
  }
  for (const l of listeners) l();
}

export function useToolDetail(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
