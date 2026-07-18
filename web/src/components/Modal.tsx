import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modalları doğrudan <body> altına taşır.
 *
 * Neden portal: `position: fixed`, transform/filter/will-change taşıyan bir
 * ata öğe varsa viewport'a değil O ATAYA göre konumlanır. Bölüm geçiş
 * animasyonu (`main > *`) transform kullandığı için modal, içerik alanının
 * içine hapsolup üstten kırpılıyordu. Portal bu zinciri tamamen atlar.
 *
 * Ayrıca Esc ile kapatma ve arka plan kaydırmasını dondurma burada toplanır.
 */
interface Props {
  onClose: () => void;
  children: React.ReactNode;
  /** Geniş form (ajan düzenleme) için. */
  wide?: boolean;
}

export function Modal({ onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
