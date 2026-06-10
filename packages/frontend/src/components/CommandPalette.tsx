import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Target,
  PiggyBank,
  Repeat,
  FileText,
  Sparkles,
  Bot,
  LineChart,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: (navigate: ReturnType<typeof useNavigate>) => void;
}

const NAV_COMMANDS: Command[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, run: (n) => n('/') },
  { id: 'nav-transactions', label: 'Transaktionen', icon: ArrowLeftRight, run: (n) => n('/transactions') },
  { id: 'nav-accounts', label: 'Konten', icon: Building2, run: (n) => n('/accounts') },
  { id: 'nav-budgets', label: 'Budgets', icon: Target, run: (n) => n('/budgets') },
  { id: 'nav-savings', label: 'Sparziele', icon: PiggyBank, run: (n) => n('/savings') },
  { id: 'nav-investments', label: 'Depot', icon: LineChart, run: (n) => n('/investments') },
  { id: 'nav-recurring', label: 'Wiederkehrende Zahlungen', icon: Repeat, run: (n) => n('/recurring') },
  { id: 'nav-contracts', label: 'Verträge', icon: FileText, run: (n) => n('/contracts') },
  { id: 'nav-savings-potential', label: 'Sparpotenzial', icon: Sparkles, run: (n) => n('/savings-potential') },
  { id: 'nav-assistant', label: 'KI-Assistent', icon: Bot, run: (n) => n('/assistant') },
  { id: 'nav-settings', label: 'Einstellungen', icon: Settings, run: (n) => n('/settings') },
];

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

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = q
      ? NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
      : NAV_COMMANDS;
    if (!q) return nav;
    // Freitext zusätzlich als Transaktionssuche anbieten
    const txSearch: Command = {
      id: 'tx-search',
      label: `Transaktionen durchsuchen: „${query.trim()}“`,
      hint: 'Enter',
      icon: Search,
      run: (n) => n(`/transactions?search=${encodeURIComponent(query.trim())}`),
    };
    return [txSearch, ...nav];
  }, [query]);

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
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Befehlspalette"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-elev shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Seite öffnen oder Transaktionen durchsuchen…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-4"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={commands[activeIndex] ? `cmd-${commands[activeIndex].id}` : undefined}
          />
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
