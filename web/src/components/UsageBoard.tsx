import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { fmtCost, fmtNum, totalTokens } from '../format';
import { AreaChart, BarList, Donut, Meter, StatTile, type BarDatum, type Point } from './charts';
import type {
  AgentSnapshot,
  BudgetState,
  ContextUsageInfo,
  UsageHistoryResponse,
  UsageSummary,
} from '../types';

/**
 * Harcama panosu.
 *
 * ÜÇ AYRI ZAMAN KİPİ var ve karıştırılmaları en tehlikeli hata olurdu:
 *
 *  · **Tümel toplam** (`usage.json`) — zamansız sayaç, açılışta diskten gelir.
 *    "Bugüne kadar ne harcandı" yalnızca budur.
 *  · **Bugünkü pencere** (`budget`) — yerel gece yarısında sıfırlanır. Sınır
 *    denetimi buna bakar.
 *  · **Tur geçmişi** (`usage-history.json`) — zaman damgalı, ama KAYDIN
 *    BAŞLADIĞI ANDAN itibaren. Eski toplamlar tur tur bölünemez.
 *
 * Bu yüzden zaman eksenli her grafik kendi toplamını "kayıt başlangıcından
 * beri" diye etiketler; üstteki kahraman sayı ise tümel toplamdır. İkisi
 * farklı olduğunda bu bir tutarsızlık değil, iki ayrı sorunun iki ayrı cevabı —
 * panoda açıkça yazılı.
 */

type Range = 'today' | 'week' | 'all';
type Metric = 'cost' | 'tokens';

const RANGE_LABEL: Record<Range, string> = { today: 'Bugün', week: '7 gün', all: 'Tümü' };

interface RateWindow {
  utilization?: number;
  resets_at?: string;
}
interface PlanUsage {
  rate_limits_available?: boolean;
  rate_limits?: Record<string, RateWindow | null>;
}

const WINDOW_LABEL: Record<string, string> = {
  five_hour: '5 saatlik pencere',
  seven_day: '7 günlük pencere',
  seven_day_opus: '7 günlük · Opus',
  seven_day_sonnet: '7 günlük · Sonnet',
};

