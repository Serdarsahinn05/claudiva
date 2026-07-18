/**
 * Sol gezinme rayı. Üstteki sekme dizisinin yerini alır: ikonlar dikey durur,
 * dar kalır ve içerik alanına yer bırakır. Rozet (badge) bekleyen izin gibi
 * dikkat isteyen durumları ilgili bölümün üzerinde gösterir.
 */
export interface RailItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: number;
}

interface Props {
  items: RailItem[];
  active: string;
  onSelect: (id: string) => void;
}

export function Rail({ items, active, onSelect }: Props) {
  return (
    <nav className="rail" aria-label="Bölümler">
      {items.map((it) => (
        <button
          key={it.id}
          className={`rail-btn${active === it.id ? ' active' : ''}`}
          onClick={() => onSelect(it.id)}
          disabled={it.disabled}
          title={it.label}
          aria-current={active === it.id ? 'page' : undefined}
        >
          <span className="rail-icon">{it.icon}</span>
          <span className="rail-label">{it.label}</span>
          {it.badge ? <span className="rail-badge">{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

/* --- ikonlar: tek renk, 1.5px çizgi, 20x20 --- */
const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const ICONS = {
  bridge: svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></>),
  office: svg(<><rect x="3" y="8" width="18" height="12" rx="1.5" /><path d="M7 8V5h10v3M7 20v-4h4v4" /></>),
  panel: svg(<><rect x="3" y="3" width="7.5" height="7.5" rx="1" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" /></>),
  terminal: svg(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7 9l3 3-3 3M13 15h4" /></>),
  tasks: svg(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1.2 1.2L7.5 4.8M4 12l1.2 1.2L7.5 10.8M4 18l1.2 1.2L7.5 16.8" /></>),
  prompts: svg(<><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12.5h5" /></>),
};
