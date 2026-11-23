import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import type { AgentSnapshot } from '../types';
import type { CliSkin } from '../cliSkins';
import { CLI_MARKS } from '../cliSkins';
import { L } from '../i18n';

/**
 * Giriş kutusu — her CLI'ın kendi composer'ı.
 *
 * `SkinnedTranscript`/`SkinnedPermission` ile aynı ilke: brainless'taki üç
 * CLI referans alınır ama bileşenler OLDUĞU GİBİ kullanılmaz. brainless
 * composer'ları shadcn/Tailwind ve GÖMÜLÜ hex renklerle geliyor; buraya
 * konsaydı terminalin skin token'larını (bkz. index.css `.terminal[data-cli]`)
 * atlar, plaka temasından da kopardı ve `contrast.mjs` ölçemezdi. Yapı taklit
 * edilir, renk token'dan gelir.
 *
 * Kip satırı SÜS DEĞİL: gerçek izin kipini gösterir (oto onay mı, her araç
 * için sorulacak mı). Bu bilgi panelde başka hiçbir yerde terminalin içinde
 * görünmüyordu — kullanıcı bir aracın neden sorulmadan çalıştığını ancak ajan
 * kartına dönüp bakarak anlıyordu.
 */
interface Props {
  skin: CliSkin;
  agent: AgentSnapshot;
  value: string;
  placeholder: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  /** Slash komut menüsü; composer kutusuna göre konumlanır. */
  menu?: ReactNode;
}

/** Kip: gerçek `autoApprove` ayarı + bekleyen izin sayısı. */
function modeOf(agent: AgentSnapshot): { glyph: string; label: string; tone: 'auto' | 'manual' | 'wait' } {
  if (agent.pendingPermissions.length > 0) {
    return { glyph: '⏸', label: L.composerMode.pending(agent.pendingPermissions.length), tone: 'wait' };
  }
  return agent.config.autoApprove
    ? { glyph: '⏵⏵', label: L.composerMode.auto, tone: 'auto' }
    : { glyph: '⏸', label: L.composerMode.manual, tone: 'manual' };
}

export function SkinnedComposer({
  skin,
  agent,
  value,
  placeholder,
  inputRef,
  onChange,
  onKeyDown,
  onBlur,
  menu,
}: Props) {
  const marks = CLI_MARKS[skin];
  const mode = modeOf(agent);
  const working = agent.status === 'working';

  return (
    <div className="composer" data-cli={skin}>
      <div className="terminal-input">
        {menu}
        <span className="prompt-mark">{marks.prompt}</span>
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      </div>

      <div className="composer-mode" data-tone={mode.tone}>
        <span className="composer-glyph">{mode.glyph}</span>
        <span>{mode.label}</span>
        {working && (
          <>
            <span className="hint-sep">·</span>
            <span>
              <kbd>Esc</kbd> durdur
            </span>
          </>
        )}
      </div>
    </div>
  );
}
