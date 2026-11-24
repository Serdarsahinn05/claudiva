/**
 * Ayarlar.
 *
 * Eski hali iki sayı kutusuydu ve asıl soruyu yanıtsız bırakıyordu: sınır
 * neye göre konacak? Bugün ne harcandığı yazıyordu ama KİMİN harcadığı
 * yazmıyordu — oysa sunucu bunu zaten biliyor (`budget.perAgentUSD`) ve
 * sınır kararını belirleyen tek şey o dağılım. Ekran artık önce ölçümü
 * gösterir, sonra ayarı sorar.
 *
 * Dört bölüm var ve her biri farklı bir şeye ait:
 *   · Bütçe        — bu projeye (sunucudaki settings.json)
 *   · Arayüz       — bu tarayıcıya: panel mi sohbet mi (localStorage)
 *   · Çalışma alanı — bu tarayıcıya (localStorage; sunucuya hiç gitmez)
 *   · Sistem       — makineye ve projeye (salt okunur)
 * Ayrım görünür durmalı, yoksa "yerleşimi sıfırla"nın ekibi etkileyeceği
 * sanılır.
 */
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { api } from '../api';
import { fmtCost } from '../format';
import type { AgentSnapshot, BudgetState, SystemInfo } from '../types';
import { UI_MODES, setUiMode, useUiMode, type UiMode } from '../uiMode';
import { APP_STYLES, setAppStyle, useAppStyle } from '../appStyle';
import { L, LOCALES, locale, setLocale, dateLocale } from '../i18n';

interface Props {
  budget: BudgetState | null;
  agents: AgentSnapshot[];
  /** Yerleşimi varsayılana döndürür (yalnızca bu tarayıcı). */
  onResetLayout: () => void;
  onClose: () => void;
  onSaved: () => void;
}

type Section = 'butce' | 'arayuz' | 'alan' | 'sistem';

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'butce', label: L.settings.budget, hint: L.settings.budgetHint },
  { id: 'arayuz', label: L.settings.ui, hint: L.settings.uiHint },
  { id: 'alan', label: L.settings.workspace, hint: L.settings.workspaceHint },
  { id: 'sistem', label: L.settings.system, hint: L.settings.systemHint },
];

