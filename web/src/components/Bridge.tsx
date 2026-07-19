import { useEffect, useState } from 'react';
import type { AgentSnapshot, BudgetState, SystemInfo, Task, UsageSummary } from '../types';
import { api } from '../api';
import { fmtCost, fmtNum, STATUS_LABEL, totalTokens } from '../format';
import { Office } from './Office';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  usage: UsageSummary | null;
  budget: BudgetState | null;
  projectDir: string;
  /** Ayarlar modalını açar (bütçe sınırı orada). */
  onOpenSettings: () => void;
  /** Mürettebat kamerasına (ofis sekmesi) geç. */
  onOpenOffice: () => void;
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

/** Bir modül kutusu — köprüdeki her gösterge aynı çerçeveyi paylaşır. */
function Module({
  label,
  children,
  wide,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  onClick?: () => void;
}) {
  return (
    <section
      className={`bridge-mod${wide ? ' wide' : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      {...(onClick ? { role: 'button', tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } } : {})}
    >
      <span className="bridge-mod-label">{label}</span>
      <div className="bridge-mod-body">{children}</div>
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

export function Bridge({ agents, tasks, usage, budget, projectDir, onOpenOffice, onOpenAgent, onOpenSettings }: Props) {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [plan, setPlan] = useState<Record<string, RateWindow | null> | null>(null);
  const [planAvailable, setPlanAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const s = await api.system().catch(() => null);
      if (alive && s) setSys(s);
      const d = await api
        .usageDetail()
        .catch(() => null);
      if (!alive || !d) return;
      const p = d.plan as { rate_limits_available?: boolean; rate_limits?: Record<string, RateWindow | null> } | null;
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

  const active = agents.filter((a) => a.status !== 'offline');
  const working = agents.filter((a) => a.status === 'working');
  const waiting = agents.filter((a) => a.status === 'waiting');
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const done = tasks.filter((t) => t.status === 'done').length;

  const memUsedPct = sys ? ((sys.host.memTotal - sys.host.memFree) / sys.host.memTotal) * 100 : 0;
  const planWindows = plan
    ? Object.entries(plan).filter((e): e is [string, RateWindow] => !!e[1] && typeof e[1].utilization === 'number')
    : [];

  return (
    <div className="bridge">
      {/* --- mürettebat --- */}
      <Module label="Mürettebat">
        <div className="bridge-crew-top">
          <Stat k="Toplam" v={String(agents.length)} />
          <Stat k="Aktif" v={String(active.length)} tone={active.length ? 'hud' : undefined} />
          <Stat k="Çalışan" v={String(working.length)} tone={working.length ? 'hud' : undefined} />
          <Stat k="Bekleyen" v={String(waiting.length)} tone={waiting.length ? 'warn' : undefined} />
        </div>
        <div className="bridge-crew-list">
          {agents.map((a) => (
            <button key={a.config.id} className="bcrew" onClick={() => onOpenAgent(a.config.id)}>
              <span className={`led led-${a.status}`} />
              <span className="bcrew-name">{a.config.name}</span>
              <span className="bcrew-status">{STATUS_LABEL[a.status]}</span>
              <span className="bcrew-tok">{fmtNum(totalTokens(a.usage))}</span>
            </button>
          ))}
          {agents.length === 0 && <div className="muted">Mürettebat boş.</div>}
        </div>
      </Module>

      {/* --- mürettebat kamerası (küçük) --- */}
      <Module label="Mürettebat Kamerası" onClick={onOpenOffice}>
        <div className="bridge-cam">
          <Office agents={agents} tasks={tasks} onOpen={onOpenAgent} compact />
          <div className="bridge-cam-hint">Ekrana tıkla → tam görünüm</div>
        </div>
      </Module>

      {/* --- günlük bütçe --- */}
      <Module label="Günlük Bütçe" onClick={onOpenSettings}>
        {budget && budget.limitUSD ? (
          <>
            <Gauge
              pct={budget.pct ?? 0}
              label={`$${budget.spentUSD.toFixed(4)} / $${budget.limitUSD.toFixed(2)}`}
              sub={budget.exceeded ? 'sınır aşıldı — yeni iş kabul edilmiyor' : `sıfırlanma: gece yarısı (${budget.date})`}
            />
            {budget.exceeded && <Stat k="Durum" v="KİLİTLİ" tone="alarm" />}
            {!budget.exceeded && budget.warn && <Stat k="Durum" v="eşiğe yakın" tone="warn" />}
          </>
        ) : (
          <>
            <div className="muted small">
              Sınır tanımlı değil — harcama sınırsız.
            </div>
            {budget && <Stat k="Bugün" v={fmtCost(budget.spentUSD)} />}
            <div className="bgauge-sub">Sınır koymak için tıkla</div>
          </>
        )}
      </Module>

      {/* --- kota --- */}
      <Module label="Plan Kotası">
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
          <div className="muted small">
            {planAvailable ? 'Kota penceresi yok.' : 'Kota okunamıyor — en az bir ajan çalışmalı.'}
          </div>
        )}
      </Module>

      {/* --- token / maliyet --- */}
      <Module label="Yakıt · Token">
        {usage ? (
          <>
            <Stat k="Toplam token" v={fmtNum(totalTokens(usage.total))} tone="hud" />
            <Stat k="Maliyet" v={fmtCost(usage.total.costUSD)} />
            <Stat k="İstek" v={String(usage.total.requests)} />
            <div className="bridge-split" />
            <Stat k="Giriş" v={fmtNum(usage.total.inputTokens)} />
            <Stat k="Çıkış" v={fmtNum(usage.total.outputTokens)} />
            <Stat k="Önbellek" v={fmtNum(usage.total.cacheReadTokens)} />
          </>
        ) : (
          <div className="muted small">Veri yok.</div>
        )}
      </Module>

      {/* --- görevler --- */}
      <Module label="Görev Kuyruğu">
        <Stat k="Çalışan" v={String(running)} tone={running ? 'hud' : undefined} />
        <Stat k="Sırada" v={String(pending)} />
        <Stat k="Biten" v={String(done)} />
        <Stat k="Toplam" v={String(tasks.length)} />
      </Module>

      {/* --- proje --- */}
      <Module label="Proje">
        {sys ? (
          <>
            <Stat k="Ad" v={sys.project.name} tone="hud" />
            <Stat k="Dosya" v={`${fmtNum(sys.project.fileCount)}${sys.project.truncated ? '+' : ''}`} />
            <Stat k="Boyut" v={fmtBytes(sys.project.sizeBytes)} />
            <Stat k="Dal" v={sys.project.gitBranch ?? '—'} />
            <div className="bridge-path" title={projectDir}>
              {sys.project.dir}
            </div>
          </>
        ) : (
          <div className="muted small">Taranıyor…</div>
        )}
      </Module>

      {/* --- host makine --- */}
      <Module label="Sistem">
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
          <div className="muted small">Okunuyor…</div>
        )}
      </Module>

      {/* --- claude --- */}
      <Module label="Claude">
        {sys ? (
          <>
            <Stat k="Agent SDK" v={sys.claude.sdkVersion} tone="hud" />
            <Stat k="Node" v={sys.host.nodeVersion} />
            <Stat k="Ekip" v={agents.length ? `${agents.length} tanım` : '—'} />
            <div className="bridge-path" title={sys.claude.teamDir}>
              {sys.claude.teamDir}
            </div>
          </>
        ) : (
          <div className="muted small">Okunuyor…</div>
        )}
      </Module>
    </div>
  );
}
