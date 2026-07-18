import { useEffect, useRef, useState } from 'react';
import type { AgentSnapshot, PromptTemplate } from '../types';
import { api } from '../api';
import { ROLE_LABEL } from '../format';
import { Modal } from './Modal';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function openEditor(p?: PromptTemplate) {
    setError('');
    setEditing(p ?? null);
    setCreating(!p);
    setTitle(p?.title ?? '');
    setDescription(p?.description ?? '');
    setTemplate(p?.template ?? '');
  }

  function closeEditor() {
    setEditing(null);
    setCreating(false);
    setError('');
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = { title, description, template };
      if (editing) await api.updatePrompt(editing.id, body);
      else await api.createPrompt(body);
      closeEditor();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function send(p: PromptTemplate) {
    const agentId = target[p.id];
    if (!agentId) return;
    await api.sendMessage(agentId, p.template);
    onSent(agentId);
  }

  const editorOpen = creating || editing !== null;

  // autoFocus, odaklanırken kabı kaydırıp modal başlığını görüş dışına itiyordu
  // (kap overflow:hidden olduğu için geri gelmiyor). preventScroll bunu önler.
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editorOpen) titleRef.current?.focus({ preventScroll: true });
  }, [editorOpen]);
  const ready = title.trim() && template.trim();
  const lines = template ? template.split('\n').length : 0;

  return (
    <div className="prompt-library">
      <section className="pl-head">
        <div>
          <span className="bridge-mod-label" style={{ position: 'static' }}>
            Prompt Kütüphanesi
          </span>
          <p className="pl-head-desc">
            Ajana olduğu gibi gönderilen hazır metinler. Davranış kuralı yazacaksan skill daha uygun.
          </p>
        </div>
        <button className="primary" onClick={() => openEditor()}>
          + Yeni prompt
        </button>
      </section>

      {prompts.length === 0 && (
        <div className="empty">
          <h2>Kütüphane boş</h2>
          <p>
            Eski hazır promptlar <strong>skill'e</strong> dönüştürüldü: artık terminalde <kbd>/</kbd> yazıp{' '}
            <code>/durum-ozeti</code>, <code>/hata-avi</code> gibi komutlarla çağırılıyorlar.
          </p>
          <p className="muted small">
            Buraya yalnızca sık tekrarladığın, ajana olduğu gibi göndermek istediğin uzun metinleri ekle.
          </p>
        </div>
      )}

      <div className="pl-grid">
        {prompts.map((p) => (
          <article key={p.id} className="pl-card">
            <header className="pl-card-head">
              <h3 className="pl-card-title">{p.title}</h3>
              <span className="pl-card-lines">{p.template.split('\n').length} satır</span>
            </header>
            {p.description && <p className="pl-card-desc">{p.description}</p>}
            <pre className="pl-card-body">{p.template}</pre>

            <footer className="pl-card-actions">
              <select
                className="pl-target"
                value={target[p.id] ?? ''}
                onChange={(e) => setTarget({ ...target, [p.id]: e.target.value })}
                aria-label="Gönderilecek ajan"
              >
                <option value="">Ajan seç…</option>
                {agents.map((a) => (
                  <option key={a.config.id} value={a.config.id}>
                    {a.config.name} · {ROLE_LABEL[a.config.role] ?? a.config.role}
                  </option>
                ))}
              </select>
              <button className="primary" disabled={!target[p.id]} onClick={() => send(p)}>
                Gönder
              </button>
              <div className="spacer" />
              <button onClick={() => openEditor(p)}>Düzenle</button>
              <button
                className="danger"
                onClick={async () => {
                  if (!confirm(`"${p.title}" silinsin mi?`)) return;
                  await api.deletePrompt(p.id);
                  onChanged();
                }}
              >
                Sil
              </button>
            </footer>
          </article>
        ))}
      </div>

      {editorOpen && (
        <Modal onClose={closeEditor}>
            <div className="modal-head">
              <h2>{editing ? 'Promptu düzenle' : 'Yeni prompt'}</h2>
              <span className="modal-sub">{editing ? editing.id : 'kütüphaneye ekle'}</span>
            </div>

            <div className="modal-pane">
              <label className="tb-field">
                <span className="tb-field-label">
                  Başlık<span className="tb-hint">listede bunu göreceksin</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="örn. Hata raporu şablonu"
                  ref={titleRef}
                />
              </label>

              <label className="tb-field">
                <span className="tb-field-label">
                  Açıklama<span className="tb-hint">opsiyonel · ne işe yaradığı</span>
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="örn. Ustaya kök neden odaklı hata çözümü verir"
                />
              </label>

              <label className="tb-field grow">
                <span className="tb-field-label">
                  Metin
                  <span className="tb-hint">ajana aynen gönderilir</span>
                  {lines > 0 && <span className="pl-count">{lines} satır</span>}
                </span>
                <textarea
                  rows={10}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={
                    'Bağlam: hangi proje / dizin\nİstek: yapılmasını istediğin iş\nKapsam dışı: dokunulmayacaklar\nTeslim kriteri: bittiğini nasıl anlarız'
                  }
                />
              </label>
            </div>

            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button onClick={closeEditor}>Vazgeç</button>
              <button className="primary" disabled={!ready || busy} onClick={save}>
                {busy ? 'Kaydediliyor…' : editing ? 'Kaydet' : 'Ekle'}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
