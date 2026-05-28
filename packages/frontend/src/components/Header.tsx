import { Menu, Search, HelpCircle, Plus, Sun, Moon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';
import { Btn, IconBtn } from './ui/Btn';
import { NotificationBell } from './NotificationBell';

const TITLE_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transaktionen',
  '/accounts': 'Konten',
  '/budgets': 'Budgets',
  '/savings': 'Sparzielen',
  '/contracts': 'Verträgen',
  '/recurring': 'wiederkehrenden Zahlungen',
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

  const placeholder = `In ${TITLE_MAP[pathname] || 'Orynthia'} suchen…`;

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

      {/* Search */}
      <div className="hidden flex-1 items-center gap-2.5 rounded-pill border border-line bg-soft px-3.5 py-2 text-ink-3 md:flex md:max-w-[420px]">
        <Search className="h-4 w-4" />
        <input className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-4" placeholder={placeholder} />
        <span className="rounded border border-line px-1.5 py-0.5 text-[0.7rem] text-ink-3">⌘K</span>
      </div>

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

      <IconBtn icon={HelpCircle} aria-label="Hilfe" variant="ghost" className="hidden sm:grid" />
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
    </header>
  );
}
