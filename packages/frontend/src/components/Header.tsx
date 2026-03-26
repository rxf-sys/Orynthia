import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, Bell, Search, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { notificationsApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.count),
    refetchInterval: 30000,
  });

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-800 bg-surface-900/80 backdrop-blur-xl px-4 md:px-6">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="Menü öffnen"
          className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search */}
        <div className="hidden md:flex items-center gap-2 rounded-xl bg-surface-800/50 border border-surface-700/50 px-3 py-2 w-72">
          <Search className="h-4 w-4 text-surface-500" />
          <input
            type="text"
            placeholder="Transaktionen suchen..."
            aria-label="Transaktionen suchen"
            className="bg-transparent text-sm text-surface-200 placeholder-surface-500 outline-none w-full"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          aria-label="Theme umschalten"
          className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          onClick={() => navigate('/settings')}
          aria-label="Benachrichtigungen"
          className="relative rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-white transition-colors"
        >
          <Bell className="h-5 w-5" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
              {unreadCount! > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-surface-700">
          <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
            {getInitials(user?.firstName, user?.lastName)}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-surface-200">
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
