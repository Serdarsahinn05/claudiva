import { useState } from 'react';
import { Modal } from './Modal';
import { APP_STYLES, STYLE_DEFAULT_THEME, setAppStyle, useAppStyle, type AppStyle } from '../appStyle';
import { CLI_MARKS, CLI_SKINS, getCliSkin, setCliSkin } from '../cliSkins';
import type { CliSkin } from '../cliSkins';
import { L } from '../i18n';

interface Props {
  onClose: () => void;
}

/**
 * Tema seçici.
 *
 * Seçim anında uygulanır ve modal açık kalır — temaları yan yana denemenin
 * tek yolu bu. Modalın kendisi de temayı takip ettiği için seçim yapıldığı
 * anda çerçeve, düğmeler ve tipografi gözünün önünde değişir.
 */
export function ThemePicker({ onClose }: Props) {
  const [cli, setCli] = useState<CliSkin>(getCliSkin);
  const style = useAppStyle();

  // Palet stilden türer (themes.ts); ayrıca seçilmez.
  function pickStyle(id: AppStyle) {
    setAppStyle(id);
  }

  function pickCli(id: CliSkin) {
    setCliSkin(id);
    setCli(id);
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="modal-head">
        <h2>{L.themePicker.title}</h2>
        <span className="modal-sub">{L.themePicker.subtitle}</span>
      </div>

      <div className="modal-pane">
        {/* Stil: tasarım dili + kendi tek paleti (2026-11-25'ten beri palet seçimi yok). */}
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
                onClick={() => pickStyle(st.id)}
              >
                {/* Önizleme stilin KENDİ paletiyle çizilir (data-theme): o anki
                    palet her üç kartı da aynı renge boyuyordu, Stüdyo'nun açık
                    yüzeyi ve Fosfor'un limonu görünmüyordu. Stil token'ları
                    kökte yaşadığı için yazı ve köşe satır içi örneklenir. */}
                <span
                  className={`style-prev style-prev-${st.id}`}
                  data-theme={STYLE_DEFAULT_THEME[st.id]}
                  aria-hidden="true"
                >
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

        {/* Terminal tipi: temadan AYRI eksen; tüm terminalleri birden etkiler. */}
        <div>
          <div className="theme-group-label">{L.themePicker.terminalType}</div>
          <div className="theme-grid">
            {CLI_SKINS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`theme-card${cli === s.id ? ' sel' : ''}`}
                onClick={() => pickCli(s.id)}
                aria-pressed={cli === s.id}
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
      </div>

      <div className="modal-actions">
        <button onClick={onClose}>{L.common.close}</button>
      </div>
    </Modal>
  );
}