function fmtBytes(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

/** Boş bırakılırsa sınır kaldırılır; kutuya 0 yazmak da aynı anlama gelir. */
export function Settings({ budget, agents, onResetLayout, onClose, onSaved }: Props) {
  const [section, setSection] = useState<Section>('butce');
  const [limit, setLimit] = useState(
    budget?.limitUSD && budget.limitUSD > 0 ? String(budget.limitUSD) : '',
  );
  const [warnAt, setWarnAt] = useState(String(budget?.settings?.warnAtPercent ?? 80));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const uiMode = useUiMode();
  const appStyle = useAppStyle();

  // Sistem bilgisi yalnızca o bölüm açılınca istenir: ayarları açmak
  // her seferinde bir dosya sayımı tetiklemesin.
  useEffect(() => {
    if (section !== 'sistem' || sys) return;
    void api.system().then(setSys).catch(() => {});
  }, [section, sys]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.updateSettings({
        dailyLimitUSD: limit.trim() ? Number(limit) : 0,
        warnAtPercent: Number(warnAt) || 80,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Harcayan ajanlar, çoktan aza. Hiç harcamamış ajan listeye girmez —
  // sıfırlarla dolu bir liste dağılımı okunmaz yapardı.
  const spenders = Object.entries(budget?.perAgentUSD ?? {})
    .filter(([, usd]) => usd > 0)
    .sort((a, b) => b[1] - a[1]);
  const nameOf = (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id;
  const topSpend = spenders[0]?.[1] ?? 0;

  const pct = budget?.pct ?? null;
  const meterClass = budget?.exceeded ? ' crit' : budget?.warn ? ' warn' : '';

  return (
    <Modal onClose={onClose} wide>
      <div className="modal-head">
        <h2>{L.settings.title}</h2>
        <span className="modal-sub">{L.settings.subtitle}</span>
      </div>

      <div className="modal-body">
        <nav className="modal-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`modal-nav-btn${section === s.id ? ' sel' : ''}`}
              onClick={() => setSection(s.id)}
            >
              <span className="modal-nav-label">{s.label}</span>
              <span className="modal-nav-hint">{s.hint}</span>
            </button>
          ))}
        </nav>

        <div className="modal-pane">
          {section === 'butce' && (
            <>
              {/* Önce ÖLÇÜM, sonra ayar: sınırın ne olacağına bugünkü
                  dağılıma bakmadan karar verilemiyor. */}
              {budget && (
                <div className="set-meter">
                  <div className="set-meter-head">
                    <span className="label">Bugün · {budget.date}</span>
                    <span className="set-meter-val">
                      {fmtCost(budget.spentUSD)}
                      {budget.limitUSD ? <span className="dim"> / {fmtCost(budget.limitUSD)}</span> : null}
                    </span>
                  </div>
                  {pct !== null ? (
                    <>
                      <div className={`gauge${meterClass}`}>
                        <span style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="set-meter-sub">
                        %{pct.toFixed(0)} ·{' '}
                        {budget.exceeded
                          ? L.budget.exceeded
                          : budget.warn
                            ? L.budget.warn
                            : L.budget.ok}
                      </div>
                    </>
                  ) : (
                    <div className="set-meter-sub">{L.budget.noLimit}</div>
                  )}

                  {spenders.length > 0 && (
                    <div className="set-spenders">
                      {spenders.map(([id, usd]) => (
                        <div key={id} className="set-spender">
                          <span className="set-spender-name">{nameOf(id)}</span>
                          <span className="set-spender-bar">
                            <span style={{ width: `${topSpend ? (usd / topSpend) * 100 : 0}%` }} />
                          </span>
                          <span className="set-spender-val">{fmtCost(usd)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="tb-field">
                <span className="tb-field-label">
                  {L.budget.dailyLimit}
                  <span className="tb-hint">{L.budget.dailyLimitHint}</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder={L.budget.example}
                />
              </label>

              <label className="tb-field">
                <span className="tb-field-label">
                  {L.budget.warnAt}<span className="tb-hint">{L.budget.warnAtHint}</span>
                </span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={warnAt}
                  onChange={(e) => setWarnAt(e.target.value)}
                />
              </label>

              <div className="set-note dim">
                {L.budget.note}
              </div>
            </>
          )}

          {section === 'arayuz' && (
            <>
              {/* Dil seçimi sayfayı yeniler (bkz. i18n/index.ts). Her dil kendi
                  adıyla yazılır: dili bilmeyen kullanıcı da kendi dilini bulsun. */}
              <div className="tb-field">
                <span className="tb-field-label">
                  {L.settings.language}
                  <span className="tb-hint">{L.settings.languageHint}</span>
                </span>
                <div className="chat-seg" role="radiogroup" aria-label={L.settings.language}>
                  {LOCALES.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={locale === l.id}
                      lang={l.id}
                      className={`chat-chip${locale === l.id ? ' on' : ''}`}
                      onClick={() => setLocale(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <span className="tb-field-label">{L.settings.modeTitle}</span>
              <div className="set-note">
                {L.settings.modeNote1}
                <strong>{L.settings.modeNoteStrong}</strong>
                {L.settings.modeNote2}
              </div>
              <div className="mode-cards" role="radiogroup" aria-label={L.settings.modeAria}>
                {UI_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={uiMode === m.id}
                    className={`mode-card${uiMode === m.id ? ' sel' : ''}`}
                    onClick={() => setUiMode(m.id)}
                  >
                    <ModePreview mode={m.id} />
                    <span className="mode-card-label">{m.label}</span>
                    <span className="mode-card-desc">{m.desc}</span>
                  </button>
                ))}
              </div>
              <span className="tb-field-label">{L.settings.styleTitle}</span>
              <div className="set-note">{L.settings.styleNote}</div>
              {/* Önizleme kartın KENDİ data-style'ını taşımaz: stil token'ları
                  `:root[data-style]` üzerinde, alt öğede ezilemez. Kart bu
                  yüzden stilin harflerini ve köşesini satır içi örnekler. */}
              <div className="mode-cards" role="radiogroup" aria-label={L.settings.styleAria}>
                {APP_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={appStyle === s.id}
                    className={`mode-card${appStyle === s.id ? ' sel' : ''}`}
                    onClick={() => setAppStyle(s.id)}
                  >
                    <span className={`style-prev style-prev-${s.id}`} aria-hidden="true">
                      <span className="style-prev-title">Aa</span>
                      <span className="style-prev-chip" />
                      <span className="style-prev-chip" />
                    </span>
                    <span className="mode-card-label">{s.label}</span>
                    <span className="mode-card-desc">{s.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {section === 'alan' && (
            <>
              <div className="set-note">
                {L.workspaceSettings.noteA}<strong>{L.workspaceSettings.noteStrong}</strong>{L.workspaceSettings.noteB}
              </div>
              <div className="tb-field">
                <span className="tb-field-label">
                  {L.workspaceSettings.reset}<span className="tb-hint">{L.workspaceSettings.resetHint}</span>
                </span>
                <div className="row">
                  <button
                    onClick={() => {
                      onResetLayout();
                      onClose();
                    }}
                  >
                    {L.workspaceSettings.resetButton}
                  </button>
                </div>
              </div>
              <div className="set-note dim">
                {L.workspaceSettings.resetNote}
              </div>
            </>
          )}

          {section === 'sistem' && (
            <>
              {sys ? (
                <div className="set-facts">
                  <div className="set-fact">
                    <span className="label">{L.systemInfo.project}</span>
                    <span className="set-fact-val">{sys.project.name}</span>
                    <span className="set-fact-sub">{sys.project.dir}</span>
                  </div>
                  <div className="set-fact">
                    <span className="label">{L.systemInfo.repo}</span>
                    <span className="set-fact-val">{sys.project.gitBranch ?? L.systemInfo.notRepo}</span>
                    <span className="set-fact-sub">
                      {L.systemInfo.files(sys.project.fileCount.toLocaleString(dateLocale))} ·{' '}
                      {fmtBytes(sys.project.sizeBytes)}
                      {sys.project.truncated ? L.systemInfo.partial : ''}
                    </span>
                  </div>
                  <div className="set-fact">
                    <span className="label">{L.systemInfo.team}</span>
                    <span className="set-fact-val">{L.common.agents(agents.length)}</span>
                    <span className="set-fact-sub">{sys.claude.teamDir}</span>
                  </div>
                  <div className="set-fact">
                    <span className="label">{L.systemInfo.runtime}</span>
                    <span className="set-fact-val">
                      Node {sys.host.nodeVersion} · SDK {sys.claude.sdkVersion}
                    </span>
                    <span className="set-fact-sub">
                      {sys.host.platform} {sys.host.release} · {L.systemInfo.cores(sys.host.cpuCount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="set-note dim">{L.systemInfo.loading}</div>
              )}
            </>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="modal-actions">
        <button onClick={onClose}>{section === 'butce' ? L.actions.cancel : L.common.close}</button>
        {section === 'butce' && (
          <button className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Modun şematik minyatürü: gerçek bileşen değil, yerleşimin iskeleti. */
function ModePreview({ mode }: { mode: UiMode }) {
  if (mode === 'chat') {
    return (
      <span className="mode-prev mp-chat" aria-hidden>
        <span className="mp-list" />
        <span className="mp-thread">
          <span className="mp-msg" />
          <span className="mp-msg mine" />
          <span className="mp-msg" />
          <span className="mp-foot" />
        </span>
      </span>
    );
  }
  return (
    <span className="mode-prev mp-panels" aria-hidden>
      <span className="mp-dock" />
      <span className="mp-grid">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="mp-dock" />
    </span>
  );
}
