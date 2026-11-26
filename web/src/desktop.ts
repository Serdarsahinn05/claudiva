/**
 * Masaüstü kabuğu (desktop/) köprüsü.
 *
 * Masaüstü uygulamasında pencerenin Windows başlık çubuğu YOK
 * (`decorations: false`): sürükleme, küçült/büyüt/kapat ve "Proje değiştir"
 * panelin kendi üst çubuğunda. Kabuk `window.__TAURI__`u sayfaya enjekte eder;
 * tarayıcıda (npm CLI) bu nesne yoktur ve buradaki her şey sessizce devre dışı
 * kalır. Panelin izinleri dar tutulur: yalnız pencere düğmeleri ve
 * `switch_project` (bkz. `desktop/src-tauri/capabilities/panel.json`).
 *
 * Paket eklenmez (`@tauri-apps/api`): npm paketi masaüstünü bilmez, yalnız
 * global nesneyi okur.
 */

interface TauriWindow {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  startDragging(): Promise<void>;
  onResized(handler: () => void): Promise<() => void>;
}

interface TauriGlobal {
  core: { invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> };
  window: { getCurrentWindow(): TauriWindow };
}

const tauri = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;

export const isDesktop = !!tauri?.window;

export function desktopWindow(): TauriWindow | null {
  return tauri?.window ? tauri.window.getCurrentWindow() : null;
}

/** Sunucuyu kapatıp açılış ekranına döner (kabuk bu sayfadan ayrılır). */
export function switchProject(): void {
  void tauri?.core.invoke('switch_project');
}

/** Bu öğeye basmak pencereyi sürüklemez: düğme, alan, sekme vb. */
const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role="tab"], [role="button"], [contenteditable="true"]';

/**
 * Üst çubuğun boş yerine basınca pencereyi sürükler, çift tıklayınca
 * büyütür/eski boyuta döndürür (Windows başlık çubuğunun davranışı).
 * `data-tauri-drag-region` kullanılmaz: yalnız özniteliği taşıyan öğenin
 * KENDİSİNDE çalışıyor, çubuktaki metin ve boşluk kapsayıcılarında değil.
 */
export function onTitleBarMouseDown(e: React.MouseEvent): void {
  const win = desktopWindow();
  if (!win || e.button !== 0) return;
  if ((e.target as Element).closest(INTERACTIVE)) return;
  e.preventDefault();
  if (e.detail === 2) void win.toggleMaximize();
  else void win.startDragging();
}
