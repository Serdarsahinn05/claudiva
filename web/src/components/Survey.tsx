/**
 * Genel Durum plakası — panelin ilk görüntüsü.
 *
 * Ürün ilkesi: "Panelin ilk işi durum bildirmektir." Bu yüzden plakanın en
 * büyük tipografisi bir başlık değil, o anki DURUM CÜMLESİdir; onun altında
 * gökyüzü (ajan takımyıldızı), sağ kenarda efemeris okumaları durur.
 */
import { useEffect, useState } from 'react';
import type { AgentSnapshot, BudgetState, SystemInfo, Task, UsageSummary } from '../types';
import { api } from '../api';
import { fmtCost, fmtNum, totalTokens } from '../format';
import { Sky } from './Sky';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  usage: UsageSummary | null;
  budget: BudgetState | null;
  projectDir: string;
  selectedId: string | null;
  onOpenSettings: () => void;
  onOpenAgent: (id: string) => void;
}

/** Plan kotası penceresi (GET /api/usage/detail içindeki rate_limits). */
interface RateWindow {
  utilization?: number;
  resets_at?: string;
}

const WINDOW_LABEL: Record<string, string> = {
  five_hour: '5 saatlik',
  seven_day: '7 günlük',
  seven_day_opus: '7g Opus',
  seven_day_sonnet: '7g Sonnet',
};

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}g ${h}s`;
  if (h) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function fmtReset(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Kenar okuması: vermilyon etiket + hairline cetvel. */
function Mod({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <section
      className={`eph-mod${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <span className="eph-mod-head">{label}</span>
      {children}
    </section>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'hud' | 'warn' | 'alarm' }) {
  return (
    <div className="bstat">
      <span className="bstat-k">{k}</span>
      <span className={`bstat-v${tone ? ` t-${tone}` : ''}`}>{v}</span>
    </div>
  );
}

