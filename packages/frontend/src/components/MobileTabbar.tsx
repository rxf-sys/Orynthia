import { NavLink } from 'react-router-dom';
import { Home, ArrowLeftRight, Target, PiggyBank, Menu } from 'lucide-react';
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
  { to: '/transactions', label: 'Tx', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budget', icon: Target },
  { to: '/savings', label: 'Sparen', icon: PiggyBank },
  { to: '/settings', label: 'Mehr', icon: Menu },
];

export function MobileTabbar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-line bg-elev px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
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
    </nav>
  );
}
