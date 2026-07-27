import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Zähler statt Flag: bei verschachtelten Modals darf das erste Schließen den
// Body-Scroll nicht freigeben, solange noch ein Modal offen ist. Der
// ursprüngliche Wert wird einmalig beim ersten Modal gemerkt – würde ihn
// jedes Modal neu erfassen, könnte je nach Schließreihenfolge „hidden"
// zurückgeschrieben werden und die Seite bliebe dauerhaft unscrollbar.
let openModalCount = 0;
let restoreOverflow = '';

function lockBodyScroll() {
  if (openModalCount === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openModalCount += 1;
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) document.body.style.overflow = restoreOverflow;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // onClose ist bei fast allen Aufrufern eine Inline-Funktion und damit bei
  // jedem Render neu. Läge sie in den Dependencies, würde der Effekt bei
  // jedem Tastendruck neu laufen und den Fokus zurück auf das erste Element
  // (den Schließen-Button) ziehen – Eingaben gingen verloren.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    // Fokus-Rückgabe: das Element merken, das das Modal geöffnet hat.
    const trigger = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Fokus-Trap: Tab zykliert innerhalb des Dialogs.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    lockBodyScroll();

    // Erstes sinnvolles Element fokussieren: der Schließen-Button wird
    // übersprungen, damit der Fokus im Formular landet und nicht auf „X".
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    const target = focusable.find((el) => el.dataset.modalClose === undefined);
    if (target) target.focus();
    else dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
      trigger?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 animate-fade-in sm:items-center"
      style={{ background: 'rgba(15, 23, 42, 0.45)' }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          // Flex-Spalte mit Höhenlimit: Kopf und Fußzeile bleiben immer
          // sichtbar, nur der Inhalt scrollt. Dadurch ist der Speichern-Button
          // auch auf niedrigen Fenstern erreichbar.
          'my-auto flex w-full max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-lg border border-line bg-elev shadow-xl outline-none',
          sizes[size],
        )}
      >
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id="modal-title" className="text-lg font-bold text-ink">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
            </div>
            <button
              onClick={onClose}
              data-modal-close
              className="shrink-0 rounded p-1.5 text-ink-3 transition-colors hover:bg-soft hover:text-ink"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line bg-soft px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