function Gauge({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  const tone = pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : '';
  return (
    <div className="bgauge">
      <div className="bgauge-head">
        <span>{label}</span>
        <span className="bgauge-pct">%{Math.round(pct)}</span>
      </div>
      <div className={`gauge ${tone}`}>
        <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {sub && <div className="bgauge-sub">{sub}</div>}
    </div>
  );
}

/**
 * Durum cümlesi. Sıra önem sırasıdır: önce seni bekleyen şey, sonra süren
 * iş, sonra hazır bekleyiş. Vurgulanan (em) parça sayının kendisidir.
 */
function phrase(
  agents: AgentSnapshot[],
  tasks: Task[],
  budget: BudgetState | null,
): { lead: string; count: string; tail: string } {
  const waiting = agents.filter((a) => a.pendingPermissions.length > 0).length;
  const working = agents.filter((a) => a.status === 'working').length;
  const active = agents.filter((a) => a.status !== 'offline').length;
  const running = tasks.filter((t) => t.status === 'running').length;

  if (agents.length === 0) return { lead: '', count: 'Ekip henüz kurulmadı', tail: '.' };
  if (budget?.exceeded) return { lead: 'Günlük bütçe doldu — ', count: 'yeni iş kabul edilmiyor', tail: '.' };
  if (waiting > 0) return { lead: '', count: `${waiting} ajan`, tail: ' onayını bekliyor.' };
  if (working > 0)
    return {
      lead: '',
      count: `${working} ajan`,
      tail: running > 0 ? ` çalışıyor, ${running} görev sürüyor.` : ' çalışıyor.',
    };
  if (running > 0) return { lead: '', count: `${running} görev`, tail: ' sırada bekliyor.' };
  if (active > 0) return { lead: '', count: `${active} ajan`, tail: ' hazır, iş bekliyor.' };
  return { lead: '', count: 'Bütün ajanlar kapalı', tail: '.' };
}

export function Survey({
  agents,
  tasks,
  usage,
  budget,
  projectDir,
  selectedId,
  onOpenAgent,
  onOpenSettings,
}: Props) {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [plan, setPlan] = useState<Record<string, RateWindow | null> | null>(null);
  const [planAvailable, setPlanAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const s = await api.system().catch(() => null);
      if (alive && s) setSys(s);
      const d = await api.usageDetail().catch(() => null);
      if (!alive || !d) return;
      const p = d.plan as {
        rate_limits_available?: boolean;
        rate_limits?: Record<string, RateWindow | null>;
      } | null;
      setPlanAvailable(Boolean(p?.rate_limits_available));
      setPlan(p?.rate_limits ?? null);
    }
    void load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const active = agents.filter((a) => a.status !== 'offline').length;

  const memUsedPct = sys ? ((sys.host.memTotal - sys.host.memFree) / sys.host.memTotal) * 100 : 0;
  const planWindows = plan
    ? Object.entries(plan).filter((e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number')
    : [];

  const p = phrase(agents, tasks, budget);

  return (
    <div className="survey">
      <div className="phase">
        <h2 className="phase-line">
          {p.lead}
          <em>{p.count}</em>
          {p.tail}
        </h2>
        <div className="phase-sub">
          <b>{active}</b>/{agents.length} ajan açık · <b>{running}</b> görev çalışıyor · <b>{pending}</b> sırada ·{' '}
          <b>{done}</b> bitti
          {budget && ` · bugün ${fmtCost(budget.spentUSD)}`}
        </div>
      </div>

      <div className="survey-body">
        <Sky agents={agents} tasks={tasks} selectedId={selectedId} onOpen={onOpenAgent} />

        <div className="eph">
          <Mod label="Günlük bütçe" onClick={onOpenSettings}>
            {budget && budget.limitUSD ? (
              <>
                <Gauge
                  pct={budget.pct ?? 0}
                  label={`${fmtCost(budget.spentUSD)} / $${budget.limitUSD.toFixed(2)}`}
                  sub={
                    budget.exceeded
                      ? 'sınır aşıldı — yeni iş kabul edilmiyor'
                      : `sıfırlanma: gece yarısı (${budget.date})`
                  }
                />
                {budget.exceeded && <Stat k="Durum" v="KİLİTLİ" tone="alarm" />}
                {!budget.exceeded && budget.warn && <Stat k="Durum" v="eşiğe yakın" tone="warn" />}
              </>
            ) : (
              <>
                {budget && <Stat k="Bugün harcanan" v={fmtCost(budget.spentUSD)} />}
                <div className="bgauge-sub">Sınır tanımlı değil — sınır koymak için tıkla</div>
              </>
            )}
          </Mod>

          <Mod label="Plan kotası">
            {planWindows.length ? (
              planWindows.map(([k, w]) => (
                <Gauge
                  key={k}
                  label={WINDOW_LABEL[k] ?? k}
                  pct={w.utilization!}
                  sub={w.resets_at ? `sıfırlanma ${fmtReset(w.resets_at)}` : undefined}
                />
              ))
            ) : (
              <div className="bgauge-sub">
                {planAvailable ? 'Kota penceresi yok.' : 'Kota okunamıyor — en az bir ajan çalışmalı.'}
              </div>
            )}
          </Mod>

          <Mod label="Token">
            {usage ? (
              <>
                <Stat k="Toplam" v={fmtNum(totalTokens(usage.total))} />
                <Stat k="Maliyet" v={fmtCost(usage.total.costUSD)} />
                <Stat k="Giriş" v={fmtNum(usage.total.inputTokens)} />
                <Stat k="Çıkış" v={fmtNum(usage.total.outputTokens)} />
                <Stat k="Önbellek" v={fmtNum(usage.total.cacheReadTokens)} />
                <Stat k="İstek" v={String(usage.total.requests)} />
              </>
            ) : (
              <div className="bgauge-sub">Veri yok.</div>
            )}
          </Mod>
        </div>
      </div>

      <div className="survey-foot">
        <Mod label="Proje">
          {sys ? (
            <>
              <Stat k="Ad" v={sys.project.name} />
              <Stat k="Dal" v={sys.project.gitBranch ?? '—'} />
              <Stat k="Dosya" v={`${fmtNum(sys.project.fileCount)}${sys.project.truncated ? '+' : ''}`} />
              <Stat k="Boyut" v={fmtBytes(sys.project.sizeBytes)} />
              <div className="bridge-path" title={projectDir}>
                {sys.project.dir}
              </div>
            </>
          ) : (
            <div className="bgauge-sub">Taranıyor…</div>
          )}
        </Mod>

        <Mod label="Sistem">
          {sys ? (
            <>
              <Gauge
                label="Bellek"
                pct={memUsedPct}
                sub={`${fmtBytes(sys.host.memTotal - sys.host.memFree)} / ${fmtBytes(sys.host.memTotal)}`}
              />
              <Stat k="İşlemci" v={`${sys.host.cpuCount} çekirdek`} />
              <Stat k="Platform" v={`${sys.host.platform} ${sys.host.arch}`} />
              <Stat k="Açık kalma" v={fmtUptime(sys.host.uptimeSec)} />
              <div className="bridge-cpu" title={sys.host.cpuModel}>
                {sys.host.cpuModel}
              </div>
            </>
          ) : (
            <div className="bgauge-sub">Okunuyor…</div>
          )}
        </Mod>

        <Mod label="Çalışma zamanı">
          {sys ? (
            <>
              <Stat k="Agent SDK" v={sys.claude.sdkVersion} />
              <Stat k="Node" v={sys.host.nodeVersion} />
              <Stat k="Ajan tanımı" v={agents.length ? `${agents.length} tanım` : '—'} />
              <div className="bridge-path" title={sys.claude.teamDir}>
                {sys.claude.teamDir}
              </div>
            </>
          ) : (
            <div className="bgauge-sub">Okunuyor…</div>
          )}
        </Mod>
      </div>
    </div>
  );
}
