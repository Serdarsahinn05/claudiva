import { useState } from 'react';
import { APP_STYLES, STYLE_DEFAULT_THEME, setAppStyle, useAppStyle } from '../appStyle';
import { CLI_MARKS, CLI_SKINS, getCliSkin, setCliSkin } from '../cliSkins';
import type { CliSkin } from '../cliSkins';
import { L } from '../i18n';

/**
 * Görünüm seçimleri: stil + terminal tipi. Ayarlar → Arayüz bölümünde çizilir
 * (2026-11-25'e kadar başlıktaki ayrı bir Görünüm modalıydı).
 *
 * Seçim anında uygulanır: ayarlar penceresi de stili izlediği için seçim
 * yapıldığı anda çerçeve, düğmeler ve tipografi gözünün önünde değişir.
 * Palet ayrıca seçilmez; her stilin tek paleti var (themes.ts).
 */
export function AppearanceChoices() {
  const [cli, setCli] = useState<CliSkin>(getCliSkin);
  const style = useAppStyle();

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
              <span className={`style-prev style-prev-${st.id}`} data-theme={STYLE_DEFAULT_THEME[st.id]} aria-hidden="true">
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
