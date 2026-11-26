import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { McpDraft, McpServerDef } from '../types';
import { L } from '../i18n';
import { AitmplPicker } from './AitmplPicker';

/**
 * Ajan formu → Gelişmiş → "aitmpl'den MCP ekle".
 *
 * Seçim hiçbir şey KAYDETMEZ: taslak gözden geçirilir, alanlar doldurulur,
 * açık onayla formun MCP kutusuna (JSON) eklenir; ajan ancak form
 * kaydedilince değişir. Bu adım diğerlerinden riskli (bkz.
 * docs/AITMPL-ENTEGRASYON.md, 4. adım): yerel MCP kullanıcının yetkisiyle kod
 * çalıştırır, anahtarlar `config.json`a düz metin yazılır, her araç tanımı
 * ajanın her oturumuna token ekler. Üçü de onaydan önce açıkça yazılır.
 */
export function McpFromAitmpl({
  onAdd,
  onClose,
}: {
  /** Ad + tanım; çakışma ve JSON birleştirme çağıranda. */
  onAdd: (name: string, def: McpServerDef) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<McpDraft | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [ack, setAck] = useState(false);
  /** Seçilen satır ekrandan kalkınca odak incelemenin ilk alanına (yoksa
   *  başlığa) taşınır; yoksa body'ye düşüp pencereden kaçıyordu. */
  const firstRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (draft) (firstRef.current ?? headRef.current)?.focus();
  }, [draft]);

  const fieldKey = (where: string, key: string) => `${where}:${key}`;
  /** Yer tutucu alanın başlangıç değeri: boş, ama başlıkta "Bearer " ön eki
   *  korunur (kullanıcı yalnız anahtarı yazsın; ölçüldü: 4 başlık böyle). */
  const startOf = (f: McpDraft['fields'][number]) =>
    !f.placeholder ? f.value : f.where === 'header' ? (f.value.match(/^(Bearer|Token|Basic)\s+/i)?.[0] ?? '') : '';

  function pick(d: McpDraft) {
    setDraft(d);
    setAck(false);
    // Yer tutucu boş başlar (kullanıcı yazsın), makul varsayılan dolu kalır.
    setValues(Object.fromEntries(d.fields.map((f) => [fieldKey(f.where, f.key), startOf(f)])));
  }

  if (!draft) {
    return (
      <div className="mcp-add">
        <AitmplPicker
          kind="mcps"
          note={L.agentForm.mcpPickNote}
          onPick={async (id) => pick(await api.aitmplMcpDraft(id))}
        />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {L.actions.cancel}
          </button>
        </div>
      </div>
    );
  }

  // Boş ya da yalnız korunan ön ek ("Bearer") kalmışsa alan eksik sayılır.
  const missing = draft.fields.filter((f) => {
    const v = (values[fieldKey(f.where, f.key)] ?? '').trim();
    return !v || (f.placeholder && v === startOf(f).trim());
  });
  const def = draft.def;
  const commandLine = def.type === 'stdio' ? [def.command, ...(def.args ?? [])].join(' ') : (def.url ?? '');

  function add() {
    if (!draft) return;
    const env: Record<string, string> = {};
    const headers: Record<string, string> = {};
    for (const f of draft.fields) {
      const v = values[fieldKey(f.where, f.key)] ?? '';
      if (f.where === 'env') env[f.key] = v;
      else headers[f.key] = v;
    }
    const out: McpServerDef = { ...draft.def };
    if (Object.keys(env).length) out.env = env;
    if (Object.keys(headers).length) out.headers = headers;
    onAdd(draft.name, out);
  }

  return (
    <div className="mcp-add">
      <div className="sk-top" ref={headRef} tabIndex={-1}>
        <span className="sk-name">{draft.name}</span>
        <span className={`chip ${draft.kind === 'local' ? 'chip-warn' : 'chip-pending'}`}>
          {draft.kind === 'local' ? L.agentForm.mcpLocal : L.agentForm.mcpRemote}
        </span>
      </div>
      {draft.description && <p className="sk-desc">{draft.description}</p>}
      <code className="mcp-cmd">{commandLine}</code>

      {draft.fields.length > 0 && (
        <div className="mcp-fields">
          {draft.fields.map((f, i) => (
            <label key={fieldKey(f.where, f.key)} className="tb-field">
              <span className="tb-field-label">
                {f.key}
                <span className="tb-hint">{f.where === 'env' ? L.agentForm.mcpEnv : L.agentForm.mcpHeader}</span>
              </span>
              <input
                ref={i === 0 ? firstRef : undefined}
                type={f.placeholder ? 'password' : 'text'}
                autoComplete="off"
                value={values[fieldKey(f.where, f.key)] ?? ''}
                placeholder={f.value}
                onChange={(e) => setValues({ ...values, [fieldKey(f.where, f.key)]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}

      <ul className="mcp-warn">
        {draft.kind === 'local' && <li>{L.agentForm.mcpWarnLocal}</li>}
        {draft.fields.length > 0 && <li>{L.agentForm.mcpWarnPlain}</li>}
        {draft.argsPlaceholder && <li>{L.agentForm.mcpWarnArgs}</li>}
        <li>{L.agentForm.mcpWarnTokens}</li>
      </ul>

      <label className="check small">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>{L.agentForm.mcpAck}</span>
      </label>

      <div className="modal-actions">
        <button type="button" onClick={() => setDraft(null)}>
          {L.agentForm.mcpBack}
        </button>
        <button type="button" className="primary" disabled={!ack || missing.length > 0} onClick={add}>
          {missing.length > 0 ? L.agentForm.mcpMissing(missing.length) : L.agentForm.mcpAdd}
        </button>
      </div>
    </div>
  );
}
