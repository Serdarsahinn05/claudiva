import { useEffect, useRef, useState } from 'react';
import type { AgentSnapshot, PromptTemplate } from '../types';
import { api } from '../api';
import { ROLE_LABEL } from '../format';
import { Modal } from './Modal';
import { L } from '../i18n';

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
          <h2 className="plate-title">{L.prompts.title}</h2>
          <p className="pl-head-desc">
            {L.prompts.desc}
          </p>
        </div>
        <button className="primary" onClick={() => openEditor()}>
          {L.prompts.newPrompt}
        </button>
      </section>

      {prompts.length === 0 && (
        <div className="empty">
          <h2>{L.prompts.emptyTitle}</h2>
          <p>
            {L.prompts.emptyA}<strong>{L.prompts.emptySkill}</strong>{L.prompts.emptyB}<kbd>/</kbd>{L.prompts.emptyC}
            <code>/durum-ozeti</code>, <code>/hata-avi</code>{L.prompts.emptyD}
          </p>
          <p className="muted small">{L.prompts.emptyHint}</p>
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
                aria-label={L.prompts.targetAria}
              >
                <option value="">{L.prompts.pickAgent}</option>
                {agents.map((a) => (
                  <option key={a.config.id} value={a.config.id}>
                    {a.config.name} · {ROLE_LABEL[a.config.role] ?? a.config.role}
                  </option>
                ))}
              </select>
              <button className="primary" disabled={!target[p.id]} onClick={() => send(p)}>
                {L.common.send}
              </button>
              <div className="spacer" />
              <button onClick={() => openEditor(p)}>{L.actions.edit}</button>
              <button
                className="danger"
                onClick={async () => {
                  if (!confirm(L.prompts.confirmDelete(p.title))) return;
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
              <h2>{editing ? L.prompts.editTitle : L.prompts.newTitle}</h2>
              <span className="modal-sub">{editing ? editing.id : L.prompts.addSub}</span>
            </div>

            <div className="modal-pane">
              <label className="tb-field">
                <span className="tb-field-label">
                  {L.prompts.fieldTitle}<span className="tb-hint">{L.prompts.fieldTitleHint}</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={L.prompts.fieldTitlePh}
                  ref={titleRef}
                />
              </label>

              <label className="tb-field">
                <span className="tb-field-label">
                  {L.prompts.fieldDesc}<span className="tb-hint">{L.prompts.fieldDescHint}</span>
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={L.prompts.fieldDescPh}
                />
              </label>

              <label className="tb-field grow">
                <span className="tb-field-label">
                  {L.prompts.fieldText}
                  <span className="tb-hint">{L.prompts.fieldTextHint}</span>
                  {lines > 0 && <span className="pl-count">{L.prompts.lines(lines)}</span>}
                </span>
                <textarea
                  rows={10}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={L.prompts.textPh}
                />
              </label>
            </div>

            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button onClick={closeEditor}>{L.actions.cancel}</button>
              <button className="primary" disabled={!ready || busy} onClick={save}>
                {busy ? L.actions.saving : editing ? L.common.save : L.actions.add}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
