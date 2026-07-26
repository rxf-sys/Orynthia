import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Home,
  Wallet,
  Calendar,
  CheckSquare,
  ChefHat,
  CalendarRange,
  ClipboardList,
  StickyNote,
  Plane,
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
  MoreHorizontal,
  LogOut,
  ChevronDown,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Btn } from './ui/Btn';
import { Avatar } from './ui/Avatar';
import { useConfirm } from './ui/useConfirm';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  badge?: string;
}

// Zweistufige Modul-Navigation: Top-Level = Lebensbereiche, das
// Finanz-Modul trägt seine Unterseiten als aufklappbare Gruppe.
const MODULES: NavItem[] = [
  { to: '/', end: true, icon: Home, label: 'Home' },
  { to: '/calendar', icon: Calendar, label: 'Kalender' },
  { to: '/tasks', icon: CheckSquare, label: 'Aufgaben' },
  { to: '/recipes', icon: ChefHat, label: 'Rezepte' },
  { to: '/meal-plan', icon: CalendarRange, label: 'Wochenplan' },
  { to: '/lists', icon: ClipboardList, label: 'Listen' },
  { to: '/notes', icon: StickyNote, label: 'Notizen', badge: 'Neu' },
  { to: '/trips', icon: Plane, label: 'Reisen', badge: 'Neu' },
  { to: '/assistant', icon: Bot, label: 'KI-Assistent', badge: 'Beta' },
];

const FINANCE_SUB: NavItem[] = [
  { to: '/finance', end: true, icon: LineChart, label: 'Übersicht' },
  { to: '/finance/transactions', icon: ArrowLeftRight, label: 'Transaktionen' },
  { to: '/finance/accounts', icon: Building2, label: 'Konten' },
  { to: '/finance/budgets', icon: Target, label: 'Budgets' },
  { to: '/finance/savings', icon: PiggyBank, label: 'Sparziele' },
  { to: '/finance/investments', icon: LineChart, label: 'Depot' },
  { to: '/finance/recurring', icon: Repeat, label: 'Wiederkehrend' },
  { to: '/finance/contracts', icon: FileText, label: 'Verträge' },
  { to: '/finance/savings-potential', icon: Sparkles, label: 'Sparpotenzial' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function SidebarLink({ item, onClose, compact }: { item: NavItem; onClose: () => void; compact?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) => cn('nav-item', compact && 'py-1.5 text-[0.85rem]', isActive && 'active')}
    >
      <span className="ico grid w-5 place-items-center text-ink-3">
        <item.icon className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-pill bg-peach px-1.5 py-0.5 text-[0.7rem] font-bold text-navy">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const financeActive = pathname.startsWith('/finance');
  // Aufgeklappt, solange man im Finanz-Modul unterwegs ist; manuell umschaltbar.
  const [financeOpen, setFinanceOpen] = useState(financeActive);
  useEffect(() => {
    if (financeActive) setFinanceOpen(true);
  }, [financeActive]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      // Pfeiltasten-Navigation gemäß WAI-ARIA-Menu-Pattern
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      if (items.length === 0) return;
      e.preventDefault();
      const idx = items.indexOf(document.activeElement as HTMLElement);
      let next = 0;
      if (e.key === 'ArrowDown') next = idx < 0 ? 0 : (idx + 1) % items.length;
      else if (e.key === 'ArrowUp') next = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length;
      else if (e.key === 'End') next = items.length - 1;
      items[next].focus();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    // Erstes Menü-Item fokussieren, damit Tastaturnutzer direkt im Menü sind
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : user?.email?.split('@')[0] ?? 'Konto';

  const handleLogout = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Abmelden?',
      description: 'Du wirst zur Anmeldeseite weitergeleitet.',
      confirmLabel: 'Abmelden',
    });
    if (!ok) return;
    await logout();
    onClose();
    navigate('/login', { replace: true });
  };

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

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <div className="nav-section">Module</div>
          <SidebarLink item={MODULES[0]} onClose={onClose} />

          {/* Finanzen: aufklappbare Modul-Gruppe */}
          <button
            onClick={() => setFinanceOpen((v) => !v)}
            aria-expanded={financeOpen}
            className={cn('nav-item w-full text-left', financeActive && !financeOpen && 'active')}
          >
            <span className="ico grid w-5 place-items-center text-ink-3">
              <Wallet className="h-[18px] w-[18px]" />
            </span>
            <span className="flex-1">Finanzen</span>
            <ChevronDown
              className={cn('h-4 w-4 text-ink-3 transition-transform', financeOpen && 'rotate-180')}
            />
          </button>
          {financeOpen && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-line pl-2">
              {FINANCE_SUB.map((item) => (
                <SidebarLink key={item.to} item={item} onClose={onClose} compact />
              ))}
            </div>
          )}

          {MODULES.slice(1).map((item) => (
            <SidebarLink key={item.to} item={item} onClose={onClose} />
          ))}

          <div className="nav-section">Konto</div>
          <SidebarLink
            item={{ to: '/settings', icon: Settings, label: 'Einstellungen' }}
            onClose={onClose}
          />
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
              navigate('/finance/contracts');
              onClose();
            }}
          >
            Ansehen
          </Btn>
        </div>

        {/* User row */}
        <div ref={menuRef} className="relative mt-3">
          {menuOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-md border border-line bg-elev shadow-lg animate-fade-in"
              role="menu"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-soft"
              >
                <Settings className="h-4 w-4 text-ink-3" />
                Einstellungen
              </button>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 border-t border-line px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-soft hover:text-neg"
              >
                <LogOut className="h-4 w-4 text-ink-3" />
                Abmelden
              </button>
            </div>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Konto-Menü öffnen"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md border border-line p-2.5 text-left transition-colors hover:bg-soft',
              menuOpen && 'bg-soft',
            )}
          >
            <Avatar name={fullName} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.85rem] font-semibold text-ink">{fullName}</div>
              <div className="truncate text-[0.72rem] text-ink-3">{user?.email}</div>
            </div>
            <MoreHorizontal className="h-4 w-4 text-ink-3" />
          </button>
        </div>
      </aside>
    </>
  );
}
