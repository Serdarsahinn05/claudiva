import { useState } from 'react';
import type { AgentSnapshot, PromptTemplate } from '../types';
import { api } from '../api';

interface Props {
  prompts: PromptTemplate[];
  agents: AgentSnapshot[];
  onChanged: () => void;
  onSent: (agentId: string) => void;
}

export function PromptLibrary({ prompts, agents, onChanged, onSent }: Props) {
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('');
  const [target, setTarget] = useState<Record<string, string>>({});

  function openEditor(p?: PromptTemplate) {
    setEditing(p ?? null);
    setCreating(!p);
    setTitle(p?.title ?? '');
    setDescription(p?.description ?? '');
    setTemplate(p?.template ?? '');
  }

  async function save() {
    const body = { title, description, template };
    if (editing) await api.updatePrompt(editing.id, body);
    else await api.createPrompt(body);
    setEditing(null);
    setCreating(false);
    onChanged();
  }

  async function send(p: PromptTemplate) {
    const agentId = target[p.id];
    if (!agentId) return;
    await api.sendMessage(agentId, p.template);
    onSent(agentId);
  }

  const editorOpen = creating || editing !== null;

  return (
    <div className="prompt-library">
      <div className="panel">
        <div className="row spread">
          <h3>Komut & Prompt Kütüphanesi</h3>
          <button className="primary" onClick={() => openEditor()}>
            + Yeni prompt
          </button>
        </div>
        {prompts.length === 0 && (
          <div className="empty">
            <h2>Kütüphane boş</h2>
            <p>
              Eski hazır promptlar <strong>skill'e</strong> dönüştürüldü: artık terminalde <kbd>/</kbd> yazıp
              <code> /durum-ozeti</code>, <code> /hata-avi</code> gibi komutlarla çağırılıyorlar.
            </p>
            <p className="muted small">
              Buraya yalnızca sık tekrarladığın, ajana olduğu gibi göndermek istediğin uzun metinleri ekle.
              Bir davranış kuralı yazacaksan skill daha uygun: <code>~/.claude-manager/agents/&lt;ajan&gt;/skills/</code>
            </p>
          </div>
        )}
        {prompts.map((p) => (
          <div key={p.id} className="prompt-item">
            <div className="prompt-head">
              <strong>{p.title}</strong>
              {p.description && <span className="muted"> — {p.description}</span>}
            </div>
            <pre className="prompt-body">{p.template}</pre>
            <div className="row">
              <select value={target[p.id] ?? ''} onChange={(e) => setTarget({ ...target, [p.id]: e.target.value })}>
                <option value="">Ajan seç…</option>
                {agents.map((a) => (
                  <option key={a.config.id} value={a.config.id}>
                    {a.config.name}
                  </option>
                ))}
              </select>
              <button className="primary" disabled={!target[p.id]} onClick={() => send(p)}>
                Gönder
              </button>
              <button onClick={() => openEditor(p)}>Düzenle</button>
              <button
                className="danger"
                onClick={async () => {
                  await api.deletePrompt(p.id);
                  onChanged();
                }}
              >
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>

      {editorOpen && (
        <div className="modal-backdrop" onClick={() => { setEditing(null); setCreating(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Promptu düzenle' : 'Yeni prompt'}</h2>
            <label>
              Başlık
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Açıklama
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label>
              Şablon
              <textarea rows={8} value={template} onChange={(e) => setTemplate(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button onClick={() => { setEditing(null); setCreating(false); }}>Vazgeç</button>
              <button className="primary" disabled={!title.trim() || !template.trim()} onClick={save}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
