/**
 * Gökyüzü — ajan takımyıldızı.
 *
 * Bu panelin tezi: proje durumu bir gösterge tablosu değil, bir gök
 * plakasıdır. Eşlemenin tamamı GERÇEK veriden gelir, hiçbiri süs değildir:
 *
 *   · Yıldız        = ajan
 *   · Kadir (çap)   = o ajanın token ağırlığı (cetvel sağ altta)
 *   · Renk + biçim  = durum. çalışıyor = sıcak mavi-beyaz · boşta = beyaz
 *                     onay bekliyor = kehribar + HALKA (değişken yıldız)
 *                     kapalı = içi boş daire
 *   · Takımyıldız çizgisi = gerçek bir delegasyon (görevdeki assignedBy→assignedTo)
 *   · Ufuk çizgisi  = kapalı ajanlar ufkun ALTINDADIR: gözlenemezler.
 *   · Nişangâh      = "göz altındaki nesne" — seçili ajan, yoksa dikkat
 *                     isteyen ajan.
 *
 * Konumun kendisi anlam taşımaz (gerçek bir atlasta da yıldızın yeri
 * projeksiyon meselesidir); yalnızca KARARLIdır — aynı kadro her açılışta
 * aynı deseni verir, göz deseni ezberleyebilsin diye.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSnapshot, Task } from '../types';
import { ROLE_LABEL, STATUS_LABEL, fmtNum, totalTokens } from '../format';
import { L } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  selectedId: string | null;
  onOpen: (agentId: string) => void;
}

/** Rol sırası: patron merkeze yakın doğar, çalışanlar dışa açılır. */
const ROLE_RANK: Record<string, number> = { boss: 0, manager: 1, 'team-leader': 2, worker: 3 };

