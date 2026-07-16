import type { AgentSnapshot } from '../types';
import { fmtNum, STATUS_LABEL, ROLE_LABEL, fmtCost } from '../format';

interface Props {
  agent: AgentSnapshot;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

export function AgentCard({ agent, onOpen, onEdit, onDelete, onToggle }: Props) {
  const { config, status, usage, currentActivity, pendingPermissions } = agent;
  return (
    <div className={`card status-border-${status}`} onClick={onOpen}>
      <div className="card-head">
        <span className={`dot dot-${status}`} title={STATUS_LABEL[status]} />
        <strong>{config.name}</strong>
        <span className="badge role">{ROLE_LABEL[config.role] ?? config.role}</span>
        <span className="badge model">{config.model}</span>
      </div>
      {config.description && <div className="card-desc">{config.description}</div>}
      <div className="card-status">
        {STATUS_LABEL[status]}
        {currentActivity && status === 'working' ? ` · ${currentActivity}` : ''}
        {pendingPermissions.length > 0 && (
          <span className="badge warn"> {pendingPermissions.length} izin bekliyor</span>
        )}
      </div>
      <div className="card-usage">
        <span title="giriş / çıkış token">
          ⬇ {fmtNum(usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens)} · ⬆{' '}
          {fmtNum(usage.outputTokens)}
        </span>
        <span title="tahmini maliyet">{fmtCost(usage.costUSD)}</span>
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button onClick={onToggle}>{status === 'offline' ? 'Başlat' : 'Durdur'}</button>
        <button onClick={onEdit}>Düzenle</button>
        <button className="danger" onClick={onDelete}>
          Sil
        </button>
      </div>
    </div>
  );
}
