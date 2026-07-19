import { useState } from 'react';
import { Modal } from './Modal';
import { api } from '../api';
import type { BudgetState } from '../types';

interface Props {
  budget: BudgetState | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Boş bırakılırsa sınır kaldırılır; kutuya 0 yazmak da aynı anlama gelir. */
export function Settings({ budget, onClose, onSaved }: Props) {
  const [limit, setLimit] = useState(
    budget?.limitUSD && budget.limitUSD > 0 ? String(budget.limitUSD) : '',
  );
  const [warnAt, setWarnAt] = useState(String(budget?.settings?.warnAtPercent ?? 80));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <h2>Ayarlar</h2>
        <span className="modal-sub">bu projeye özel</span>
      </div>

      <div className="modal-pane">
        <label className="tb-field">
          <span className="tb-field-label">
            Günlük harcama sınırı
            <span className="tb-hint">USD · boş bırakırsan sınırsız</span>
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="örn. 5"
          />
        </label>

        <label className="tb-field">
          <span className="tb-field-label">
            Uyarı eşiği<span className="tb-hint">yüzde · bu orana gelince panel uyarır</span>
          </span>
          <input
            type="number"
            min="1"
            max="100"
            value={warnAt}
            onChange={(e) => setWarnAt(e.target.value)}
          />
        </label>

        {budget && (
          <div className="set-note">
            Bugün ({budget.date}) harcanan: <strong>${budget.spentUSD.toFixed(4)}</strong>
            {budget.limitUSD ? ` / $${budget.limitUSD.toFixed(2)}` : ' (sınırsız)'}
          </div>
        )}

        <div className="set-note dim">
          Sınır aşıldığında süren tur kesilmez — yarım iş bırakmamak için tamamlanır.
          Yeni mesaj ve yeni görev reddedilir. Sayaç her gün yerel gece yarısı sıfırlanır.
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="modal-actions">
        <button onClick={onClose}>Vazgeç</button>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </Modal>
  );
}
