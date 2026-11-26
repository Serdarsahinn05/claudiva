import { useEffect, useState } from 'react';
import { desktopWindow, switchProject } from '../desktop';
import { L } from '../i18n';

/* Windows başlık çubuğu simgeleriyle aynı biçim: ince çizgi, 10px. */
const glyph = (d: React.ReactNode) => (
  <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1"
       aria-hidden="true">
    {d}
  </svg>
);

const folder = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    <path d="M14 13h-5M11.5 10.5 9 13l2.5 2.5" />
  </svg>
);

/**
 * Masaüstü uygulamasında üst çubuğun sağ ucu: proje değiştir + pencere
 * düğmeleri. Yalnız `isDesktop` iken çizilir (App.tsx).
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = desktopWindow();
    if (!win) return;
    let off: (() => void) | undefined;
    let alive = true;
    const sync = () => void win.isMaximized().then((m) => alive && setMaximized(m));
    sync();
    void win.onResized(sync).then((f) => (alive ? (off = f) : f()));
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  const win = desktopWindow();
  if (!win) return null;

  return (
    <div className="win-ctl">
      <button
        className="icon-btn"
        onClick={switchProject}
        title={L.desktop.switchProject}
        aria-label={L.desktop.switchProject}
      >
        {folder}
      </button>
      <span className="win-ctl-sep" aria-hidden="true" />
      <button className="win-btn" onClick={() => void win.minimize()} title={L.desktop.minimize} aria-label={L.desktop.minimize}>
        {glyph(<path d="M0.5 5h9" />)}
      </button>
      <button
        className="win-btn"
        onClick={() => void win.toggleMaximize()}
        title={maximized ? L.desktop.restore : L.desktop.maximize}
        aria-label={maximized ? L.desktop.restore : L.desktop.maximize}
      >
        {maximized
          ? glyph(<><rect x="0.5" y="2.5" width="7" height="7" /><path d="M2.5 2.5v-2h7v7h-2" /></>)
          : glyph(<rect x="0.5" y="0.5" width="9" height="9" />)}
      </button>
      <button className="win-btn close" onClick={() => void win.close()} title={L.desktop.close} aria-label={L.desktop.close}>
        {glyph(<path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />)}
      </button>
    </div>
  );
}
