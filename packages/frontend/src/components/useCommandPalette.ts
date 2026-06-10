import { useEffect, useState } from 'react';

/** Globaler ⌘K/Strg+K-Listener für die Befehlspalette. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return { open, openPalette: () => setOpen(true), closePalette: () => setOpen(false) };
}
