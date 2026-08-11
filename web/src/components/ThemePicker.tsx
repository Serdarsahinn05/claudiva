import { useState } from 'react';
import { Modal } from './Modal';
import { THEMES, THEME_GROUPS, getTheme, setTheme } from '../themes';
import { CLI_MARKS, CLI_SKINS, getCliSkin, setCliSkin } from '../cliSkins';
import type { CliSkin } from '../cliSkins';

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
  const [current, setCurrent] = useState(getTheme);
  const [cli, setCli] = useState<CliSkin>(getCliSkin);

  function pick(id: string) {
    setTheme(id);
    setCurrent(id);
  }

  function pickCli(id: CliSkin) {
    setCliSkin(id);
    setCli(id);
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="modal-head">
        <h2>Görünüm</h2>
        <span className="modal-sub">seçim anında uygulanır</span>
      </div>

      <div className="modal-pane">
        {/* Terminal tipi: temadan AYRI eksen; tüm terminalleri birden etkiler. */}
        <div>
          <div className="theme-group-label">Terminal tipi</div>
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

        {THEME_GROUPS.map((group) => (
          <div key={group}>
            <div className="theme-group-label">{group}</div>
            <div className="theme-grid">
              {THEMES.filter((t) => t.group === group).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-card${current === t.id ? ' sel' : ''}`}
                  onClick={() => pick(t.id)}
                  aria-pressed={current === t.id}
                >
                  {/*
                    Minyatür önizleme: kendi data-theme'ini taşır, dolayısıyla
                    içindeki var(--...) çağrıları o temanın token'larını okur.
                    Renkleri burada tekrar yazmak gerekmiyor.
                  */}
                  <span className="theme-swatch" data-theme={t.id}>
                    <span className="theme-swatch-panel">
                      <span className="theme-swatch-bar w2 t-fg" />
                      <span className="theme-swatch-bar w1 t-muted" />
                      <span className="theme-swatch-btn" />
                    </span>
                  </span>
                  <span className="theme-card-name">{t.name}</span>
                  <span className="theme-card-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="modal-actions">
        <button onClick={onClose}>Kapat</button>
      </div>
    </Modal>
  );
}
