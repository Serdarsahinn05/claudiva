import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Grafik ilkelleri — bu plakanın kendi çizim dili.
 *
 * İki otorite birleşiyor:
 *  · **Biçim ve işaret ölçüleri** dataviz yönteminden: ince işaretler, 2px
 *    çizgi, veri ucunda 4px yuvarlatma, taban köşesi kare, alan dolgusu ~%10,
 *    hairline ve DÜZ (kesikli değil) ızgara, bitişik dolgular arasında 2px
 *    YÜZEY BOŞLUĞU (kenarlık değil), seçici doğrudan etiket.
 *  · **Renk ve tipografi** `web/DESIGN.md`'den: tek vurgu (vermilion), kanal
 *    token'ı (`rgb(var(--x-rgb) / a)`), sayılar mono, ad/başlık asla veri
 *    taşımaz.
 *
 * ÜÇ KURAL BURADA BİLEREK ÇİĞNENMİYOR:
 *
 * 1. **Nominal kategoriye değer rampası YOK.** Ajanlar sıralı bir küme değil;
 *    çubuğun boyu değeri zaten söylüyor. Bu yüzden `BarList`teki her çubuk AYNI
 *    renkte (vurgu) — koyuluk-büyüklük eşlemesi tek serbest kanalı, zaten
 *    görünen bilgiye harcardı.
 * 2. **Metin veri rengi giymez.** Etiket/değer `--fg/--muted/--dim`; kimliği
 *    yanındaki renkli işaret taşır.
 * 3. **Kahraman sayı serif DEĞİL.** DESIGN.md "Bodoni veri taşımaz" diyor,
 *    dataviz "hero figure asla display/serif" diyor — ikisi aynı yere çıkıyor:
 *    Archivo, orantılı rakamlarla (tabular yalnız sütunlarda).
 */

// ------------------------------------------------------------------ ölçüler

