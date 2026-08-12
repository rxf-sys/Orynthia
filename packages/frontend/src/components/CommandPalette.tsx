import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  CheckSquare,
  ChefHat,
  ClipboardList,
  StickyNote,
  Plane,
  FolderLock,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchApi, type SearchHit } from '@/platform/api/search';
import { ALL_MODULES } from './navigation';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: (navigate: ReturnType<typeof useNavigate>) => void;
}

// Navigationsbefehle kommen aus der Registry – so fehlt hier kein Modul,
// wenn eines dazukommt.
const NAV_COMMANDS: Command[] = ALL_MODULES.map((mod) => ({
  id: `nav-${mod.to}`,
  label: mod.label,
  icon: mod.icon,
  run: (n) => n(mod.to),
}));

const MODULE_ICON: Record<SearchHit['module'], LucideIcon> = {
  tasks: CheckSquare,
  calendar: Calendar,
  recipes: ChefHat,
  lists: ClipboardList,
  notes: StickyNote,
  trips: Plane,
  documents: FolderLock,
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Tippen entkoppeln: erst nach kurzer Pause suchen, damit nicht jede
  // Eingabe sofort einen Request auslöst.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: hits, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchApi.query(debounced).then((r) => r.data),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = q
      ? NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
      : NAV_COMMANDS;
    if (!q) return nav;

    // Modulübergreifende Treffer (Aufgaben, Termine, Rezepte, Listen)
    const moduleHits: Command[] = (hits ?? []).map((hit) => ({
      id: `hit-${hit.module}-${hit.id}`,
      label: hit.title,
      hint: hit.subtitle,
      icon: MODULE_ICON[hit.module],
      run: (n) => n(hit.to),
    }));

    // Freitext zusätzlich als Transaktionssuche anbieten
    const txSearch: Command = {
      id: 'tx-search',
      label: `Transaktionen durchsuchen: „${query.trim()}“`,
      hint: 'Enter',
      icon: Search,
      run: (n) => n(`/finance/transactions?search=${encodeURIComponent(query.trim())}`),
    };
    return [...moduleHits, txSearch, ...nav];
  }, [query, hits]);

  const runCommand = useCallback(
    (cmd: Command) => {
      cmd.run(navigate);
      onClose();
    },
    [navigate, onClose],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Fokus nach dem Mount des Portals
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, commands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = commands[activeIndex];
        if (cmd) runCommand(cmd);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, commands, activeIndex, onClose, runCommand]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] animate-o-fade"
      style={{ background: 'rgba(6, 7, 11, 0.66)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Befehlspalette"
    >
      <div className="w-[min(620px,92vw)] overflow-hidden rounded-lg border border-line bg-elev shadow-overlay">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen: Aufgaben, Termine, Rezepte, Listen…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-4"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={commands[activeIndex] ? `cmd-${commands[activeIndex].id}` : undefined}
          />
          {/* Blinkender Cursor als Zeichen, dass die Eingabe aktiv ist */}
          {query.length === 0 && (
            <span aria-hidden className="h-4 w-px shrink-0 animate-o-pulse bg-violet" />
          )}
          {isFetching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-3" />}
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[0.7rem] text-ink-3">Esc</kbd>
        </div>
        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-[50vh] overflow-y-auto p-1.5"
        >
          {commands.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-3">Keine Treffer</li>
          )}
          {commands.map((cmd, i) => (
            <li key={cmd.id} role="presentation">
              <button
                id={`cmd-${cmd.id}`}
                data-index={i}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => runCommand(cmd)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm',
                  i === activeIndex ? 'bg-soft text-ink' : 'text-ink-2',
                )}
              >
                <cmd.icon className="h-4 w-4 shrink-0 text-ink-3" />
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hint && (
                  <kbd className="rounded border border-line px-1.5 py-0.5 text-[0.7rem] text-ink-3">
                    {cmd.hint}
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
