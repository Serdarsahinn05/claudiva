import { useState } from 'react';
import type { AgentDraft, AgentSnapshot, McpServerDef } from '../types';
import { McpFromAitmpl } from './McpFromAitmpl';
import { AitmplPicker } from './AitmplPicker';
import { api } from '../api';
import { Modal } from './Modal';
import { L } from '../i18n';
import { delocalize } from '../agentI18n';

interface Props {
  existing?: AgentSnapshot;
  /** Mevcut takım adları — öneri listesi. Takım kayıt defteri yok, bunlar
   *  ajanlardan türetilir (bkz. teams.ts), yani liste yalnızca yazmayı
   *  kolaylaştırır; buraya yeni bir ad yazmak takımı var eder. */
  teams?: string[];
  onClose: () => void;
  onSaved: () => void;
}

type Section = 'sablon' | 'kimlik' | 'yetenek' | 'kisilik' | 'gelismis';

/** Şablon bölümü yalnız YENİ ajanda: var olan ajanın üstüne şablon dökmek
 *  kişiliğini sessizce ezerdi. */
const TEMPLATE_SECTION = { id: 'sablon' as const, label: L.agentForm.secTemplate, hint: L.agentForm.secTemplateHint };

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'kimlik', label: L.agentForm.secId, hint: L.agentForm.secIdHint },
  { id: 'yetenek', label: L.agentForm.secSkill, hint: L.agentForm.secSkillHint },
  { id: 'kisilik', label: L.agentForm.secPersona, hint: L.agentForm.secPersonaHint },
  { id: 'gelismis', label: L.agentForm.secAdvanced, hint: L.agentForm.secAdvancedHint },
];

const ROLES = [
  { id: 'boss', label: L.roles.boss, desc: L.agentForm.roleDesc.boss },
  { id: 'manager', label: L.roles.manager, desc: L.agentForm.roleDesc.manager },
  { id: 'team-leader', label: L.roles['team-leader'], desc: L.agentForm.roleDesc['team-leader'] },
  { id: 'worker', label: L.roles.worker, desc: L.agentForm.roleDesc.worker },
] as const;

const MODELS = [
  { id: 'haiku', label: 'Haiku', desc: L.agentForm.modelDesc.haiku },
  { id: 'sonnet', label: 'Sonnet', desc: L.agentForm.modelDesc.sonnet },
  { id: 'opus', label: 'Opus', desc: L.agentForm.modelDesc.opus },
] as const;