/** Kutunun gerçek piksel ölçüsü. Ölçeklenen viewBox etiketleri de büyütürdü. */
function useBox(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 600, h: 160 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setBox({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

// ------------------------------------------------------------------- tile

export type Tone = 'neutral' | 'ok' | 'warn' | 'alarm';

/**
 * Sayının kendisi grafik olduğunda kullanılan kutucuk. Tek çubuklu bir çubuk
 * grafiği ya da iki dilimli bir pasta yerine bu gelir.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
  hero,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: Tone;
  /** Görünümün TEK kahraman sayısı (≥40px). Bir panelde bir tane. */
  hero?: boolean;
}) {
  return (
    <div className={`ub-tile${hero ? ' hero' : ''}`} data-tone={tone}>
      <span className="ub-tile-label">{label}</span>
      <span className="ub-tile-value">{value}</span>
      {sub && <span className="ub-tile-sub">{sub}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ meter

/**
 * Doluluk göstergesi. Dolgu şiddeti taşır (vurgu → uyarı → alarm); boş kısım
 * AYNI rampanın açık basamağı, böylece durum çubuğun tamamında okunur.
 * Yüzde yoksa (sınır tanımsız) çubuk hiç çizilmez — boş bir çubuk "%0 dolu"
 * gibi okunur ve bu bir yalan olurdu.
 */
export function Meter({
  label,
  pct,
  value,
  note,
}: {
  label: string;
  pct: number | null;
  value: string;
  note?: string;
}) {
  const tone: Tone = pct === null ? 'neutral' : pct >= 100 ? 'alarm' : pct >= 80 ? 'warn' : 'ok';
  return (
    <div className="ub-meter" data-tone={tone}>
      <div className="ub-meter-head">
        <span className="ub-meter-label">{label}</span>
        <span className="ub-meter-value">{value}</span>
      </div>
      {pct === null ? (
        <div className="ub-meter-none">{note ?? 'sınır tanımlı değil'}</div>
      ) : (
        <>
          <div
            className="ub-meter-track"
            role="meter"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
          >
            <div className="ub-meter-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          {note && <div className="ub-meter-note">{note}</div>}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------- bar list

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Çubuğun ucundaki doğrudan etiket (biçimlenmiş değer). */
  display: string;
  /** İkinci satır — ölçü değil bağlam (ör. "3 istek · sonnet"). */
  note?: string;
  /** Bu satır incelenen ajan/öğe mi (vurgulu okunur). */
  active?: boolean;
}

/**
 * Yatay çubuk listesi — ortak cetvel üzerinde hairline satırlar.
 *
 * Tekrar eden varlıklar için kart ızgarası DEĞİL satır kullanılıyor
 * (DESIGN.md "Card-Grid Refusal"): sekiz eşit ağırlıklı kutu hangi ajanın
 * önemli olduğunu söylemez, sıralı çubuk söyler.
 */
export function BarList({
  data,
  max,
  empty = 'Veri yok.',
}: {
  data: BarDatum[];
  /** Ortak cetvelin üst sınırı; verilmezse en büyük değer. */
  max?: number;
  empty?: string;
}) {
  if (!data.length) return <div className="ub-empty">{empty}</div>;
  const top = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="ub-bars">
      {data.map((d) => (
        <div className={`ub-bar-row${d.active ? ' active' : ''}`} key={d.key} title={`${d.label} · ${d.display}`}>
          <span className="ub-bar-label">
            {d.label}
            {d.note && <span className="ub-bar-note">{d.note}</span>}
          </span>
          <span className="ub-bar-track">
            <span className="ub-bar-fill" style={{ width: `${Math.max(0, (d.value / top) * 100)}%` }} />
          </span>
          <span className="ub-bar-value">{d.display}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ donut

export interface Slice {
  key: string;
  label: string;
  value: number;
  display: string;
}

const TAU = Math.PI * 2;

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const x0 = cx + r * Math.cos(from);
  const y0 = cy + r * Math.sin(from);
  const x1 = cx + r * Math.cos(to);
  const y1 = cy + r * Math.sin(to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Halka — bütün içindeki pay, TEK BAKIŞTA.
 *
 * Neden burada meşru: pay-bütün ilişkisi, ≤6 dilim, değerler birbirine yakın
 * değil ve ortadaki kahraman sayı bütünü söylüyor. (Yakın değerleri
 * karşılaştırmak ya da iki dilim göstermek için halka YANLIŞ olurdu — onlar
 * çubuk ve `StatTile`.)
 *
 * Renk: dilimler BÜYÜKLÜĞE GÖRE sıralı olduğu için tek mürekkebin sıralı
 * basamakları kullanılıyor (koyudan açığa). Rampa burada uydurma bir sıra
 * dayatmıyor, dilimlerin zaten var olan sırasını izliyor. Kimliği yine de
 * rampa değil, yanındaki lejant taşıyor — renk eşleştirmesine mecbur bırakmamak
 * için her dilim lejantta değeriyle yazılı.
 */
export function Donut({
  slices,
  centerValue,
  centerLabel,
  size = 168,
}: {
  slices: Slice[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <div className="ub-empty">Henüz harcama yok.</div>;

  const r = size / 2 - 12;
  const c = size / 2;
  const stroke = 16;
  /* Bitişik dilimleri ayıran şey 2px YÜZEY BOŞLUĞU, çizilmiş bir kenarlık
     değil. Boşluk yay uzunluğundan açıya çevriliyor. */
  const gap = 2 / r;

  let angle = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const span = (s.value / total) * TAU;
    const from = angle + gap / 2;
    const to = angle + span - gap / 2;
    angle += span;
    return { s, from, to: Math.max(from + 0.001, to), step: i };
  });

  return (
    <div className="ub-donut">
      <svg width={size} height={size} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        {arcs.map(({ s, from, to, step }) => (
          <path
            key={s.key}
            d={arc(c, c, r, from, to)}
            fill="none"
            stroke="var(--hud)"
            strokeOpacity={Math.max(0.22, 0.95 - step * 0.15)}
            strokeWidth={stroke}
            strokeLinecap="butt"
          >
            <title>{`${s.label} · ${s.display}`}</title>
          </path>
        ))}
        <text x={c} y={c - 2} className="ub-donut-value" textAnchor="middle">
          {centerValue}
        </text>
        <text x={c} y={c + 14} className="ub-donut-label" textAnchor="middle">
          {centerLabel}
        </text>
      </svg>

      <ul className="ub-legend">
        {arcs.map(({ s, step }) => (
          <li key={s.key}>
            <span
              className="ub-legend-key"
              style={{ background: 'var(--hud)', opacity: Math.max(0.22, 0.95 - step * 0.15) }}
            />
            <span className="ub-legend-name">{s.label}</span>
            <span className="ub-legend-val">{s.display}</span>
            <span className="ub-legend-pct">%{Math.round((s.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- area chart

export interface Point {
  t: number;
  v: number;
  /** İpucu ikinci satırı. */
  note?: string;
}

const DAY = 24 * 3600_000;

/** Eksen ucu: bir güne sığan seride saat, daha uzununda tarih. */
function fmtAxisTime(ts: number, span: number): string {
  const d = new Date(ts);
  return span < DAY
    ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/**
 * Zaman ekseni — kümülatif ya da tur tur.
 *
 * TEK EKSEN: iki farklı büyüklüğü (token ve $) aynı çizime koymak iki y-ölçeği
 * demek olurdu; iki ölçeğin hizası keyfîdir ve olmayan bir bağıntı uydurur.
 * İki büyüklük istendiğinde iki ayrı grafik çizilir.
 *
 * Nişangâh + ipucu varsayılan: HTML bir grafik ZATEN etkileşimli; noktaların
 * tamamını etiketlemek yerine okuyucu istediğini gezerek okur.
 */
export function AreaChart({
  points,
  height = 150,
  fmt,
  label,
}: {
  points: Point[];
  height?: number;
  fmt: (v: number) => string;
  label: string;
}) {
  const [ref, box] = useBox();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="ub-empty">
        Zaman çizgisi için en az iki tur gerekiyor (şu an {points.length}).
      </div>
    );
  }

  const PAD = { l: 46, r: 12, t: 10, b: 20 };
  const W = box.w;
  const H = height;
  const iw = Math.max(10, W - PAD.l - PAD.r);
  const ih = Math.max(10, H - PAD.t - PAD.b);

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const vmax = Math.max(...points.map((p) => p.v)) || 1;

  const x = (t: number) => PAD.l + ((t - t0) / span) * iw;
  const y = (v: number) => PAD.t + ih - (v / vmax) * ih;

  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(t1).toFixed(1)} ${PAD.t + ih} L ${x(t0).toFixed(1)} ${PAD.t + ih} Z`;

  /* Izgara: üç düz hairline. Kesikli çizgi "eşik/projeksiyon" diye okunur. */
  const ticks = [0, 0.5, 1].map((f) => ({ f, v: vmax * f }));

  const hp = hover === null ? null : points[hover];

  return (
    <div className="ub-area" ref={ref} style={{ height: H }}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          // En yakın nokta: hit alanı işaretten büyük olsun diye x'e göre arama.
          let best = 0;
          let bestD = Infinity;
          for (let i = 0; i < points.length; i++) {
            const d = Math.abs(x(points[i].t) - px);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
          setHover(best);
        }}
      >
        {ticks.map((t) => (
          <g key={t.f}>
            <line
              x1={PAD.l}
              x2={PAD.l + iw}
              y1={y(t.v)}
              y2={y(t.v)}
              stroke="var(--edge)"
              strokeWidth={1}
            />
            <text x={PAD.l - 6} y={y(t.v) + 3} className="ub-axis" textAnchor="end">
              {fmt(t.v)}
            </text>
          </g>
        ))}

        <path d={area} fill="rgb(var(--accent-rgb) / 0.10)" />
        <path d={line} fill="none" stroke="var(--hud)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hp && (
          <>
            <line
              x1={x(hp.t)}
              x2={x(hp.t)}
              y1={PAD.t}
              y2={PAD.t + ih}
              stroke="var(--edge-lit)"
              strokeWidth={1}
            />
            {/* 2px yüzey halkası: işaret çizgiyi kestiği yerde de okunur kalsın. */}
            <circle cx={x(hp.t)} cy={y(hp.v)} r={5} fill="var(--hud)" stroke="var(--hull-1)" strokeWidth={2} />
          </>
        )}

        {/* Uçtaki etiketler aralığa göre biçimlenir: tek güne sığan bir seride
            iki ucun da aynı tarihi yazması ekseni ölçüsüz bırakıyordu. */}
        <text x={PAD.l} y={H - 6} className="ub-axis">
          {fmtAxisTime(t0, span)}
        </text>
        <text x={PAD.l + iw} y={H - 6} className="ub-axis" textAnchor="end">
          {fmtAxisTime(t1, span)}
        </text>
      </svg>

      {hp && (
        <div
          className="ub-tip"
          style={{
            left: `${Math.min(Math.max(x(hp.t), PAD.l), W - PAD.r - 120)}px`,
          }}
        >
          <span className="ub-tip-v">{fmt(hp.v)}</span>
          <span className="ub-tip-t">
            {new Date(hp.t).toLocaleString('tr-TR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {hp.note && <span className="ub-tip-n">{hp.note}</span>}
        </div>
      )}
    </div>
  );
}
