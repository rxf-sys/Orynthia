import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LogOut, MoreHorizontal, PanelLeft, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { NAV_GROUPS, groupForPath, type GroupId, type NavGroup } from './navigation';
import { Avatar } from './ui/Avatar';
import { useConfirm } from './ui/useConfirm';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Zweiteilige Navigation: eine schmale Icon-Rail wählt den Lebensbereich,
 * das Panel daneben das Modul.
 *
 * Auf Mobil gibt es weder Rail noch Panel – dort übernimmt die Tabbar.
 * Diese Komponente rendert deshalb ab `lg` und wird darunter als
 * Schublade eingeblendet.
 */
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const confirm = useConfirm();

  const activeGroup = groupForPath(pathname);
  const [openGroup, setOpenGroup] = useState<GroupId>(activeGroup.id);
  const [panelOpen, setPanelOpen] = useState(true);

  // Beim Routenwechsel folgt die Rail der Route – sonst zeigt das Panel
  // eine andere Gruppe als die Seite, auf der man steht.
  useEffect(() => {
    setOpenGroup(activeGroup.id);
  }, [activeGroup.id]);

  const shownGroup = NAV_GROUPS.find((g) => g.id === openGroup) ?? activeGroup;
  // Eine einelementige Gruppe (Home) würde ein leeres Panel erzeugen.
  const singleModule = shownGroup.modules.length <= 1;
  const showPanel = panelOpen && !singleModule;

  const selectGroup = (group: NavGroup) => {
    setOpenGroup(group.id);
    // Die Rail springt auf das erste Modul der Gruppe.
    navigate(group.modules[0].to);
    if (group.modules.length > 1) setPanelOpen(true);
    onClose();
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

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 ease-in-out',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* ---------- Icon-Rail ---------- */}
        <nav
          aria-label="Bereiche"
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-elev py-3.5"
        >
          <NavLink
            to="/"
            onClick={onClose}
            aria-label="Orynthia – Home"
            className="mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-[7px] bg-grad-brand text-base font-extrabold text-white"
            style={{ boxShadow: 'var(--shadow-btn)' }}
          >
            O
          </NavLink>

          {NAV_GROUPS.map((group) => {
            const isActive = activeGroup.id === group.id;
            return (
              <button
                key={group.id}
                onClick={() => selectGroup(group)}
                aria-label={group.label}
                title={group.label}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'relative grid h-10 w-10 shrink-0 place-items-center rounded-[12px] transition-colors',
                  isActive ? 'text-violet' : 'text-ink-3 hover:bg-soft hover:text-ink-2',
                )}
                style={
                  isActive
                    ? { background: 'color-mix(in oklab, var(--violet) 18%, transparent)' }
                    : undefined
                }
              >
                <group.icon className="h-[19px] w-[19px]" />
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-pill bg-violet"
                  />
                )}
              </button>
            );
          })}

          <button
            onClick={() => setPanelOpen((v) => !v)}
            aria-label={showPanel ? 'Modul-Panel einklappen' : 'Modul-Panel ausklappen'}
            aria-expanded={showPanel}
            disabled={singleModule}
            className="mt-auto grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-ink-3 transition-colors hover:bg-soft hover:text-ink-2 disabled:opacity-40"
          >
            <PanelLeft className="h-[19px] w-[19px]" />
          </button>
        </nav>

        {/* ---------- Modul-Panel ---------- */}
        {showPanel && (
          <div className="flex w-[214px] shrink-0 flex-col border-r border-line bg-elev px-2.5 py-3.5">
            <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
              <span className="text-[0.66rem] font-bold uppercase tracking-[0.09em] text-ink-3">
                {shownGroup.label}
              </span>
              <button
                onClick={onClose}
                aria-label="Menü schließen"
                className="text-ink-3 hover:text-ink lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav aria-label={shownGroup.label} className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
              {shownGroup.modules.map((mod) => (
                <NavLink
                  key={mod.to}
                  to={mod.to}
                  end={mod.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.84rem] transition-colors',
                      isActive
                        ? 'border border-line bg-soft font-semibold text-ink'
                        : 'border border-transparent text-ink-2 hover:bg-soft',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <mod.icon
                        className={cn('h-4 w-4 shrink-0', isActive ? 'text-violet' : 'text-ink-3')}
                      />
                      <span className="min-w-0 flex-1 truncate">{mod.label}</span>
                      {mod.badge && (
                        <span className="shrink-0 rounded-pill bg-peach px-1.5 py-[2px] text-[0.62rem] font-extrabold text-navy">
                          {mod.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <UserChip user={user} onLogout={logout} confirm={confirm} onClose={onClose} />
          </div>
        )}
      </div>
    </>
  );
}

function UserChip({
  user,
  onLogout,
  confirm,
  onClose,
}: {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  onLogout: () => Promise<void>;
  confirm: ReturnType<typeof useConfirm>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
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
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : (user?.email?.split('@')[0] ?? 'Konto');

  const handleLogout = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Abmelden?',
      description: 'Du wirst zur Anmeldeseite weitergeleitet.',
      confirmLabel: 'Abmelden',
    });
    if (!ok) return;
    await onLogout();
    onClose();
    navigate('/login', { replace: true });
  };

  return (
    <div ref={menuRef} className="relative mt-3">
      {menuOpen && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-[12px] border border-line bg-elev shadow-md animate-o-fade"
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
          'flex w-full items-center gap-2.5 rounded-[12px] border border-line p-[9px] text-left transition-colors hover:bg-soft',
          menuOpen && 'bg-soft',
        )}
      >
        <Avatar name={fullName} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.78rem] font-semibold text-ink">{fullName}</div>
          <div className="truncate text-[0.66rem] text-ink-3">{user?.email}</div>
        </div>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-ink-3" />
      </button>
    </div>
  );
}
