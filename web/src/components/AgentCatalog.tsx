/**
 * Ajan kataloğu — ekip dizini.
 *
 * Kart ızgarası DEĞİL. Dokuz eş boyutlu kutu (başlık + paragraf + sayı +
 * üç düğme) bu arayüzün en jenerik yeriydi. Katalog bir atlasın nesne
 * dizinidir: her ajan tek bir hairline satır, sütunlar gerçek bir cetvele
 * hizalı, uzun açıklama yalnızca AÇILAN satırda görünür.
 *
 * Satıra tıklamak terminali ortada açar; sağdaki ok ayrıntıyı açar —
 * eylemler orada yaşar, sekiz satırda yirmi dört düğme olarak değil.
 *
 * Toplu eylemler (tümünü başlat/durdur, oto-onay) BURADADIR, kenar
 * çubuğunda değil: kapsamları "ekranda gördüğün ekip" ve o ekibin
 * tamamının görüldüğü tek yer bu panel. Dar bir kenar şeridinde dururken
 * hangi sekiz ajanı vurdukları görünmüyordu.
 */
import { useState } from 'react';
import type { AgentSnapshot } from '../types';
import { fmtNum, STATUS_LABEL, ROLE_LABEL, fmtCost, totalTokens } from '../format';
import { teamOf } from '../teams';
import { L } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
  onOpen: (id: string) => void;
  onEdit: (a: AgentSnapshot) => void;
  onDelete: (a: AgentSnapshot) => void;
  onToggle: (a: AgentSnapshot) => void;
  /** Toplu eylemler — kapsam bu listedeki ajanlardır. */
  onToggleAll: () => void;
  onToggleAllAutoApprove: () => void;
  busy: boolean;
  /** Takım sütunu yalnızca birden fazla takım görünürken anlamlı. */
  showTeam: boolean;
}

export function AgentCatalog({
  agents, onOpen, onEdit, onDelete, onToggle, onToggleAll, onToggleAllAutoApprove, busy, showTeam,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const allOffline = agents.length > 0 && agents.every((a) => a.status === 'offline');
  const allAuto = agents.length > 0 && agents.every((a) => a.config.autoApprove);

  return (
    <div className={`catalog${showTeam ? ' with-team' : ''}`}>
      <div className="cat-bulk">
        <button className="cat-bulk-btn" disabled={busy || !agents.length} onClick={onToggleAll}>
          {allOffline ? L.catalog.startAll : L.catalog.stopAll}
        </button>
        {/* Oto-onay açıkken düğme kendisi bir uyarı: izin istemeden araç
            çalıştıran bir durumun sürüp gittiğini hatırlatır. */}
        <button
          className={`cat-bulk-btn${allAuto ? ' warn' : ''}`}
          disabled={busy || !agents.length}
          onClick={onToggleAllAutoApprove}
          title={L.catalog.autoTitle}
        >
          {allAuto ? L.catalog.autoOff : L.catalog.autoOn}
        </button>
        <span className="cat-bulk-count">{agents.length} ajan</span>
      </div>

      <div className="cat-head">
        <span />
        <span>{L.catalog.agent}</span>
        {showTeam && <span>{L.catalog.team}</span>}
        <span>{L.catalog.role}</span>
        <span>{L.catalog.model}</span>
        <span>{L.extra.status}</span>
        <span className="num">{L.extra.tokens}</span>
        <span className="num">{L.extra.cost}</span>
        <span />
      </div>

      {agents.map((a) => {
        const { config, status, usage, currentActivity, pendingPermissions, currentModel } = a;
        // Otomatik model seçimi temel modelden saptıysa geçişi göster (örn. haiku→opus)
        const switched = currentModel && currentModel !== config.model && status !== 'offline';
        const expanded = openId === config.id;
        return (
          <div key={config.id} className={`cat-item${expanded ? ' open' : ''}`}>
            <div
              className="cat-row"
              onClick={() => onOpen(config.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(config.id);
                }
              }}
            >
              <span className={`led led-${status}`} title={STATUS_LABEL[status]} />
              <span className="cat-name">{config.name}</span>
              {showTeam && <span className="cat-team">{teamOf(a)}</span>}
              <span className="cat-role">{ROLE_LABEL[config.role] ?? config.role}</span>
              <span
                className="cat-model"
                title={switched ? L.catalog.modelSwitched(config.model, currentModel ?? '') : undefined}
              >
                {switched ? `${config.model}→${currentModel}` : config.model}
              </span>
              <span className="cat-status">
                {STATUS_LABEL[status]}
                {currentActivity && status === 'working' ? ` · ${currentActivity}` : ''}
                {pendingPermissions.length > 0 && (
                  <span className="badge warn">{pendingPermissions.length} izin bekliyor</span>
                )}
              </span>
              <span className="cat-tok num" title={L.catalog.tokensTitle}>
                {fmtNum(totalTokens(usage))}
              </span>
              <span className="cat-cost num" title={L.catalog.costTitle}>
                {fmtCost(usage.costUSD)}
              </span>
              <button
                className="cat-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenId(expanded ? null : config.id);
                }}
                aria-expanded={expanded}
                aria-label={expanded ? L.catalog.collapse : L.catalog.expand}
                title={expanded ? L.catalog.collapse : L.catalog.expand}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>

            {expanded && (
              <div className="cat-detail">
                {config.description && <p className="cat-desc">{config.description}</p>}
                <div className="cat-detail-foot">
                  <span className="cat-detail-meta">
                    IN {fmtNum(usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens)} · OUT{' '}
                    {fmtNum(usage.outputTokens)} · {usage.requests} istek
                  </span>
                  <button onClick={() => onToggle(a)}>{status === 'offline' ? L.catalog.start : L.catalog.stop}</button>
                  <button onClick={() => onEdit(a)}>{L.catalog.edit}</button>
                  <button className="danger" onClick={() => onDelete(a)}>
                    Sil
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