/** Ajan kimliğinden kararlı bir 0..1 sayısı — düzen her açılışta aynı olsun. */
function hash01(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

interface Placed {
  a: AgentSnapshot;
  x: number;
  y: number;
  r: number;
  tok: number;
}

export function Sky({ agents, tasks, selectedId, onOpen }: Props) {
  /**
   * Plaka gerçek piksel ölçüsünde çizilir (viewBox ölçeklemesi DEĞİL).
   * Ölçekleseydik etiketler kutuyla birlikte büyür/küçülürdü ve dar pencerede
   * ad yazıları devleşirdi; ayrıca `slice` ufuk çizgisini kırpıyordu.
   */
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1000, h: 420 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setBox({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H } = { W: box.w, H: box.h };

  const { visible, below, links, focusId, bands } = useMemo(() => {
    const up = agents.filter((a) => a.status !== 'offline');
    const down = agents.filter((a) => a.status === 'offline');

    const maxTok = Math.max(1, ...agents.map((a) => totalTokens(a.usage)));

    /* Görünür gökyüzü: altın açı spirali + kimliğe bağlı kararlı sapma.
       Düzgün bir çember "radyal menü" gibi okunur; spiral doğal dağılır. */
    const sorted = [...up].sort(
      (a, b) =>
        (ROLE_RANK[a.config.role] ?? 3) - (ROLE_RANK[b.config.role] ?? 3) ||
        a.config.id.localeCompare(b.config.id),
    );
    const n = Math.max(sorted.length, 1);
    const visible: Placed[] = sorted.map((a, i) => {
      const t = (i + 0.35) / n;
      const rad = Math.sqrt(t) * 0.84 + hash01(a.config.id, 7) * 0.07;
      const ang = i * 2.39996 + hash01(a.config.id, 13) * 0.9;
      const tok = totalTokens(a.usage);
      return {
        a,
        x: W / 2 + Math.cos(ang) * rad * (W / 2 - 150),
        y: H / 2 + Math.sin(ang) * rad * (H / 2 - 52),
        r: 4 + Math.sqrt(tok / maxTok) * 8,
        tok,
      };
    });

    /* Ufkun altı SVG'de DEĞİL: adlar farklı uzunlukta ve sabit adımla
       yerleştirilince birbirine biniyordu. Akıştaki bir şerit (HTML) hem
       sarmalanır hem hiç çakışmaz. */
    const below = down;

    /**
     * ROL BANTLARI — plakanın ölçeği.
     *
     * Izgara eskiden etiketsiz üç dikey + iki yatay çizgiydi: hiçbir şey
     * ölçmüyordu, yani jenerik bir dashboard ızgarasıydı. Uydurma RA/DEC
     * yazmak da olmazdı (var olmayan bir veriyi ilan etmek). Bunun yerine
     * halkalar KONUMUN ZATEN TAŞIDIĞI anlamı etiketler: yerleşim role göre
     * sıralı, yarıçap rol sırasıyla büyüyor. Halka "bu çemberin içi patron,
     * dışı çalışanlar" der ve bu doğrudur.
     */
    const bandList: { rx: number; ry: number; label: string }[] = [];
    let seenCount = 0;
    for (const role of ['boss', 'manager', 'team-leader', 'worker'] as const) {
      const count = sorted.filter((a) => a.config.role === role).length;
      if (!count) continue;
      seenCount += count;
      // En dış grubun halkası da çizilir: tek rol varsa plaka yine ölçekli
      // görünsün. Aksi halde tek ajanla gökyüzü boş bir dikdörtgene düşüyordu.
      const t = Math.min((seenCount + 0.35) / n, 1);
      const rad = Math.min(Math.sqrt(t) * 0.84, 0.92);
      bandList.push({
        rx: rad * (W / 2 - 150),
        ry: rad * (H / 2 - 52),
        label: ROLE_LABEL[role] ?? role,
      });
    }

    /* Takımyıldız çizgileri: yalnızca gerçekten olmuş delegasyonlar. */
    const pos = new Map(visible.map((p) => [p.a.config.id, p]));
    const seen = new Set<string>();
    const links: { x1: number; y1: number; x2: number; y2: number; live: boolean }[] = [];
    for (const t of tasks) {
      if (!t.assignedBy || t.assignedBy === t.assignedTo) continue;
      const from = pos.get(t.assignedBy);
      const to = pos.get(t.assignedTo);
      if (!from || !to) continue;
      const live = t.status === 'running';
      const key = `${t.assignedBy}>${t.assignedTo}${live ? '!' : ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, live });
    }

    /* Göz altındaki nesne: seçili ajan; yoksa dikkat isteyen; yoksa en ağır çalışan. */
    const attention =
      visible.find((p) => p.a.config.id === selectedId) ??
      visible.find((p) => p.a.pendingPermissions.length > 0) ??
      visible.find((p) => p.a.status === 'waiting') ??
      [...visible].filter((p) => p.a.status === 'working').sort((x, y) => y.tok - x.tok)[0];

    return { visible, below, links, focusId: attention?.a.config.id ?? null, bands: bandList };
  }, [agents, tasks, selectedId, W, H]);

  if (agents.length === 0) {
    return (
      <div className="sky">
        <div className="sky-field" ref={boxRef}>
          <div className="sky-empty">
            <h2>{L.sky.emptyTitle}</h2>
            <p>
              {L.sky.emptyA}<strong>{L.sky.boss}</strong>{L.sky.emptyB}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sky">
     <div className="sky-field" ref={boxRef}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={L.sky.aria(visible.length, below.length)}>
        {/* Rol bantları — plakanın ölçeği; her halka etiketlidir */}
        <g className="sky-band">
          {bands.map((b) => (
            <g key={b.label}>
              <ellipse cx={W / 2} cy={H / 2} rx={b.rx} ry={b.ry} />
              <text className="sky-band-label" x={W / 2} y={H / 2 - b.ry - 7} textAnchor="middle">
                {b.label.toLocaleUpperCase('tr')}
              </text>
            </g>
          ))}
        </g>

        {/* takımyıldız çizgileri — yıldızların ALTINDA çizilir */}
        <g>
          {links.map((l, i) => (
            <line key={i} className={`sky-link${l.live ? ' live' : ''}`}
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
        </g>

        {visible.map((p) => {
          const id = p.a.config.id;
          const st = p.a.status;
          const color =
            st === 'working' ? 'var(--aux)'
            : st === 'waiting' ? 'var(--caution)'
            : st === 'idle' ? 'var(--fg)'
            : 'transparent';
          const flipped = p.x > W * 0.72;
          return (
            <g
              key={id}
              className={`sky-star${selectedId === id ? ' sel' : ''}`}
              onClick={() => onOpen(id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(id);
                }
              }}
              aria-label={`${p.a.config.name} — ${STATUS_LABEL[st]}`}
            >
              {/* hale: yalnızca yanan yıldızda; kapalıda yok */}
              {st !== 'offline' && (
                <circle className="halo" cx={p.x} cy={p.y} r={p.r * 2.6} fill={color} opacity="0.14" />
              )}
              {/* değişken yıldız halkası = onay bekliyor (renkten bağımsız işaret) */}
              {st === 'waiting' && (
                <circle className="ring" cx={p.x} cy={p.y} r={p.r + 4}
                        fill="none" stroke="var(--caution)" strokeWidth="1" opacity="0.85" />
              )}
              <circle
                className="body"
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={color}
                stroke={st === 'offline' ? 'var(--inert)' : 'none'}
                strokeWidth="1"
              />
              {focusId === id && (
                <g className="sky-reticle">
                  <circle cx={p.x} cy={p.y} r={p.r + 13} strokeDasharray="3 5" />
                  <line x1={p.x - p.r - 20} y1={p.y} x2={p.x - p.r - 9} y2={p.y} />
                  <line x1={p.x + p.r + 9} y1={p.y} x2={p.x + p.r + 20} y2={p.y} />
                  <line x1={p.x} y1={p.y - p.r - 20} x2={p.x} y2={p.y - p.r - 9} />
                  <line x1={p.x} y1={p.y + p.r + 9} x2={p.x} y2={p.y + p.r + 20} />
                </g>
              )}
              <text
                className="sky-star-label"
                x={flipped ? p.x - p.r - 9 : p.x + p.r + 9}
                y={p.y + 3}
                textAnchor={flipped ? 'end' : 'start'}
              >
                {p.a.config.name}
              </text>
              <text
                className="sky-star-sub"
                x={flipped ? p.x - p.r - 9 : p.x + p.r + 9}
                y={p.y + 16}
                textAnchor={flipped ? 'end' : 'start'}
              >
                {STATUS_LABEL[st]} · {fmtNum(p.tok)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Gözlenebilir gökyüzü boşsa bunu söyle — boş bir dikdörtgen
          "veri gelmedi mi, herkes mi kapalı?" sorusunu açıkta bırakır. */}
      {visible.length === 0 && (
        <p className="sky-none">
          {L.sky.none}
        </p>
      )}

      {/* kadir cetveli: nokta çapının ne söylediğini açıklar */}
      {visible.length > 0 && (
        <div className="mag-legend">
          <span className="mag-legend-title">{L.extra.magnitude}</span>
          <div className="mag-legend-scale">
            {[10, 7.5, 5.5, 4].map((r, i) => (
              <span className="mag-legend-step" key={r}>
                <span className="mag-legend-dot" style={{ width: r * 1.6, height: r * 1.6 }} />
                <span>{[L.sky.many, '', '', L.sky.few][i]}</span>
              </span>
            ))}
          </div>
        </div>
      )}
     </div>

      {/* Ufuk altı: kapalı ajanlar. Gözlenemezler ama vardırlar. */}
      {below.length > 0 && (
        <div className="sky-below">
          <span className="sky-below-label">{L.sky.below}</span>
          {below.map((a) => (
            <button
              key={a.config.id}
              type="button"
              className="sky-below-item"
              onClick={() => onOpen(a.config.id)}
              title={L.sky.offlineTitle(a.config.name)}
            >
              <span className="led led-offline" />
              {a.config.name}
              <span className="sky-below-tok">{fmtNum(totalTokens(a.usage))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
