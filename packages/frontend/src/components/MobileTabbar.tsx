import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Wallet,
  Calendar,
  CheckSquare,
  ChefHat,
  ClipboardList,
  ArrowLeftRight,
  Target,
  PiggyBank,
  Menu,
  Building2,
  Repeat,
  FileText,
  Sparkles,
  Bot,
  LineChart,
  Settings,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/finance', label: 'Finanzen', icon: Wallet },
  { to: '/calendar', label: 'Kalender', icon: Calendar },
  { to: '/tasks', label: 'Aufgaben', icon: CheckSquare },
];

// Bereiche, die keinen eigenen Tab haben — erreichbar über das "Mehr"-Sheet.
const MORE_ITEMS: Tab[] = [
  { to: '/recipes', label: 'Rezepte', icon: ChefHat },
  { to: '/meal-plan', label: 'Wochenplan', icon: ChefHat },
  { to: '/lists', label: 'Listen', icon: ClipboardList },
  { to: '/finance/transactions', label: 'Transaktionen', icon: ArrowLeftRight },
  { to: '/finance/accounts', label: 'Konten', icon: Building2 },
  { to: '/finance/budgets', label: 'Budgets', icon: Target },
  { to: '/finance/savings', label: 'Sparziele', icon: PiggyBank },
  { to: '/finance/investments', label: 'Depot', icon: LineChart },
  { to: '/finance/recurring', label: 'Wiederkehrend', icon: Repeat },
  { to: '/finance/contracts', label: 'Verträge', icon: FileText },
  { to: '/finance/savings-potential', label: 'Sparpotenzial', icon: Sparkles },
  { to: '/assistant', label: 'KI-Assistent', icon: Bot },
  { to: '/settings', label: 'Einstellungen', icon: Settings },
];

export function MobileTabbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.to));

  return (
    <>
      {moreOpen && (
        <>
          <div
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Weitere Bereiche"
            className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-2 right-2 z-40 rounded-lg border border-line bg-elev p-2 shadow-xl animate-fade-in lg:hidden"
          >
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Mehr</span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Schließen"
                className="rounded p-1 text-ink-3 hover:bg-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {MORE_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                      isActive ? 'bg-soft text-indigo' : 'text-ink-2 hover:bg-soft',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}

      <nav
        aria-label="Hauptnavigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-line bg-elev px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex min-w-[56px] flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[0.65rem] font-medium',
                isActive ? 'text-indigo' : 'text-ink-3',
              )
            }
          >
            <tab.icon className="h-[18px] w-[18px]" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={cn(
            'flex min-w-[56px] flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[0.65rem] font-medium',
            moreActive || moreOpen ? 'text-indigo' : 'text-ink-3',
          )}
        >
          <Menu className="h-[18px] w-[18px]" />
          <span>Mehr</span>
        </button>
      </nav>
    </>
  );
}
