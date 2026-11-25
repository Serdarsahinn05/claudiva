/**
 * Sohbet'in sağ panelindeki ajan bölümü (2026-11-25). Maket:
 * claude.ai/artifact/NFBFnmdd9cWwh2xZVDqQwD
 *
 * Seçili konuşmanın ajanı (DM) ya da ekip sohbetinde lider için: model,
 * oto-onay, bağlam doluluğu, bugünkü harcama, skill'ler, MCP sunucuları ve
 * dokunduğu dosyalar. Hepsi var olan uçlardan; yeni sunucu ucu YOK.
 *
 *  - Model/oto-onay/otomatik model: `PUT /api/agents/:id` (manager.update; model
 *    oturumda canlı değişir).
 *  - Bağlam, model seçenekleri, MCP durumu: `inspect(context, models, mcp)`.
 *    Oturum kapalıysa `null` gelir; panel "okunamadı" der, UYDURMAZ.
 *    Bağlam çubuğundan "Free space"/"Autocompact buffer" ÇIKARILIR (artakalan,
 *    tüketim değil; UsageBoard ile aynı kural).
 *  - Skill'ler: `GET /api/skills` (bu ajanın gördükleri: genel + proje + kendi
 *    ajan kapsamı), aç/kapat `toggleSkill`. Genel/proje kapsamlıyı kapatmak
 *    BÜTÜN ekibi etkiler; uyarı satırı bunu söyler.
 *  - Dosyalar: `GET /api/changes` → `touches[].agentId`.
 *
 * `compact` (ekip sohbeti, lider özeti): skill/MCP/dosya bölümleri çizilmez.
 */
import { useEffect, useState } from 'react';
import type { AgentSnapshot, BudgetState, ChangedFile, ContextUsageInfo, McpStatusInfo, ModelOption, SkillInfo } from '../../types';
import { api } from '../../api';
import { fmtCost, fmtNum, totalTokens, ROLE_LABEL, STATUS_LABEL } from '../../format';
import { Avatar } from './ChatMessage';
import { L } from '../../i18n';

const HEADROOM = new Set(['Free space', 'Autocompact buffer']);
const MAX_FILES = 8;
const SCOPE_ORDER: Record<string, number> = { agent: 0, project: 1, global: 2 };
const STATUS_MARK: Record<string, string> = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R', untracked: 'U' };

interface Props {
  agent: AgentSnapshot;
  budget: BudgetState | null;
  compact?: boolean;
  refreshAgents: () => Promise<void>;
}

interface Insight {
  context: ContextUsageInfo | null;
  models: ModelOption[] | null;
  mcp: McpStatusInfo[] | null;
}

function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="ci-tog"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

