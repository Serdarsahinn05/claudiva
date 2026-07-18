import { useState } from 'react';
import { Modal } from './Modal';
import { THEMES, THEME_GROUPS, getTheme, setTheme } from '../themes';

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

  function pick(id: string) {
    setTheme(id);
    setCurrent(id);
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="modal-head">
        <h2>Tema</h2>
        <span className="modal-sub">seçim anında uygulanır</span>
      </div>

      <div className="modal-pane">
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
