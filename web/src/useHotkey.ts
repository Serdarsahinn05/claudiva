import { useEffect, useRef } from 'react';

/**
 * Global kısayol dinleyicisi — paneldeki ilk klavye tüketicisi.
 *
 * `mod` platforma göre çözülür: macOS'ta ⌘, diğerlerinde Ctrl. Tarayıcının
 * kendi kısayolunu ezmemek için eşleşme olmadan `preventDefault` çağrılmaz.
 */
interface Options {
  /** Kapalıyken dinleyici bağlı kalır ama tetiklenmez (koşullu kısayollar için). */
  enabled?: boolean;
  /**
   * Metin alanındayken de çalışsın mı. Değiştiricili kısayollar (Ctrl+K) için
   * varsayılan `true`; yazarken de erişilebilir olmaları beklenir.
   */
  allowInInput?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** "mod+k" → { mod: true, key: 'k' } */
function parse(combo: string) {
  const parts = combo.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1],
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

function isTextField(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable;
}

export function useHotkey(combo: string, handler: () => void, opts: Options = {}): void {
  const { enabled = true, allowInInput = true } = opts;
  // Handler her render'da yeniden kurulup dinleyiciyi söküp takmasın diye ref'te.
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const want = parse(combo);

    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== want.key) return;
      if (want.mod !== (isMac ? e.metaKey : e.ctrlKey)) return;
      if (want.shift !== e.shiftKey) return;
      if (want.alt !== e.altKey) return;
      if (!allowInInput && isTextField(e.target)) return;
      e.preventDefault();
      latest.current();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, enabled, allowInInput]);
}