export function ChatInspector({ agent, budget, compact = false, refreshAgents }: Props) {
  const id = agent.config.id;
  const live = agent.status !== 'offline';
  const [ins, setIns] = useState<Insight | null>(null);
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [files, setFiles] = useState<ChangedFile[] | null>(null);
  const [isRepo, setIsRepo] = useState(true);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [skillWarn, setSkillWarn] = useState(false);
  const [showGlobal, setShowGlobal] = useState(false);

  // Oturum iç görüsü: yalnız açık oturumda anlamlı; 20 sn'de bir.
  useEffect(() => {
    let alive = true;
    setIns(null);
    if (!live) return;
    const load = () =>
      api
        .inspect(id, compact ? ['context', 'models'] : ['context', 'models', 'mcp'])
        .then((r) => alive && setIns({ context: r.context ?? null, models: r.models ?? null, mcp: r.mcp ?? null }))
        .catch(() => alive && setIns({ context: null, models: null, mcp: null }));
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, live, compact]);

  // Skill'ler ve dosyalar: oturumdan bağımsız; 30 sn'de bir.
  useEffect(() => {
    if (compact) return;
    let alive = true;
    setSkills(null);
    setFiles(null);
    setSkillWarn(false);
    const load = () => {
      api
        .listSkills()
        .then((list) => alive && setSkills(list.filter((s) => s.scope !== 'agent' || s.agentId === id)))
        .catch(() => alive && setSkills([]));
      api
        .changes()
        .then((c) => {
          if (!alive) return;
          setIsRepo(c.isRepo);
          setFiles(c.files.filter((f) => f.touches.some((t) => t.agentId === id)));
        })
        .catch(() => alive && setFiles([]));
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, compact]);

  useEffect(() => setMsg(null), [id]);

  async function patch(p: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      await api.updateAgent(id, p);
      await refreshAgents();
      setMsg({ text: ok });
    } catch (e) {
      setMsg({ text: (e as Error).message || L.chat.ciSaveErr, err: true });
    } finally {
      setBusy(false);
    }
  }

  async function toggleSkill(s: SkillInfo, enabled: boolean) {
    setSkillWarn(!enabled && s.scope !== 'agent');
    setSkills((list) => list?.map((x) => (x.id === s.id ? { ...x, enabled } : x)) ?? list);
    try {
      await api.toggleSkill(s.id, enabled);
    } catch (e) {
      setSkills((list) => list?.map((x) => (x.id === s.id ? { ...x, enabled: !enabled } : x)) ?? list);
      setMsg({ text: (e as Error).message || L.chat.ciSaveErr, err: true });
    }
  }

  // Bağlam: artakalan kategoriler çıkarılır, pay `maxTokens` (server/CLAUDE.md).
  const ctx = ins?.context ?? null;
  // En büyük dört kategori + "diğer": beş renk, tekrar eden renk yok.
  const used = ctx ? ctx.categories.filter((c) => !HEADROOM.has(c.name) && c.tokens > 0).sort((a, b) => b.tokens - a.tokens) : [];
  const rest = used.slice(4).reduce((n, c) => n + c.tokens, 0);
  const cats = rest > 0 ? [...used.slice(0, 4), { name: L.chat.ciOther, tokens: rest }] : used;
  const ctxPct = ctx ? Math.round(ctx.percentage) : 0;

  const models = ins?.models?.length ? ins.models : null;
  const spent = budget?.perAgentUSD?.[id] ?? 0;
  const cap = agent.config.dailyLimitUSD;

  return (
    <div className="ci">
      <div className="ci-head">
        <Avatar agent={agent} size="sm" />
        <span className="ci-head-body">
          <b>{agent.config.name}</b>
          <small>
            {ROLE_LABEL[agent.config.role] ?? agent.config.role} · {agent.currentActivity ?? STATUS_LABEL[agent.status]}
          </small>
        </span>
      </div>

      {/* Model ve davranış */}
      <section className="ci-blk" aria-label={L.chat.ciModel}>
        <div className="chat-list-sec ci-sec">{L.chat.ciModel}</div>
        {models ? (
          <select
            className="ci-select"
            aria-label={L.chat.ciModel}
            value={agent.currentModel ?? agent.config.model}
            disabled={busy}
            onChange={(e) => void patch({ model: e.target.value }, L.chat.ciModelSaved(e.target.value))}
          >
            {!models.some((m) => m.value === (agent.currentModel ?? agent.config.model)) && (
              <option value={agent.currentModel ?? agent.config.model}>{agent.currentModel ?? agent.config.model}</option>
            )}
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.displayName}
              </option>
            ))}
          </select>
        ) : (
          <div className="ci-row">
            <code>{agent.currentModel ?? agent.config.model}</code>
            <small>{live ? L.extra.reading : L.chat.ciModelsOff}</small>
          </div>
        )}
        <div className="ci-row">
          <span>{L.chat.ciAutoModel}</span>
          <Toggle
            on={agent.config.autoModel !== false}
            label={L.chat.ciAutoModel}
            disabled={busy}
            onChange={(v) => void patch({ autoModel: v }, L.chat.ciSaved)}
          />
        </div>
        <div className="ci-row">
          <span>{L.chat.ciAutoApprove}</span>
          <Toggle
            on={agent.config.autoApprove}
            label={L.chat.ciAutoApprove}
            disabled={busy}
            onChange={(v) => void patch({ autoApprove: v }, L.chat.ciSaved)}
          />
        </div>
        {msg && (
          <div className={`ci-msg${msg.err ? ' err' : ''}`} role="status">
            {msg.text}
          </div>
        )}
      </section>

      {/* Bağlam */}
      <section className="ci-blk" aria-label={L.chat.ciContext}>
        <div className="chat-list-sec ci-sec">{L.chat.ciContext}</div>
        {!live ? (
          <p className="ci-note">{L.chat.ciContextOff}</p>
        ) : !ins ? (
          <p className="ci-note">{L.extra.reading}</p>
        ) : !ctx ? (
          <p className="ci-note">{L.chat.ciContextNone}</p>
        ) : (
          <>
            <div className="ci-row">
              <span>
                <b>{fmtNum(ctx.totalTokens)}</b> / {fmtNum(ctx.maxTokens)}
              </span>
              <small>{L.extra.pct(ctxPct)}</small>
            </div>
            <div className="ci-bar" role="img" aria-label={L.chat.ciContextAria(ctxPct)}>
              {cats.map((c, i) => (
                <i key={c.name} className={`c${i % 5}`} style={{ width: `${(c.tokens / ctx.maxTokens) * 100}%` }} title={`${c.name}: ${fmtNum(c.tokens)}`} />
              ))}
            </div>
            <div className="ci-legend">
              {cats.map((c, i) => (
                <span key={c.name}>
                  <i className={`c${i % 5}`} />
                  {c.name} {fmtNum(c.tokens)}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Bugün */}
      <section className="ci-blk" aria-label={L.chat.ciToday}>
        <div className="chat-list-sec ci-sec">{L.chat.ciToday}</div>
        <div className="ci-row">
          <span>{L.chat.ciSpent}</span>
          <b>{fmtCost(spent)}</b>
        </div>
        <div className="ci-row">
          <span>{L.chat.ciCap}</span>
          <span>{cap ? `$${cap.toFixed(2)}` : L.chat.ciNoCap}</span>
        </div>
        <div className="ci-row">
          <span>{L.chat.ciTokens}</span>
          <span>{fmtNum(totalTokens(agent.usage))}</span>
        </div>
      </section>

      {!compact && (
        <>
          {/* Skill'ler */}
          <section className="ci-blk" aria-label={L.chat.ciSkills}>
            <div className="chat-list-sec ci-sec">{L.chat.ciSkills}</div>
            {skills === null ? (
              <p className="ci-note">{L.extra.reading}</p>
            ) : skills.length === 0 ? (
              <p className="ci-note">{L.chat.ciNoSkills}</p>
            ) : (
              /* Sıra: bu ajanın, proje, genel. Genel skill'ler (kullanıcının
                 ~/.claude'u, bütün projelerde) kalabalık olur: varsayılan katlı. */
              [...skills]
                .sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] || a.name.localeCompare(b.name))
                .filter((s) => s.scope !== 'global' || showGlobal)
                .map((s) => (
                <div key={s.id} className="ci-row">
                  <span className="ci-ell" title={s.description}>
                    {s.name}
                    <span className={`ci-scope${s.scope === 'agent' ? ' own' : ''}`}>{L.chat.ciScope[s.scope] ?? s.scope}</span>
                  </span>
                  <Toggle on={s.enabled} label={s.name} onChange={(v) => void toggleSkill(s, v)} />
                </div>
              ))
            )}
            {skills && skills.some((s) => s.scope === 'global') && (
              <button type="button" className="ci-more" aria-expanded={showGlobal} onClick={() => setShowGlobal((v) => !v)}>
                {showGlobal ? L.chat.ciHideGlobal : L.chat.ciShowGlobal(skills.filter((s) => s.scope === 'global').length)}
              </button>
            )}
            {skillWarn && <p className="ci-note warn">{L.chat.ciSkillWarn}</p>}
          </section>

          {/* MCP */}
          <section className="ci-blk" aria-label="MCP">
            <div className="chat-list-sec ci-sec">MCP</div>
            {live && ins?.mcp ? (
              ins.mcp.length ? (
                ins.mcp.map((m) => (
                  <div key={m.name} className="ci-row" title={m.error}>
                    <span className="ci-ell">
                      <i className={`ci-dot ${m.status === 'connected' ? 'ok' : m.status === 'failed' ? 'err' : 'pend'}`} />
                      {m.name}
                    </span>
                    <small>{m.status === 'connected' ? L.chat.ciTools(m.toolCount) : m.error || m.status}</small>
                  </div>
                ))
              ) : (
                <p className="ci-note">{L.chat.ciNoMcp}</p>
              )
            ) : (
              <>
                {Object.keys(agent.config.mcpServers ?? {}).map((n) => (
                  <div key={n} className="ci-row">
                    <span className="ci-ell">
                      <i className="ci-dot" />
                      {n}
                    </span>
                  </div>
                ))}
                <p className="ci-note">{live ? L.extra.reading : L.chat.ciMcpOff}</p>
              </>
            )}
          </section>

          {/* Dosyalar */}
          {isRepo && (
            <section className="ci-blk" aria-label={L.chat.ciFiles}>
              <div className="chat-list-sec ci-sec">{L.chat.ciFiles}</div>
              {files === null ? (
                <p className="ci-note">{L.extra.reading}</p>
              ) : files.length === 0 ? (
                <p className="ci-note">{L.chat.ciNoFiles}</p>
              ) : (
                <>
                  {files.slice(0, MAX_FILES).map((f) => (
                    <div key={f.path} className="ci-file" title={f.path}>
                      <b className={`m-${STATUS_MARK[f.status] ?? 'M'}`}>{STATUS_MARK[f.status] ?? 'M'}</b>
                      <span>{f.path}</span>
                    </div>
                  ))}
                  {files.length > MAX_FILES && <p className="ci-note">{L.chat.ciMoreFiles(files.length - MAX_FILES)}</p>}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
