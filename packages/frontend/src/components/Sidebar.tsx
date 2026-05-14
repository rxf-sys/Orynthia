import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Target,
  PiggyBank,
  Repeat,
  FileText,
  Settings,
  Search,
  MoreHorizontal,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Btn } from './ui/Btn';
import { Avatar } from './ui/Avatar';

interface NavItem {
  section?: string;
  to?: string;
  icon?: LucideIcon;
  label?: string;
  end?: boolean;
  badge?: string;
}

const NAV: NavItem[] = [
  { section: 'Übersicht' },
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transaktionen' },
  { to: '/accounts', icon: Building2, label: 'Konten' },
  { section: 'Planung' },
  { to: '/budgets', icon: Target, label: 'Budgets' },
  { to: '/savings', icon: PiggyBank, label: 'Sparziele' },
  { to: '/recurring', icon: Repeat, label: 'Wiederkehrend' },
  { section: 'Verträge' },
  { to: '/contracts', icon: FileText, label: 'Verträge', badge: 'Neu' },
  { section: 'Konto' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : user?.email?.split('@')[0] ?? 'Konto';

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-line bg-elev px-3.5 pb-4 pt-5',
          'transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="mb-5 flex items-center gap-2.5 px-2.5">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-grad-brand font-extrabold text-white"
            style={{ boxShadow: 'var(--shadow-btn)' }}
          >
            O
          </div>
          <div className="h-display text-[1.55rem] leading-none text-ink">Orynthia</div>
          <button
            onClick={onClose}
            aria-label="Menü schließen"
            className="ml-auto text-ink-3 hover:text-ink lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile search */}
        <div className="mb-2 flex items-center gap-2 rounded-pill border border-line bg-soft px-3 py-2 text-sm text-ink-3 lg:hidden">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-4"
            placeholder="Suchen…"
          />
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={`s-${i}`} className="nav-section">
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) => cn('nav-item', isActive && 'active')}
              >
                {item.icon && (
                  <span className="ico grid w-5 place-items-center text-ink-3">
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto rounded-pill bg-peach px-1.5 py-0.5 text-[0.7rem] font-bold text-navy">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ),
          )}
        </nav>

        {/* Footer promo */}
        <div
          className="mt-3 overflow-hidden rounded-lg border border-line p-3.5"
          style={{ background: 'var(--grad-soft)' }}
        >
          <div className="text-sm font-bold text-ink">Sparpotential entdecken</div>
          <div className="mt-1 text-xs leading-snug text-ink-3">
            Wir helfen dir, bei Verträgen und Abos zu sparen.
          </div>
          <Btn
            variant="grad"
            size="sm"
            className="mt-2.5"
            onClick={() => {
              navigate('/contracts');
              onClose();
            }}
          >
            Ansehen
          </Btn>
        </div>

        {/* User row */}
        <button
          onClick={() => {
            navigate('/settings');
            onClose();
          }}
          className="mt-3 flex items-center gap-2.5 rounded-md border border-line p-2.5 text-left transition-colors hover:bg-soft"
        >
          <Avatar name={fullName} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.85rem] font-semibold text-ink">{fullName}</div>
            <div className="truncate text-[0.72rem] text-ink-3">{user?.email}</div>
          </div>
          <MoreHorizontal className="h-4 w-4 text-ink-3" />
        </button>
      </aside>
    </>
  );
}
