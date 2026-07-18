import { useState } from 'react';
import type { AgentSnapshot } from '../types';
import { api } from '../api';
import { Modal } from './Modal';

interface Props {
  existing?: AgentSnapshot;
  onClose: () => void;
  onSaved: () => void;
}

type Section = 'kimlik' | 'yetenek' | 'kisilik' | 'gelismis';

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'kimlik', label: 'Kimlik', hint: 'ad ve açıklama' },
  { id: 'yetenek', label: 'Yetenek', hint: 'rol, model, hafıza' },
  { id: 'kisilik', label: 'Kişilik', hint: 'system prompt' },
  { id: 'gelismis', label: 'Gelişmiş', hint: 'MCP, izinler' },
];

const ROLES = [
  { id: 'boss', label: 'Patron', desc: 'İsteği analiz eder, ekibe dağıtır, sonucu sentezler' },
  { id: 'manager', label: 'Yönetici', desc: 'Alt görevleri dağıtır ve toplar' },
  { id: 'team-leader', label: 'Takım Lideri', desc: 'Küçük bir ekibi yürütür' },
  { id: 'worker', label: 'Çalışan', desc: 'Verilen işi kendisi yapar, dağıtmaz' },
] as const;

const MODELS = [
  { id: 'haiku', label: 'Haiku', desc: 'Hızlı ve ucuz — basit işler' },
  { id: 'sonnet', label: 'Sonnet', desc: 'Dengeli — çoğu iş için' },
  { id: 'opus', label: 'Opus', desc: 'Güçlü — zor kararlar, karmaşık kod' },
] as const;

const MEMORY = [
  { id: 'both', label: 'Ortak + Özel' },
  { id: 'shared', label: 'Sadece ortak' },
  { id: 'private', label: 'Sadece özel' },
  { id: 'none', label: 'Hafıza yok' },
] as const;

/** Seçenek kartı — açılır liste yerine, açıklamasıyla birlikte görünür. */
function Choice({
  sel,
  label,
  desc,
  onClick,
}: {
  sel: boolean;
  label: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`choice${sel ? ' sel' : ''}`} onClick={onClick}>
      <span className="choice-label">{label}</span>
      {desc && <span className="choice-desc">{desc}</span>}
    </button>
  );
}

export function AgentForm({ existing, onClose, onSaved }: Props) {
  const [section, setSection] = useState<Section>('kimlik');
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

  // Düzenlemede kişilik metni snapshot'ta gelmez; boş bırakmak "değiştirme" demek.
  async function submit() {
    setError('');
    setBusy(true);
    try {
      let mcpServers: unknown;
      if (mcpJson.trim()) mcpServers = JSON.parse(mcpJson);
      if (existing) {
        const patch: Record<string, unknown> = {
          name, role, model, memoryMode, autoApprove, autoModel, description, mcpServers,
        };
        if (personality.trim() || personalityLoaded) patch.personality = personality;
        await api.updateAgent(existing.config.id, patch);
      } else {
        await api.createAgent({
          name, role, model, memoryMode, autoApprove, autoModel, description, personality, mcpServers,
        });
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
    <Modal onClose={onClose} wide>
        <div className="modal-head">
          <h2>{existing ? existing.config.name : 'Yeni Ajan'}</h2>
          <span className="modal-sub">{existing ? 'ajan yapılandırması' : 'mürettebata yeni üye'}</span>
        </div>

        <div className="modal-body">
          {/* Bölüm seçici — uzun formu dört parçaya böler */}
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
            {section === 'kimlik' && (
              <>
                <label className="tb-field">
                  <span className="tb-field-label">İsim</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Araştırmacı" />
                </label>
                <label className="tb-field">
                  <span className="tb-field-label">
                    Açıklama<span className="tb-hint">patron görev dağıtırken bunu okur</span>
                  </span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="örn. Web araştırması ve karşılaştırmalı rapor yazımında uzman"
                  />
                </label>
              </>
            )}

            {section === 'yetenek' && (
              <>
                <div className="tb-field">
                  <span className="tb-field-label">Rol</span>
                  <div className="choice-grid">
                    {ROLES.map((r) => (
                      <Choice
                        key={r.id}
                        sel={role === r.id}
                        label={r.label}
                        desc={r.desc}
                        onClick={() => setRole(r.id as typeof role)}
                      />
                    ))}
                  </div>
                </div>

                <div className="tb-field">
                  <span className="tb-field-label">
                    Model<span className="tb-hint">otomatik seçim açıksa bu temel model olur</span>
                  </span>
                  <div className="choice-grid">
                    {MODELS.map((m) => (
                      <Choice key={m.id} sel={model === m.id} label={m.label} desc={m.desc} onClick={() => setModel(m.id)} />
                    ))}
                  </div>
                </div>

                <label className="check switch">
                  <input type="checkbox" checked={autoModel} onChange={(e) => setAutoModel(e.target.checked)} />
                  <span>
                    <strong>Otomatik model seçimi</strong>
                    <em>Ajan işin zorluğuna bakıp haiku/sonnet/opus arasında kendisi geçer.</em>
                  </span>
                </label>

                <div className="tb-field">
                  <span className="tb-field-label">Hafıza</span>
                  <div className="choice-row">
                    {MEMORY.map((m) => (
                      <Choice
                        key={m.id}
                        sel={memoryMode === m.id}
                        label={m.label}
                        onClick={() => setMemoryMode(m.id as typeof memoryMode)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {section === 'kisilik' && (
              <label className="tb-field grow">
                <span className="tb-field-label">
                  Kişilik / talimatlar<span className="tb-hint">system prompt'a eklenir</span>
                </span>
                <textarea
                  rows={16}
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
            )}

            {section === 'gelismis' && (
              <>
                <label className="tb-field">
                  <span className="tb-field-label">
                    MCP sunucuları<span className="tb-hint">JSON · dış uygulama bağlantıları</span>
                  </span>
                  <textarea
                    rows={8}
                    value={mcpJson}
                    onChange={(e) => setMcpJson(e.target.value)}
                    placeholder={'{\n  "ornekServer": { "type": "stdio", "command": "npx", "args": ["-y", "paket-adi"] }\n}'}
                  />
                </label>
                <label className="check switch danger-zone">
                  <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
                  <span>
                    <strong>Otomatik onay</strong>
                    <em>Araç izinlerini sormadan çalışır. Dosya silme dahil her şeyi onaysız yapar.</em>
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button className="primary" disabled={busy || !name.trim()} onClick={submit}>
            {busy ? 'Kaydediliyor…' : existing ? 'Kaydet' : 'Oluştur'}
          </button>
        </div>
    </Modal>
  );
}
