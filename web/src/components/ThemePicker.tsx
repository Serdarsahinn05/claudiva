import { useState } from 'react';
import type React from 'react';
import { APP_STYLES, modeFor, paletteFor, setAppStyle, setColorMode, useAppStyle, useColorMode } from '../appStyle';
import type { ColorMode } from '../appStyle';
import { CLI_MARKS, CLI_SKINS, getCliSkin, setCliSkin } from '../cliSkins';
import type { CliSkin } from '../cliSkins';
import { L } from '../i18n';

/**
 * Görünüm seçimleri: stil + terminal tipi. Ayarlar → Arayüz bölümünde çizilir
 * (2026-11-25'e kadar başlıktaki ayrı bir Görünüm modalıydı).
 *
 * Seçim anında uygulanır: ayarlar penceresi de stili izlediği için seçim
 * yapıldığı anda çerçeve, düğmeler ve tipografi gözünün önünde değişir.
 * Palet ayrıca seçilmez: stil + mod (Açık/Koyu) paleti belirler (appStyle.ts).
 * Mod stil başına hatırlanır; kartların önizlemesi her stilin KENDİ modunu
 * gösterir, yani seçince ne görüleceğini.
 */
export function AppearanceChoices() {
  const [cli, setCli] = useState<CliSkin>(getCliSkin);
  const style = useAppStyle();
  const mode = useColorMode();
  const MODES: { id: ColorMode; label: string; icon: React.ReactNode }[] = [
    {
      id: 'light',
      label: L.themePicker.light,
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
        </svg>
      ),
    },
    {
      id: 'dark',
      label: L.themePicker.dark,
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5Z" />
        </svg>
      ),
    },
  ];

  function pickCli(id: CliSkin) {
    setCliSkin(id);
    setCli(id);
  }

  return (
    <>
      <div>
        <div className="theme-group-label">{L.themePicker.style}</div>
        <div className="theme-grid" role="radiogroup" aria-label={L.themePicker.style}>
          {APP_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              role="radio"
              aria-checked={style === st.id}
              className={`theme-card${style === st.id ? ' sel' : ''}`}
              onClick={() => setAppStyle(st.id)}
            >
              {/* Önizleme stilin KENDİ paletiyle çizilir (data-theme); stil
                  token'ları kökte yaşadığı için yazı ve köşe satır içi örneklenir. */}
              <span className={`style-prev style-prev-${st.id}`} data-theme={paletteFor(st.id, modeFor(st.id))} aria-hidden="true">
                <span className="style-prev-title">
                  {st.id === 'phosphor' ? (
                    <>
                      A<em>a</em>
                    </>
                  ) : (
                    'Aa'
                  )}
                </span>
                <span className="style-prev-lines">
                  <i />
                  <i />
                </span>
                <span className="style-prev-chip" />
                <span className="style-prev-chip" />
              </span>
              <span className="theme-card-name">{st.label}</span>
              <span className="theme-card-desc">{st.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mod: seçili stilin açık ya da koyu paleti. */}
      <div>
        <div className="theme-group-label">{L.themePicker.mode}</div>
        <div className="mode-seg" role="radiogroup" aria-label={L.themePicker.mode}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setColorMode(m.id)}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal tipi: stilden AYRI eksen; tüm terminalleri birden etkiler. */}
      <div>
        <div className="theme-group-label">{L.themePicker.terminalType}</div>
        <div className="theme-grid" role="radiogroup" aria-label={L.themePicker.terminalType}>
          {CLI_SKINS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={cli === s.id}
              className={`theme-card${cli === s.id ? ' sel' : ''}`}
              onClick={() => pickCli(s.id)}
            >
              <span className={`cli-skin-swatch cli-skin-swatch-${s.id}`}>
                {CLI_MARKS[s.id].text}
                {CLI_MARKS[s.id].thinking}
                {CLI_MARKS[s.id].toolresult}
              </span>
              <span className="theme-card-name">{s.name}</span>
              <span className="theme-card-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
