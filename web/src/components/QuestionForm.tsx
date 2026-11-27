import { useState } from 'react';
import type { PermissionRequestInfo } from '../types';
import { answerQuestion, questionsOf, skipQuestion } from '../permissions';
import { L } from '../i18n';

/**
 * Ajanın seçenekli sorusu (`AskUserQuestion`). Terminal, sohbet ve pano AYNI
 * bileşeni çizer; yalnız `variant` sınıfı görünümü ayarlar (bkz. index.css
 * "SEÇENEKLİ SORU"). Mantık:
 *  - Tek soru + tek seçim: seçeneğe tıklamak cevaptır (Gönder yok).
 *  - Birden fazla soru ya da çoklu seçim: seçilir, sonra Gönder.
 *  - Her soruda "Diğer": serbest metin (CLI'daki gibi).
 *  - Seçeneğin `preview`'ı varsa üstüne gelince/seçince altta gösterilir.
 *  - "Cevaplamadan geç": ajan cevap verilmediğini öğrenir, kendisi karar verir.
 */
export function QuestionForm({
  agentId,
  req,
  variant,
}: {
  agentId: string;
  req: PermissionRequestInfo;
  variant: 'chat' | 'terminal' | 'board';
}) {
  const qs = questionsOf(req);
  const [sel, setSel] = useState<Record<number, string[]>>({});
  const [otherOn, setOtherOn] = useState<Record<number, boolean>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [peek, setPeek] = useState<{ qi: number; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const instant = qs.length === 1 && !qs[0].multiSelect;

  const answerFor = (qi: number, s = sel, on = otherOn, txt = other) =>
    [...(s[qi] ?? []), ...(on[qi] && txt[qi]?.trim() ? [txt[qi].trim()] : [])].join(', ');
  const complete = qs.length > 0 && qs.every((_, i) => answerFor(i).trim());

  async function send(s = sel, on = otherOn, txt = other) {
    if (busy) return;
    setBusy(true);
    await answerQuestion(agentId, req, Object.fromEntries(qs.map((q, i) => [q.question, answerFor(i, s, on, txt)])));
  }
  async function skip() {
    if (busy) return;
    setBusy(true);
    await skipQuestion(agentId, req);
  }

  function pick(qi: number, label: string) {
    const q = qs[qi];
    if (q.multiSelect) {
      const cur = sel[qi] ?? [];
      setSel({ ...sel, [qi]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label] });
      return;
    }
    const next = { ...sel, [qi]: [label] };
    const on = { ...otherOn, [qi]: false };
    setSel(next);
    setOtherOn(on);
    if (instant) void send(next, on);
  }
  function toggleOther(qi: number) {
    const on = { ...otherOn, [qi]: !otherOn[qi] };
    setOtherOn(on);
    // Tek seçimde "Diğer" seçenekle yarışır: biri seçilince öteki düşer.
    if (!qs[qi].multiSelect && on[qi]) setSel({ ...sel, [qi]: [] });
  }

  return (
    <div className={`qf qf-${variant}`} role="group" aria-label={L.question.aria}>
      {qs.length === 0 && <p className="qf-text">{JSON.stringify(req.input).slice(0, 300)}</p>}
      {qs.map((q, qi) => (
        <fieldset key={qi} className="qf-q" disabled={busy}>
          <legend className="qf-head">
            {q.header && <span className="qf-chip">{q.header}</span>}
            <span className="qf-text">{q.question}</span>
            {q.multiSelect && <span className="qf-hint">{L.question.multiHint}</span>}
          </legend>
          <div className="qf-opts">
            {q.options.map((o) => {
              const on = (sel[qi] ?? []).includes(o.label);
              return (
                <button
                  key={o.label}
                  type="button"
                  className={`qf-opt${on ? ' on' : ''}${q.multiSelect ? ' multi' : ''}`}
                  aria-pressed={on}
                  onClick={() => pick(qi, o.label)}
                  onMouseEnter={() => o.preview && setPeek({ qi, preview: o.preview })}
                  onFocus={() => o.preview && setPeek({ qi, preview: o.preview })}
                >
                  <span className="qf-opt-label">{o.label}</span>
                  {o.description && <span className="qf-opt-desc">{o.description}</span>}
                </button>
              );
            })}
            <button
              type="button"
              className={`qf-opt qf-opt-other${otherOn[qi] ? ' on' : ''}`}
              aria-pressed={!!otherOn[qi]}
              onClick={() => toggleOther(qi)}
            >
              <span className="qf-opt-label">{L.question.other}</span>
            </button>
          </div>
          {otherOn[qi] && (
            <input
              className="qf-other"
              autoFocus
              placeholder={L.question.otherPlaceholder}
              value={other[qi] ?? ''}
              onChange={(e) => setOther({ ...other, [qi]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && complete) void send();
              }}
            />
          )}
          {peek?.qi === qi && <pre className="qf-preview">{peek.preview}</pre>}
        </fieldset>
      ))}
      <div className="qf-actions">
        {(!instant || otherOn[0]) && qs.length > 0 && (
          <button type="button" className="primary" disabled={busy || !complete} onClick={() => void send()}>
            {L.question.submit}
          </button>
        )}
        <button type="button" className="qf-skip" disabled={busy} onClick={() => void skip()}>
          {L.question.skip}
        </button>
      </div>
    </div>
  );
}
