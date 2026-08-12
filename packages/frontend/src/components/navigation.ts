import {
  ArrowLeftRight,
  Bot,
  Building2,
  Calendar,
  CalendarRange,
  ChefHat,
  CheckSquare,
  ClipboardList,
  FileText,
  FolderLock,
  Goal,
  Home,
  LineChart,
  MoreHorizontal,
  PiggyBank,
  Plane,
  Repeat,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Die Navigation an einer Stelle.
 *
 * Rail, Modul-Panel, mobile Tabbar und ⌘K-Palette lesen alle aus dieser
 * Registry. Vorher pflegte jede ihre eigene Liste – neue Module fehlten
 * dann regelmäßig in einer davon.
 */
export type GroupId = 'home' | 'fin' | 'time' | 'house' | 'more';

export interface NavModule {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exakte Pfadübereinstimmung (nötig für „/" und „/finance"). */
  end?: boolean;
  badge?: 'Neu' | 'Beta';
}

export interface NavGroup {
  id: GroupId;
  label: string;
  icon: LucideIcon;
  modules: NavModule[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    modules: [{ to: '/', label: 'Home', icon: Home, end: true }],
  },
  {
    id: 'fin',
    label: 'Finanzen',
    icon: Wallet,
    modules: [
      { to: '/finance', label: 'Übersicht', icon: LineChart, end: true },
      { to: '/finance/transactions', label: 'Transaktionen', icon: ArrowLeftRight },
      { to: '/finance/accounts', label: 'Konten', icon: Building2 },
      { to: '/finance/budgets', label: 'Budgets', icon: Target },
      { to: '/finance/savings', label: 'Sparziele', icon: PiggyBank },
      { to: '/finance/investments', label: 'Depot', icon: LineChart },
      { to: '/finance/recurring', label: 'Wiederkehrend', icon: Repeat },
      { to: '/finance/contracts', label: 'Verträge', icon: FileText },
      { to: '/finance/savings-potential', label: 'Sparpotenzial', icon: Sparkles },
    ],
  },
  {
    id: 'time',
    label: 'Zeit',
    icon: Calendar,
    modules: [
      { to: '/calendar', label: 'Kalender', icon: Calendar },
      { to: '/tasks', label: 'Aufgaben', icon: CheckSquare },
      { to: '/habits', label: 'Gewohnheiten', icon: Goal, badge: 'Neu' },
    ],
  },
  {
    id: 'house',
    label: 'Haushalt',
    icon: ChefHat,
    modules: [
      { to: '/recipes', label: 'Rezepte', icon: ChefHat },
      { to: '/meal-plan', label: 'Wochenplan', icon: CalendarRange },
      { to: '/lists', label: 'Listen', icon: ClipboardList },
      { to: '/notes', label: 'Notizen', icon: StickyNote },
      { to: '/trips', label: 'Reisen', icon: Plane },
      { to: '/documents', label: 'Dokumente', icon: FolderLock, badge: 'Neu' },
    ],
  },
  {
    id: 'more',
    label: 'Mehr',
    icon: MoreHorizontal,
    modules: [
      { to: '/assistant', label: 'KI-Assistent', icon: Bot, badge: 'Beta' },
      { to: '/settings', label: 'Einstellungen', icon: Settings },
    ],
  },
];

export const ALL_MODULES: NavModule[] = NAV_GROUPS.flatMap((g) => g.modules);

/**
 * Welche Gruppe gehört zu einem Pfad? Längster Treffer gewinnt, damit
 * „/finance/budgets" nicht bei „/" hängen bleibt.
 */
export function groupForPath(pathname: string): NavGroup {
  let best: { group: NavGroup; length: number } | null = null;
  for (const group of NAV_GROUPS) {
    for (const mod of group.modules) {
      const hit = mod.end ? pathname === mod.to : pathname.startsWith(mod.to);
      if (hit && (!best || mod.to.length > best.length)) {
        best = { group, length: mod.to.length };
      }
    }
  }
  return best?.group ?? NAV_GROUPS[0];
}

/** Seitentitel für Header und Browser-Tab. */
export function titleForPath(pathname: string): string | undefined {
  let best: { label: string; length: number } | undefined;
  for (const mod of ALL_MODULES) {
    const hit = mod.end ? pathname === mod.to : pathname.startsWith(mod.to);
    if (hit && (!best || mod.to.length > best.length)) {
      best = { label: mod.label, length: mod.to.length };
    }
  }
  return best?.label;
}
