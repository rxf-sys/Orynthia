import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

/** Formular-Modal, dessen onClose – wie überall in der App – inline ist. */
function NoteModal({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false);
        onClosed?.();
      }}
      title="Neue Notiz"
      footer={<button type="button">Speichern</button>}
    >
      <input aria-label="Titel" value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

describe('Modal', () => {
  it('behält den Fokus im Eingabefeld, während getippt wird', () => {
    render(<NoteModal />);
    const input = screen.getByLabelText('Titel') as HTMLInputElement;

    input.focus();
    // Jeder Tastendruck rendert das Elternteil neu und erzeugt ein neues
    // onClose. Früher lief der Effekt dadurch erneut und zog den Fokus auf
    // den Schließen-Button – ab dem zweiten Zeichen ging die Eingabe verloren.
    for (const ch of ['H', 'a', 'l', 'l', 'o']) {
      fireEvent.change(input, { target: { value: input.value + ch } });
      expect(document.activeElement).toBe(input);
    }
    expect(input.value).toBe('Hallo');
    cleanup();
  });

  it('fokussiert beim Öffnen das erste Feld statt des Schließen-Buttons', () => {
    render(<NoteModal />);
    expect(document.activeElement).toBe(screen.getByLabelText('Titel'));
    cleanup();
  });

  it('gibt den Seiten-Scroll frei, sobald das Modal geschlossen ist', () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="A">Inhalt</Modal>);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false} onClose={() => {}} title="A">
        Inhalt
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
    cleanup();
  });

  it('hält den Scroll gesperrt, solange noch ein verschachteltes Modal offen ist', () => {
    // Äußeres Modal (z. B. „Termin bearbeiten") und darüber ein Confirm-Dialog.
    const outer = render(
      <Modal open onClose={() => {}} title="Aussen">
        A
      </Modal>,
    );
    const inner = render(
      <Modal open onClose={() => {}} title="Innen">
        B
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    // Das äußere schließt zuerst – der Scroll muss gesperrt bleiben …
    outer.unmount();
    expect(document.body.style.overflow).toBe('hidden');

    // … und erst mit dem letzten Modal wieder freigegeben werden. Zuvor
    // schrieb jedes Modal seinen eigenen Ausgangswert zurück; in dieser
    // Reihenfolge blieb „hidden“ stehen und die App war nicht mehr scrollbar.
    inner.unmount();
    expect(document.body.style.overflow).toBe('');
    cleanup();
  });
});