function fmtReset(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `sıfırlanma ${d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * SDK'nın bağlam dökümünde TÜKETİM OLMAYAN satırlar (boş alan ve otomatik-özet
 * için ayrılmış tampon). Adlar SDK'dan geldiği gibi İngilizce; SDK bunları
 * yeniden adlandırırsa süzgeç sessizce boşa düşer ve satırlar geri gelir —
 * yanlış bir sayı üretmez, yalnızca ölçek yeniden bozulur.
 */
const HEADROOM = new Set(['Free space', 'Autocompact buffer']);

/** Yolun son iki parçası — tam yol satırı taşırıyor, başı ise ayırt etmiyor. */
function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length <= 2 ? p : `…/${parts.slice(-2).join('/')}`;
}

interface Props {
  /** Seçili takımın ajanları — pano da takım kapsamına uyar. */
  agents: AgentSnapshot[];
  usage: UsageSummary | null;
  budget: BudgetState | null;
}

export function UsageBoard({ agents, usage, budget }: Props) {
  const [range, setRange] = useState<Range>('all');
  const [metric, setMetric] = useState<Metric>('cost');
  const [history, setHistory] = useState<UsageHistoryResponse | null>(null);
  const [plan, setPlan] = useState<PlanUsage | null>(null);
  const [contexts, setContexts] = useState<Record<string, ContextUsageInfo>>({});
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => agents.map((a) => a.config.id).join(','), [agents]);
  const live = useMemo(() => agents.filter((a) => a.status !== 'offline'), [agents]);
  const liveIds = useMemo(() => live.map((a) => a.config.id).join(','), [live]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [h, detail] = await Promise.all([
        api.usageHistory().catch(() => null),
        api.usageDetail().catch(() => null),
      ]);
      if (h) setHistory(h);
      if (detail) setPlan(detail.plan as PlanUsage);

      /* Bağlam dökümü ajan başına AYRI bir kontrol isteği; yalnızca AÇIK
         ajanlardan okunabiliyor. Paralel istenir, biri düşerse diğerleri durur. */
      const open = liveIds ? liveIds.split(',') : [];
      const results = await Promise.all(
        open.map(async (id) => [id, (await api.inspect(id, ['context']).catch(() => null))?.context] as const),
      );
      const next: Record<string, ContextUsageInfo> = {};
      for (const [id, ctx] of results) if (ctx) next[id] = ctx;
      setContexts(next);
    } finally {
      setBusy(false);
    }
  }, [liveIds]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tümel toplam WS ile taze geliyor; geçmiş ve bağlam ancak istenince.
  // Yeni tur geldiğinde (toplam maliyet değişince) sessizce tazele.
  const costKey = usage?.total.costUSD ?? 0;
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costKey]);

  // ------------------------------------------------------------- türetmeler

  const scoped = useMemo(() => {
    const set = new Set(ids ? ids.split(',') : []);
    const from =
      range === 'today'
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : range === 'week'
          ? Date.now() - 7 * 24 * 3600_000
          : 0;
    return (history?.turns ?? []).filter((t) => set.has(t.agentId) && t.ts >= from);
  }, [history, ids, range]);

  /** Kümülatif seri — tek eksen, seçilen büyüklük. */
  const series = useMemo<Point[]>(() => {
    let acc = 0;
    return scoped.map((t) => {
      acc += metric === 'cost'
        ? t.costUSD
        : t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheCreationTokens;
      return {
        t: t.ts,
        v: acc,
        note: `${t.agentId} · ${t.model}`,
      };
    });
  }, [scoped, metric]);

  /** Ajan başına TÜMEL maliyet payı (halka bunu gösterir). */
  const agentSlices = useMemo(() => {
    const rows = agents
      .map((a) => ({
        key: a.config.id,
        label: a.config.name,
        value: usage?.perAgent[a.config.id]?.costUSD ?? 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);

    // ≤6 dilim: kuyruk "Diğer"e katlanır. Yedinci bir dilim üretmek yerine
    // katlamak bilinçli — yakın küçük dilimler halkada zaten okunmuyor.
    if (rows.length <= 6) return rows.map((r) => ({ ...r, display: fmtCost(r.value) }));
    const head = rows.slice(0, 5);
    const tail = rows.slice(5);
    return [
      ...head.map((r) => ({ ...r, display: fmtCost(r.value) })),
      {
        key: '__other',
        label: `Diğer (${tail.length})`,
        value: tail.reduce((s, r) => s + r.value, 0),
        display: fmtCost(tail.reduce((s, r) => s + r.value, 0)),
      },
    ];
  }, [agents, usage]);

  /** Model başına maliyet — yalnızca geçmişten türetilebilir. */
  const modelBars = useMemo<BarDatum[]>(() => {
    const by = new Map<string, { cost: number; turns: number }>();
    for (const t of scoped) {
      const cur = by.get(t.model) ?? { cost: 0, turns: 0 };
      cur.cost += t.costUSD;
      cur.turns += 1;
      by.set(t.model, cur);
    }
    return [...by.entries()]
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([model, v]) => ({
        key: model,
        label: model,
        value: v.cost,
        display: fmtCost(v.cost),
        note: `${v.turns} tur`,
      }));
  }, [scoped]);

  /**
   * Bağlam kategorileri — açık ajanların toplamı.
   *
   * "Free space" ve "Autocompact buffer" DIŞARIDA: ikisi de tüketim değil,
   * ARTAKALAN. İçeride bırakılınca boş alan (1.9M) ortak cetveli tek başına
   * dolduruyor ve gerçek tüketicilerin hepsi ölçülemez bir tırnağa iniyor —
   * yani bölümün sorduğu soruyu ("bağlam nereye gidiyor") görünmez kılıyor.
   * Boş/dolu oranı zaten hemen altındaki ajan başına göstergelerde.
   */
  const contextBars = useMemo<BarDatum[]>(() => {
    const by = new Map<string, number>();
    for (const ctx of Object.values(contexts)) {
      for (const c of ctx.categories) {
        if (HEADROOM.has(c.name)) continue;
        by.set(c.name, (by.get(c.name) ?? 0) + c.tokens);
      }
    }
    return [...by.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, tokens]) => ({
        key: name,
        label: name,
        value: tokens,
        display: `${fmtNum(tokens)} tok`,
      }));
  }, [contexts]);

  /**
   * DOSYA dökümü. Bu panonun tek "hangi dosya kaç token" kaynağı ve gerçekten
   * ölçülmüş: bağlama yüklenmiş kural/hafıza dosyaları. Aynı dosya birden fazla
   * ajanda yüklüyse maliyeti de o kadar tekrarlanır, bu yüzden TOPLANIR ve kaç
   * ajanda yüklü olduğu yazılır.
   */
  const fileBars = useMemo<BarDatum[]>(() => {
    const by = new Map<string, { tokens: number; agents: number }>();
    for (const ctx of Object.values(contexts)) {
      for (const f of ctx.memoryFiles) {
        const cur = by.get(f.path) ?? { tokens: 0, agents: 0 };
        cur.tokens += f.tokens;
        cur.agents += 1;
        by.set(f.path, cur);
      }
    }
    return [...by.entries()]
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .slice(0, 12)
      .map(([p, v]) => ({
        key: p,
        label: shortPath(p),
        value: v.tokens,
        display: `${fmtNum(v.tokens)} tok`,
        note: v.agents > 1 ? `${v.agents} ajanda yüklü` : undefined,
      }));
  }, [contexts]);

  /** MCP sunucusu başına şema maliyeti — araçların sessiz bağlam vergisi. */
  const toolBars = useMemo<BarDatum[]>(() => {
    const by = new Map<string, { tokens: number; tools: number }>();
    for (const ctx of Object.values(contexts)) {
      for (const t of ctx.mcpTools) {
        const cur = by.get(t.serverName) ?? { tokens: 0, tools: 0 };
        cur.tokens += t.tokens;
        cur.tools += 1;
        by.set(t.serverName, cur);
      }
    }
    return [...by.entries()]
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([name, v]) => ({
        key: name,
        label: name,
        value: v.tokens,
        display: `${fmtNum(v.tokens)} tok`,
        note: `${v.tools} araç`,
      }));
  }, [contexts]);

  const planWindows = useMemo(() => {
    const raw = plan?.rate_limits ? Object.entries(plan.rate_limits) : [];
    return raw.filter((e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number');
  }, [plan]);

  // ----------------------------------------------------------------- toplam
  const total = usage?.total;
  const rangeCost = scoped.reduce((s, t) => s + t.costUSD, 0);
  const rangeTokens = scoped.reduce(
    (s, t) => s + t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheCreationTokens,
    0,
  );
  /** Önbellekten okunan pay — pahalı olmayan token'ların oranı. */
  const cacheShare = total && totalTokens(total) > 0
    ? (total.cacheReadTokens / totalTokens(total)) * 100
    : 0;

  if (!total) return <div className="ub-empty">Kullanım verisi yükleniyor…</div>;

  return (
    <div className="ub">
      {/* ---------------------------------------------------------- başlık */}
      <div className="ub-head">
        <h2 className="ub-title">Harcama</h2>
        <div className="ub-range" role="group" aria-label="Zaman aralığı">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <button className="ub-refresh" onClick={() => void load()} disabled={busy}>
          {busy ? 'okunuyor…' : 'tazele'}
        </button>
      </div>

      {/* ------------------------------------------------------ kahraman + kpi */}
      <div className="ub-tiles">
        <StatTile
          hero
          label="Toplam maliyet"
          value={fmtCost(total.costUSD)}
          sub={`${total.requests} tur · tüm zamanlar`}
        />
        <StatTile label="Toplam token" value={fmtNum(totalTokens(total))} sub={`%${Math.round(cacheShare)} önbellekten`} />
        <StatTile
          label="Bugün"
          value={fmtCost(budget?.spentUSD ?? 0)}
          sub={budget?.limitUSD ? `sınır ${fmtCost(budget.limitUSD)}` : 'sınır yok'}
          tone={budget?.exceeded ? 'alarm' : budget?.warn ? 'warn' : 'neutral'}
        />
        <StatTile
          label={`Seçili aralık · ${RANGE_LABEL[range]}`}
          value={fmtCost(rangeCost)}
          sub={`${scoped.length} tur · ${fmtNum(rangeTokens)} tok`}
        />
        <StatTile
          label="Açık ajan"
          value={`${live.length}/${agents.length}`}
          sub={live.length ? live.map((a) => a.config.name).slice(0, 3).join(', ') : 'hiçbiri çalışmıyor'}
        />
      </div>

      {/* --------------------------------------------------------- ne kaldı */}
      <section className="ub-sec">
        <h3>Ne kadar kaldı</h3>
        <div className="ub-meters">
          <Meter
            label="Günlük bütçe"
            pct={budget?.pct ?? null}
            value={budget?.limitUSD ? `${fmtCost(budget.spentUSD)} / ${fmtCost(budget.limitUSD)}` : fmtCost(budget?.spentUSD ?? 0)}
            note={budget?.limitUSD ? `${fmtCost(Math.max(0, budget.limitUSD - budget.spentUSD))} kaldı` : 'Ayarlar\'dan sınır koyabilirsin'}
          />
          {planWindows.map(([key, win]) => (
            <Meter
              key={key}
              label={WINDOW_LABEL[key] ?? key}
              pct={win.utilization ?? 0}
              value={`%${win.utilization}`}
              note={fmtReset(win.resets_at) || `%${100 - (win.utilization ?? 0)} kaldı`}
            />
          ))}
          {!planWindows.length && (
            <div className="ub-note">
              Hesap plan kotası okunamadı — en az bir ajanın çalışıyor olması gerekiyor.
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- zaman */}
      <section className="ub-sec">
        <h3>Zaman içinde</h3>
        <div className="ub-sec-tools">
          <div className="ub-range" role="group" aria-label="Büyüklük">
            <button className={metric === 'cost' ? 'on' : ''} onClick={() => setMetric('cost')}>
              maliyet
            </button>
            <button className={metric === 'tokens' ? 'on' : ''} onClick={() => setMetric('tokens')}>
              token
            </button>
          </div>
          <span className="ub-note">
            kümülatif · kayıt başlangıcı{' '}
            {history ? new Date(history.since).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '—'}
          </span>
        </div>
        <AreaChart
          points={series}
          fmt={metric === 'cost' ? fmtCost : fmtNum}
          label={`Kümülatif ${metric === 'cost' ? 'maliyet' : 'token'}`}
        />
      </section>

      {/* ------------------------------------------------------- kim harcadı */}
      <section className="ub-sec">
        <h3>Kim harcadı</h3>
        <Donut
          slices={agentSlices}
          centerValue={fmtCost(total.costUSD)}
          centerLabel="tüm zamanlar"
        />
      </section>

      {/* ------------------------------------------------------------ model */}
      <section className="ub-sec">
        <h3>Model başına</h3>
        <BarList
          data={modelBars}
          empty={`Seçili aralıkta (${RANGE_LABEL[range]}) tur yok.`}
        />
      </section>

      {/* ----------------------------------------------------------- bağlam */}
      <section className="ub-sec">
        <h3>Bağlam penceresi nereye gidiyor</h3>
        <span className="ub-note">
          {live.length
            ? `${Object.keys(contexts).length} açık ajanın toplamı · her yeni tur bunun tamamını yeniden okur.
               Boş alan ve otomatik-özet tamponu hariç — onlar tüketim değil artakalan; doluluk aşağıda.`
            : 'Bağlam dökümü yalnızca açık ajanlardan okunur.'}
        </span>
        <BarList data={contextBars} empty="Açık ajan yok." />

        {live.length > 0 && (
          <div className="ub-fills">
            {live.map((a) => {
              const c = contexts[a.config.id];
              return (
                <Meter
                  key={a.config.id}
                  label={a.config.name}
                  pct={c ? c.percentage : null}
                  value={c ? `${fmtNum(c.totalTokens)} / ${fmtNum(c.maxTokens)}` : '—'}
                  note={c ? `${fmtNum(c.maxTokens - c.totalTokens)} tok yer kaldı` : 'okunamadı'}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- dosya */}
      <section className="ub-sec">
        <h3>En çok token yiyen dosyalar</h3>
        <span className="ub-note">
          Bağlama yüklenmiş kural ve hafıza dosyaları. Bir araç çağrısının (ör. bir
          Read'in) kaç token götürdüğü hiçbir yerde dosyaya atfedilmiyor — o sayı
          uydurulamayacağı için burada yok.
        </span>
        <BarList data={fileBars} empty="Açık ajan yok ya da bağlama dosya yüklenmemiş." />
      </section>

      {/* ------------------------------------------------------------- MCP */}
      {toolBars.length > 0 && (
        <section className="ub-sec">
          <h3>MCP sunucularının bağlam vergisi</h3>
          <span className="ub-note">Araç şemaları her turda bağlamda duruyor.</span>
          <BarList data={toolBars} />
        </section>
      )}

      {/* ----------------------------------------------------------- tablo */}
      <section className="ub-sec">
        <h3>Ajan başına tam döküm</h3>
        <div className="ub-table-wrap">
          <table className="ub-table">
            <thead>
              <tr>
                <th>Ajan</th>
                <th className="num">Girdi</th>
                <th className="num">Çıktı</th>
                <th className="num">Önbellek</th>
                <th className="num">Tur</th>
                <th className="num">Maliyet</th>
                <th className="num">Bugün</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const u = usage?.perAgent[a.config.id];
                const today = budget?.perAgentUSD[a.config.id] ?? 0;
                return (
                  <tr key={a.config.id}>
                    <td>
                      <span className={`led led-${a.status}`} /> {a.config.name}
                    </td>
                    <td className="num">{fmtNum(u?.inputTokens ?? 0)}</td>
                    <td className="num">{fmtNum(u?.outputTokens ?? 0)}</td>
                    <td className="num">{fmtNum((u?.cacheReadTokens ?? 0) + (u?.cacheCreationTokens ?? 0))}</td>
                    <td className="num">{u?.requests ?? 0}</td>
                    <td className="num">{fmtCost(u?.costUSD ?? 0)}</td>
                    <td className="num">{today > 0 ? fmtCost(today) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Toplam</td>
                <td className="num">{fmtNum(total.inputTokens)}</td>
                <td className="num">{fmtNum(total.outputTokens)}</td>
                <td className="num">{fmtNum(total.cacheReadTokens + total.cacheCreationTokens)}</td>
                <td className="num">{total.requests}</td>
                <td className="num">{fmtCost(total.costUSD)}</td>
                <td className="num">{fmtCost(budget?.spentUSD ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
