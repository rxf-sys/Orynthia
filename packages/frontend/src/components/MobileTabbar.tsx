import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, CheckSquare, Home, Menu, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_MODULES, NAV_GROUPS } from './navigation';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/finance', label: 'Finanzen', icon: Wallet, end: true },
  { to: '/calendar', label: 'Kalender', icon: Calendar },
  { to: '/tasks', label: 'Aufgaben', icon: CheckSquare },
];

const TAB_ROUTES = new Set(TABS.map((t) => t.to));

export function MobileTabbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();

  // Alles, was keinen eigenen Tab hat, kommt ins „Mehr“-Sheet – aus der
  // Registry, damit ein neues Modul dort nicht vergessen wird.
  const moreGroups = NAV_GROUPS.map((group) => ({
    ...group,
    modules: group.modules.filter((m) => !TAB_ROUTES.has(m.to)),
  })).filter((group) => group.modules.length > 0);

  const moreActive = ALL_MODULES.some(
    (m) => !TAB_ROUTES.has(m.to) && (m.end ? pathname === m.to : pathname.startsWith(m.to)),
  );

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
            className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-2 right-2 z-40 max-h-[65vh] overflow-y-auto rounded-lg border border-line bg-elev p-2 shadow-overlay animate-o-fade lg:hidden"
          >
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <span className="text-[0.66rem] font-bold uppercase tracking-[0.09em] text-ink-3">
                Mehr
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Schließen"
                className="rounded p-1 text-ink-3 hover:bg-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {moreGroups.map((group) => (
              <div key={group.id} className="mb-1.5">
                <div className="px-2 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.09em] text-ink-4">
                  {group.label}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {group.modules.map((mod) => (
                    <NavLink
                      key={mod.to}
                      to={mod.to}
                      end={mod.end}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[0.84rem] font-medium',
                          isActive ? 'bg-soft text-violet' : 'text-ink-2 hover:bg-soft',
                        )
                      }
                    >
                      <mod.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="min-w-0 truncate">{mod.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <nav
        aria-label="Hauptnavigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-line bg-elev px-1 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              cn(
                // Trefferfläche mindestens 44 px hoch
                'flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[0.66rem] font-semibold',
                isActive ? 'text-violet' : 'text-ink-3',
              )
            }
          >
            <tab.icon className="h-[19px] w-[19px]" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={cn(
            'flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[0.66rem] font-semibold',
            moreActive || moreOpen ? 'text-violet' : 'text-ink-3',
          )}
        >
          <Menu className="h-[19px] w-[19px]" />
          <span>Mehr</span>
        </button>
      </nav>
    </>
  );
}
