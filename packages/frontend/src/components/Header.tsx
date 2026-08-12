import { useEffect } from 'react';
import { Menu, Search, MessageSquare, Sun, Moon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { IconBtn } from './ui/Btn';
import { Avatar } from './ui/Avatar';
import { NotificationBell } from './NotificationBell';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette } from './useCommandPalette';
import { titleForPath } from './navigation';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.set);
  const user = useAuthStore((s) => s.user);
  const { open, openPalette, closePalette } = useCommandPalette();

  const pageTitle = titleForPath(pathname);

  // Tab-Titel pro Route – hilft bei History, Bookmarks und mehreren Tabs.
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} – Orynthia` : 'Orynthia';
  }, [pageTitle]);

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : (user?.email?.split('@')[0] ?? 'Konto');

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line px-4 py-3 backdrop-blur-[10px] md:gap-3 md:px-[22px] md:py-[13px]"
      style={{ background: 'color-mix(in oklab, var(--bg-elev) 88%, transparent)' }}
    >
      <button
        onClick={onMenuClick}
        aria-label="Menü öffnen"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line bg-soft text-ink-2 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobil steht hier der Seitentitel, damit man weiß, wo man ist. */}
      <span className="truncate text-[0.95rem] font-bold text-ink md:hidden">{pageTitle}</span>

      {/* Befehlspalette: Navigation + modulübergreifende Suche */}
      <button
        onClick={openPalette}
        className="hidden min-w-[210px] max-w-[420px] flex-1 items-center gap-2.5 rounded-pill border border-line bg-soft px-3.5 py-[9px] text-left text-ink-3 transition-colors hover:border-ink-4 md:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-[0.84rem] text-ink-4">Suchen oder Seite öffnen…</span>
        <span className="shrink-0 rounded-md border border-line px-[7px] py-[2px] text-[0.68rem] text-ink-3">
          ⌘K
        </span>
      </button>
      <IconBtn
        icon={Search}
        aria-label="Suche öffnen"
        variant="ghost"
        className="md:hidden"
        onClick={openPalette}
      />

      <div className="flex-1 md:flex-none" />

      <div className="theme-toggle hidden sm:flex">
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
        icon={MessageSquare}
        aria-label="KI-Assistent öffnen"
        variant="ghost"
        className="hidden sm:grid"
        onClick={() => navigate('/assistant')}
      />
      <NotificationBell />

      <button
        onClick={() => navigate('/settings')}
        aria-label="Konto und Einstellungen"
        className="shrink-0 rounded-pill"
      >
        <Avatar name={fullName} size={38} />
      </button>

      <CommandPalette open={open} onClose={closePalette} />
    </header>
  );
}
