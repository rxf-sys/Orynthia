import { useEffect } from 'react';
import { Menu, Search, HelpCircle, Plus, Sun, Moon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';
import { Btn, IconBtn } from './ui/Btn';
import { NotificationBell } from './NotificationBell';
import { CommandPalette, useCommandPalette } from './CommandPalette';

const TITLE_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transaktionen',
  '/accounts': 'Konten',
  '/budgets': 'Budgets',
  '/savings': 'Sparziele',
  '/investments': 'Depot',
  '/recurring': 'Wiederkehrende Zahlungen',
  '/contracts': 'Verträge',
  '/savings-potential': 'Sparpotenzial',
  '/assistant': 'KI-Assistent',
  '/settings': 'Einstellungen',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.set);
  const { open, openPalette, closePalette } = useCommandPalette();

  const pageTitle = TITLE_MAP[pathname];

  // Tab-Titel pro Route – hilft bei History, Bookmarks und mehreren Tabs.
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} – Orynthia` : 'Orynthia';
  }, [pageTitle]);

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 border-b border-line px-4 py-3 backdrop-blur md:gap-4 md:px-8 md:py-[18px]"
      style={{ background: 'color-mix(in oklab, var(--bg-elev) 80%, transparent)' }}
    >
      <button
        onClick={onMenuClick}
        aria-label="Menü öffnen"
        className="grid h-9 w-9 place-items-center rounded-md border border-line bg-elev text-ink-2 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Befehlspalette: Navigation + Transaktionssuche */}
      <button
        onClick={openPalette}
        className="hidden flex-1 items-center gap-2.5 rounded-pill border border-line bg-soft px-3.5 py-2 text-left text-ink-3 transition-colors hover:border-ink-4 md:flex md:max-w-[420px]"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-sm text-ink-4">Suchen oder Seite öffnen…</span>
        <span className="rounded border border-line px-1.5 py-0.5 text-[0.7rem] text-ink-3">⌘K</span>
      </button>
      <IconBtn
        icon={Search}
        aria-label="Suche öffnen"
        variant="ghost"
        className="md:hidden"
        onClick={openPalette}
      />

      <div className="flex-1 md:flex-none" />

      {/* Theme toggle */}
      <div className="theme-toggle">
        <button
          aria-label="Helles Theme"
          title="Hell"
          onClick={() => setTheme('light')}
          className={cn(theme === 'light' && 'active')}
        >
          <Sun className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Dunkles Theme"
          title="Dunkel"
          onClick={() => setTheme('dark')}
          className={cn(theme === 'dark' && 'active')}
        >
          <Moon className="h-3.5 w-3.5" />
        </button>
      </div>

      <IconBtn
        icon={HelpCircle}
        aria-label="Hilfe – KI-Assistent öffnen"
        variant="ghost"
        className="hidden sm:grid"
        onClick={() => navigate('/assistant')}
      />
      <NotificationBell />

      <Btn
        variant="grad"
        size="sm"
        icon={Plus}
        onClick={() => navigate('/transactions')}
        className="hidden sm:inline-flex"
      >
        Neu
      </Btn>

      <CommandPalette open={open} onClose={closePalette} />
    </header>
  );
}
