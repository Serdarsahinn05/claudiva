import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { BrowserState } from '../types';
import { L } from '../i18n';

/**
 * Browser paneli — sunucudaki headless Chromium'un canlı yüzü.
 *
 * Aynı tarayıcıyı ajanlar da sürüyor (mcp__browser__*), bu yüzden panel bir
 * "araç" değil bir PENCERE: ajan bir sayfa açtığında kullanıcı onu burada
 * görür ve istediği an devralır. Ajana ayrı bir tarayıcı örneği vermek
 * "ajan ne yapıyor" sorusunu yeniden görünmez kılardı.
 *
 * Görüntü CANLI akar (2026-11-27): panel açıkken `/ws/browser`a bağlanır,
 * sunucu Chromium'un ekran akışından JPEG kareleri iter. Chromium kareyi yalnız
 * ekran değişince üretir, boşta sayfa maliyetsiz. Eskiden her eylemden sonra
 * ayrı istekle PNG çekiliyordu: kaydırma/animasyon görünmüyordu, "çok yavaş"
 * (kullanıcı). Bağlantı yoksa eski yol (`/api/browser/screenshot`) yedektir.
 *
 * Değişikliği sunucu bildirir (WS `browser_state`), panel yoklamaz. Yoklama
 * yanlış taraftı: ajan sürerken panel hiçbir istek atmıyor, dolayısıyla
 * kullanıcının elle bir "takip" kutusu işaretlemesi gerekiyordu — panelin
 * varlık sebebi olan durum (ajan bir sayfa açtı) tam da varsayılan hâlde
 * görünmez kalıyordu.
 */

/** Sunucudaki sabit görüntü alanı; tıklama koordinatı buna ölçeklenir. */
const VW = 1280;
const VH = 800;

export function Browser({ pushed }: { pushed: BrowserState | null }) {
  const [state, setState] = useState<BrowserState | null>(null);
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Ekran görüntüsü URL'ine eklenen damga — tarayıcı önbelleğini kırar. */
  const [stamp, setStamp] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const refreshShot = useCallback(() => setStamp(Date.now()), []);
  /** Canlı akıştan son kare (blob URL); yoksa tek kare yedeği kullanılır. */
  const [frame, setFrame] = useState<string | null>(null);
  const running = !!state?.running;

  useEffect(() => {
    if (!running) {
      setFrame(null);
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/browser`);
    ws.binaryType = 'blob';
    let url: string | null = null;
    ws.onmessage = (e) => {
      const next = URL.createObjectURL(e.data as Blob);
      setFrame(next);
      // Önceki kare artık gösterilmiyor; bırakılmazsa bellek her karede büyür.
      if (url) URL.revokeObjectURL(url);
      url = next;
    };
    return () => {
      ws.close();
      if (url) URL.revokeObjectURL(url);
    };
  }, [running]);

  /**
   * Adres kutusu KULLANICI YAZARKEN ezilmez; başka her durumda sunucudaki
   * gerçek adresi izler.
   */
  const apply = useCallback(
    (s: BrowserState) => {
      setState(s);
      setAddr((cur) => (document.activeElement?.tagName === 'INPUT' ? cur : s.url));
      if (s.running) refreshShot();
    },
    [refreshShot],
  );

  // Panel açıldığında bir kez: tarayıcı panel kapalıyken de sürülmüş olabilir.
  useEffect(() => {
    api
      .browserState()
      .then(apply)
      .catch((e: Error) => setError(e.message));
  }, [apply]);

  // Sunucudan itilen her değişiklik (kullanıcı ya da AJAN sürdüğünde).
  useEffect(() => {
    if (pushed) apply(pushed);
  }, [pushed, apply]);

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError('');
    try {
      // Sunucu bu değişikliği WS ile de itiyor; yanıtı burada da uygulamak
      // paneli WS kopukken çalışır tutar (aynı durum, iki kez uygulanması zararsız).
      const s = (await fn()) as BrowserState;
      if (s && typeof s === 'object' && 'running' in s) apply(s);
      else refreshShot();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Görüntüdeki tıklamayı sunucudaki gerçek koordinata ölçekler. */
  function onImgClick(e: React.MouseEvent<HTMLImageElement>) {
    const el = imgRef.current;
    if (!el || !state?.running) return;
    const r = el.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * VW);
    const y = Math.round(((e.clientY - r.top) / r.height) * VH);
    void run(() => api.browserAct({ action: 'click', x, y }));
  }

  const unavailable = state?.unavailable;

  return (
    <div className="br">
      <section className="pl-head">
        <div>
          <h2 className="plate-title">Browser</h2>
          <p className="pl-head-desc">
            {L.browser.desc}
          </p>
        </div>
      </section>

      {unavailable ? (
        <div className="empty">
          <h2>{L.browser.unavailable}</h2>
          <p>{unavailable}</p>
        </div>
      ) : (
        <>
          <div className="br-bar">
            <button
              onClick={() => void run(() => api.browserAct({ action: 'back' }))}
              disabled={busy || !state?.running}
              title={L.extra.back}
              aria-label={L.extra.back}
            >
              ←
            </button>
            <button
              onClick={() => void run(() => api.browserAct({ action: 'reload' }))}
              disabled={busy || !state?.running}
              title={L.extra.reload}
              aria-label={L.extra.reload}
            >
              ⟳
            </button>
            <input
              className="br-addr"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run(() => api.browserNavigate(addr));
              }}
              placeholder={L.browser.address}
              aria-label={L.extra.address}
            />
            <button className="primary" onClick={() => void run(() => api.browserNavigate(addr))} disabled={busy}>
              Git
            </button>
            {state?.running && (
              <button
                className="danger"
                onClick={() =>
                  void run(async () => {
                    await api.browserClose();
                    return { running: false, url: '', title: '', viewport: { width: VW, height: VH } };
                  })
                }
                disabled={busy}
              >
                Kapat
              </button>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          {state?.running && (
            <div className="br-meta">
              <span className="br-title">{state.title || L.browser.untitled}</span>
              <span className="br-url">{state.url}</span>
            </div>
          )}

          <div className="br-screen">
            {state?.running ? (
              <img
                ref={imgRef}
                src={frame ?? `/api/browser/screenshot?t=${stamp}`}
                alt={L.browser.shotAlt}
                onClick={onImgClick}
                onError={() => setError(L.browser.shotFailed)}
              />
            ) : (
              <div className="muted center">
                {L.extra.browserOff}<strong>{L.extra.browserGo}</strong>{L.extra.browserOffEnd}
              </div>
            )}
          </div>

          {state?.running && (
            <div className="br-keys">
              <input
                className="br-type"
                placeholder={L.browser.typePlaceholder}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const v = e.currentTarget.value;
                  e.currentTarget.value = '';
                  void run(() => api.browserAct({ action: 'type', text: v, submit: true }));
                }}
                aria-label={L.browser.typeAria}
              />
              <button onClick={() => void run(() => api.browserAct({ action: 'scroll', dy: 600 }))} disabled={busy}>
                {L.browser.scrollDown}
              </button>
              <button onClick={() => void run(() => api.browserAct({ action: 'scroll', dy: -600 }))} disabled={busy}>
                {L.browser.scrollUp}
              </button>
              <span className="br-hint">{L.browser.clickHint}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