const MEMORY = [
  { id: 'both', label: L.agentForm.memory.both },
  { id: 'shared', label: L.agentForm.memory.shared },
  { id: 'private', label: L.agentForm.memory.private },
  { id: 'none', label: L.agentForm.memory.none },
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

export function AgentForm({ existing, teams = [], onClose, onSaved }: Props) {
  const [section, setSection] = useState<Section>('kimlik');
  const [name, setName] = useState(existing?.config.name ?? '');
  const [team, setTeam] = useState(existing?.config.team ?? '');
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
  const [template, setTemplate] = useState<string | undefined>(undefined);
  const [tplRisky, setTplRisky] = useState(false);
  const [notice, setNotice] = useState('');
  const sections = existing ? SECTIONS : [TEMPLATE_SECTION, ...SECTIONS];
  const [mcpPicker, setMcpPicker] = useState(false);

  /** aitmpl MCP'sini formun JSON kutusuna ekler; ad çakışırsa sonek. Ajan
   *  ancak form kaydedilince değişir. */
  function addMcp(name: string, def: McpServerDef) {
    let cur: Record<string, unknown> = {};
    if (mcpJson.trim()) {
      try {
        cur = JSON.parse(mcpJson) as Record<string, unknown>;
      } catch {
        setError(L.agentForm.mcpJsonBroken);
        return;
      }
    }
    let key = name;
    for (let n = 2; key in cur; n++) key = `${name}-${n}`;
    cur[key] = def;
    setMcpJson(JSON.stringify(cur, null, 2));
    setMcpPicker(false);
    setError('');
    setNotice(L.agentForm.mcpAdded(key));
  }

  function applyDraft(d: AgentDraft) {
    setName(d.name);
    setDescription(d.description);
    if (d.model) setModel(d.model);
    setPersonality(d.personality);
    setRole('worker');
    setTemplate(d.template);
    setTplRisky(d.scan?.severity === 'HIGH' || d.scan?.severity === 'CRITICAL');
    setNotice(L.agentForm.tplFilled(d.name));
    setSection('kimlik');
  }

  // Düzenlemede kişilik metni snapshot'ta gelmez; boş bırakmak "değiştirme" demek.
  async function submit() {
    setError('');
    setBusy(true);
    try {
      let mcpServers: unknown;
      if (mcpJson.trim()) mcpServers = JSON.parse(mcpJson);
      if (existing) {
        // Gösterilen çeviri değişmeden kaydedilirse paket adı (tr) diske gider.
        const cfg = existing.config;
        const patch: Record<string, unknown> = {
          name: delocalize(cfg, 'name', name), team, role, model, memoryMode, autoApprove, autoModel,
          description: delocalize(cfg, 'description', description), mcpServers,
        };
        if (personality.trim() || personalityLoaded) patch.personality = personality;
        await api.updateAgent(existing.config.id, patch);
      } else {
        await api.createAgent({
          name, team, role, model, memoryMode, autoApprove, autoModel, description, personality, mcpServers, template,
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
          <h2>{existing ? existing.config.name : L.agentForm.newTitle}</h2>
          <span className="modal-sub">{existing ? L.agentForm.editSub : L.agentForm.newSub}</span>
        </div>

        <div className="modal-body">
          {/* Bölüm seçici — uzun formu dört parçaya böler */}
          <nav className="modal-nav">
            {sections.map((s) => (
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
            {section === 'sablon' && !existing && (
              <AitmplPicker
                kind="agents"
                note={L.agentForm.tplNote}
                onPick={async (id) => applyDraft(await api.aitmplAgentDraft(id))}
              />
            )}

            {section === 'kimlik' && (
              <>
                <label className="tb-field">
                  <span className="tb-field-label">{L.agentForm.name}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L.agentForm.namePh} />
                </label>
                {/* Takım serbest metindir ve datalist bir KISITLAMA DEĞİL öneri:
                    yeni bir ad yazmak yeni takımı var eder (bkz. teams.ts). */}
                <label className="tb-field">
                  <span className="tb-field-label">
                    {L.agentForm.team}<span className="tb-hint">{L.agentForm.teamHint}</span>
                  </span>
                  <input
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder={L.agentForm.teamPh}
                    list="cm-teams"
                    autoComplete="off"
                  />
                  <datalist id="cm-teams">
                    {teams.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
                <label className="tb-field">
                  <span className="tb-field-label">
                    {L.agentForm.desc}<span className="tb-hint">{L.agentForm.descHint}</span>
                  </span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={L.agentForm.descPh}
                  />
                </label>
              </>
            )}

            {section === 'yetenek' && (
              <>
                <div className="tb-field">
                  <span className="tb-field-label">{L.extra.role}</span>
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
                    {L.agentForm.model}<span className="tb-hint">{L.agentForm.modelHint}</span>
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
                    <strong>{L.agentForm.autoModel}</strong>
                    <em>{L.agentForm.autoModelDesc}</em>
                  </span>
                </label>

                <div className="tb-field">
                  <span className="tb-field-label">{L.agentForm.memoryLabel}</span>
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
                  {L.agentForm.persona}<span className="tb-hint">{L.agentForm.personaHint}</span>
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
                      ? L.agentForm.personaKeep
                      : L.agentForm.personaPh
                  }
                />
              </label>
            )}

            {section === 'gelismis' && (
              <>
                {mcpPicker ? (
                  <McpFromAitmpl onAdd={addMcp} onClose={() => setMcpPicker(false)} />
                ) : (
                  <div className="sk-tools">
                    <button type="button" onClick={() => setMcpPicker(true)}>
                      {L.agentForm.mcpFromAitmpl}
                    </button>
                  </div>
                )}
                <label className="tb-field">
                  <span className="tb-field-label">
                    {L.agentForm.mcp}<span className="tb-hint">{L.agentForm.mcpHint}</span>
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
                    <strong>{L.agentForm.autoApprove}</strong>
                    <em>{L.agentForm.autoApproveDesc}</em>
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        {notice && (
          <div className="sk-notice">
            {notice}
            {template && <span className="muted"> · {L.agentForm.tplFrom(template)}</span>}
          </div>
        )}
        {tplRisky && <div className="sk-src-err">{L.agentForm.tplRisk}</div>}
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>{L.actions.cancel}</button>
          <button className="primary" disabled={busy || !name.trim()} onClick={submit}>
            {busy ? L.actions.saving : existing ? L.common.save : L.agentForm.create}
          </button>
        </div>
    </Modal>
  );
}
