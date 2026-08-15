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
          {allOffline ? 'Tümünü başlat' : 'Tümünü durdur'}
        </button>
        {/* Oto-onay açıkken düğme kendisi bir uyarı: izin istemeden araç
            çalıştıran bir durumun sürüp gittiğini hatırlatır. */}
        <button
          className={`cat-bulk-btn${allAuto ? ' warn' : ''}`}
          disabled={busy || !agents.length}
          onClick={onToggleAllAutoApprove}
          title="Araç izin isteklerini onay istemeden otomatik kabul et"
        >
          {allAuto ? 'Oto-onayı kapat' : 'Oto-onay aç'}
        </button>
        <span className="cat-bulk-count">{agents.length} ajan</span>
      </div>

      <div className="cat-head">
        <span />
        <span>Ajan</span>
        {showTeam && <span>Takım</span>}
        <span>Rol</span>
        <span>Model</span>
        <span>Durum</span>
        <span className="num">Token</span>
        <span className="num">Maliyet</span>
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
                title={switched ? `temel model: ${config.model} · aktif: ${currentModel}` : undefined}
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
              <span className="cat-tok num" title="giriş + önbellek / çıkış token">
                {fmtNum(totalTokens(usage))}
              </span>
              <span className="cat-cost num" title="tahmini maliyet">
                {fmtCost(usage.costUSD)}
              </span>
              <button
                className="cat-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenId(expanded ? null : config.id);
                }}
                aria-expanded={expanded}
                aria-label={expanded ? 'Ayrıntıyı kapat' : 'Ayrıntıyı aç'}
                title={expanded ? 'Ayrıntıyı kapat' : 'Ayrıntıyı aç'}
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
                  <button onClick={() => onToggle(a)}>{status === 'offline' ? 'Başlat' : 'Durdur'}</button>
                  <button onClick={() => onEdit(a)}>Düzenle</button>
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
