import { useState } from 'react';
import type { AgentSnapshot } from '../types';
import { api } from '../api';

interface Props {
  existing?: AgentSnapshot;
  onClose: () => void;
  onSaved: () => void;
}

export function AgentForm({ existing, onClose, onSaved }: Props) {
  const [name, setName] = useState(existing?.config.name ?? '');
  const [role, setRole] = useState(existing?.config.role ?? 'worker');
  const [model, setModel] = useState(existing?.config.model ?? 'sonnet');
  const [memoryMode, setMemoryMode] = useState(existing?.config.memoryMode ?? 'both');
  const [autoApprove, setAutoApprove] = useState(existing?.config.autoApprove ?? false);
  const [autoModel, setAutoModel] = useState(existing?.config.autoModel ?? true);
  const [description, setDescription] = useState(existing?.config.description ?? '');
  const [personality, setPersonality] = useState('');
  const [mcpJson, setMcpJson] = useState(
    existing?.config.mcpServers ? JSON.stringify(existing.config.mcpServers, null, 2) : '',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [personalityLoaded, setPersonalityLoaded] = useState(!existing);

  // For edits we don't have the personality text in the snapshot; keep blank =
  // unchanged unless the user types something.
  async function submit() {
    setError('');
    setBusy(true);
    try {
      let mcpServers: unknown;
      if (mcpJson.trim()) {
        mcpServers = JSON.parse(mcpJson);
      }
      if (existing) {
        const patch: Record<string, unknown> = { name, role, model, memoryMode, autoApprove, autoModel, description, mcpServers };
        if (personality.trim() || personalityLoaded) patch.personality = personality;
        await api.updateAgent(existing.config.id, patch);
      } else {
        await api.createAgent({ name, role, model, memoryMode, autoApprove, autoModel, description, personality, mcpServers });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{existing ? `Ajanı düzenle: ${existing.config.name}` : 'Yeni Ajan'}</h2>
        <label>
          İsim
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Araştırmacı" />
        </label>
        <div className="row">
          <label>
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="boss">Patron (boss)</option>
              <option value="manager">Yönetici</option>
              <option value="team-leader">Takım Lideri</option>
              <option value="worker">Çalışan</option>
            </select>
          </label>
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="haiku">Haiku (hızlı/ucuz)</option>
              <option value="sonnet">Sonnet (dengeli)</option>
              <option value="opus">Opus (güçlü)</option>
            </select>
          </label>
          <label>
            Hafıza
            <select value={memoryMode} onChange={(e) => setMemoryMode(e.target.value as typeof memoryMode)}>
              <option value="both">Ortak + Özel</option>
              <option value="shared">Sadece ortak</option>
              <option value="private">Sadece özel</option>
              <option value="none">Hafıza yok</option>
            </select>
          </label>
        </div>
        <label>
          Açıklama (boss görev dağıtırken bunu görür)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="örn. Web araştırması ve rapor yazımı konusunda uzman"
          />
        </label>
        <label>
          Kişilik / talimatlar (system prompt)
          <textarea
            rows={6}
            value={personality}
            onChange={(e) => {
              setPersonality(e.target.value);
              setPersonalityLoaded(true);
            }}
            placeholder={
              existing
                ? '(boş bırakılırsa mevcut kişilik korunur)'
                : 'örn. Sen titiz bir araştırmacısın. Kaynak göstermeden iddia yazmazsın...'
            }
          />
        </label>
        <label>
          MCP sunucuları (JSON, opsiyonel — dış uygulama bağlantıları)
          <textarea
            rows={4}
            value={mcpJson}
            onChange={(e) => setMcpJson(e.target.value)}
            placeholder={'{\n  "ornekServer": { "type": "stdio", "command": "npx", "args": ["-y", "paket-adi"] }\n}'}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={autoModel} onChange={(e) => setAutoModel(e.target.checked)} />
          Otomatik model seçimi (ajan göreve bakıp haiku/sonnet/opus arasında kendisi geçer; seçilen model temel olur)
        </label>
        <label className="check">
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
          Otomatik onay (araç izinlerini sormadan çalışır — dikkatli kullan)
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button className="primary" disabled={busy || !name.trim()} onClick={submit}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
