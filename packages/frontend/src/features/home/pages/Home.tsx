import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  CheckSquare,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Plus,
  Settings2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, contractsApi } from '@/features/finance/api';
import { calendarApi } from '@/features/calendar/api';
import { tasksApi } from '@/features/tasks/api';
import { listsApi } from '@/features/lists/api';
import { LIST_TYPE_ICON } from '@/features/lists/types';
import { homeApi } from '@/features/home/api';
import { cn, formatCurrency } from '@/lib/utils';
import { Btn, Card } from '@/components/ui';

/**
 * Widget-Registry des Home-Dashboards: Jedes Modul steuert genau ein
 * Widget über die schmale Public API seines Features bei. Neue Module
 * ergänzen hier einen Eintrag – Sichtbarkeit/Reihenfolge kommen aus
 * dem serverseitig gespeicherten Layout (User.dashboardLayout).
 */
const WIDGETS = [
  { id: 'finance', title: 'Finanzen' },
  { id: 'today', title: 'Heute & demnächst' },
  { id: 'tasks', title: 'Aufgaben' },
  { id: 'lists', title: 'Listen' },
  { id: 'contracts', title: 'Verträge & Abos' },
] as const;

type WidgetId = (typeof WIDGETS)[number]['id'];

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const { data: layout } = useQuery({
    queryKey: ['dashboard-layout'],
    queryFn: () => homeApi.getLayout().then((r) => r.data),
  });

  const layoutMutation = useMutation({
    mutationFn: homeApi.updateLayout,
    onSuccess: (r) => queryClient.setQueryData(['dashboard-layout'], r.data),
  });

  const hidden = useMemo(() => new Set(layout?.hidden ?? []), [layout]);

  const orderedWidgets = useMemo(() => {
    const order = layout?.order ?? [];
    return [...WIDGETS].sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [layout]);

  const toggleWidget = (id: WidgetId) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    layoutMutation.mutate({ hidden: [...next], order: layout?.order ?? [] });
  };

  const firstName = user?.firstName || user?.email?.split('@')[0] || '';
  const visibleWidgets = orderedWidgets.filter((w) => !hidden.has(w.id));

  return (
    <div className="space-y-5">
      {/* Begrüßung */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-display text-[2rem] leading-tight text-ink">
            Hallo{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })} – dein Tag auf einen Blick.
          </p>
        </div>
        <div className="relative">
          <Btn variant="ghost" size="sm" icon={Settings2} onClick={() => setCustomizeOpen((v) => !v)}>
            Anpassen
          </Btn>
          {customizeOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCustomizeOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-md border border-line bg-elev p-1.5 shadow-lg animate-fade-in">
                <p className="px-2.5 pb-1 pt-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-ink-3">
                  Widgets
                </p>
                {WIDGETS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-soft"
                  >
                    {hidden.has(w.id) ? (
                      <EyeOff className="h-4 w-4 text-ink-4" />
                    ) : (
                      <Eye className="h-4 w-4 text-indigo" />
                    )}
                    {w.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Widget-Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleWidgets.map((w) => {
          switch (w.id) {
            case 'finance':
              return <FinanceWidget key={w.id} />;
            case 'today':
              return <TodayWidget key={w.id} />;
            case 'tasks':
              return <TasksWidget key={w.id} />;
            case 'lists':
              return <ListsWidget key={w.id} />;
            case 'contracts':
              return <ContractsWidget key={w.id} />;
          }
        })}
      </div>
      {visibleWidgets.length === 0 && (
        <Card className="py-10 text-center text-sm text-ink-3">
          Alle Widgets ausgeblendet – über „Anpassen“ kannst du sie wieder aktivieren.
        </Card>
      )}
    </div>
  );
}

function WidgetHead({ title, to, icon: Icon }: { title: string; to: string; icon: typeof Wallet }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <Icon className="h-4 w-4 text-ink-3" />
        {title}
      </div>
      <Link
        to={to}
        className="flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
      >
        Öffnen <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function FinanceWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getData().then((r) => r.data),
  });

  return (
    <Card>
      <WidgetHead title="Finanzen" to="/finance" icon={Wallet} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : (
        <>
          <div className="tnum h-display text-[2rem] leading-tight text-ink">
            {formatCurrency(data?.overview.totalBalance ?? 0)}
          </div>
          <p className="text-xs text-ink-3">Gesamtsaldo über {data?.accounts.length ?? 0} Konten</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-soft px-3 py-2">
              <div className="flex items-center gap-1 text-[0.7rem] font-semibold uppercase text-ink-3">
                <TrendingUp className="h-3 w-3 text-pos" /> Einnahmen
              </div>
              <div className="tnum mt-0.5 text-sm font-bold text-pos">
                {formatCurrency(data?.overview.monthlyIncome ?? 0)}
              </div>
            </div>
            <div className="rounded-md bg-soft px-3 py-2">
              <div className="flex items-center gap-1 text-[0.7rem] font-semibold uppercase text-ink-3">
                <TrendingDown className="h-3 w-3 text-neg" /> Ausgaben
              </div>
              <div className="tnum mt-0.5 text-sm font-bold text-neg">
                {formatCurrency(data?.overview.monthlyExpenses ?? 0)}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function TodayWidget() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-upcoming'],
    queryFn: () => calendarApi.getUpcoming(7, 6).then((r) => r.data),
  });

  return (
    <Card>
      <WidgetHead title="Heute & demnächst" to="/calendar" icon={CalendarIcon} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : (events?.length ?? 0) === 0 ? (
        <WidgetEmpty
          text="Keine Termine in den nächsten 7 Tagen."
          action={{ label: 'Termin anlegen', to: '/calendar' }}
        />
      ) : (
        <ul className="space-y-2">
          {events!.map((occ, i) => {
            const start = parseISO(occ.startsAt);
            return (
              <li key={`${occ.id}-${occ.startsAt}-${i}`} className="flex items-center gap-2.5">
                <span
                  className="h-8 w-1 shrink-0 rounded-pill"
                  style={{ background: occ.calendarColor ?? 'var(--indigo)' }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{occ.title}</div>
                  <div className="flex items-center gap-1 text-xs text-ink-3">
                    <Clock className="h-3 w-3" />
                    {isToday(start) ? 'Heute' : format(start, 'EEE, d. MMM', { locale: de })}
                    {!occ.isAllDay && <span className="tnum"> · {format(start, 'HH:mm')}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TasksWidget() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['tasks-summary'],
    queryFn: () => tasksApi.getSummary().then((r) => r.data),
  });

  return (
    <Card>
      <WidgetHead title="Aufgaben" to="/tasks" icon={CheckSquare} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : (summary?.open ?? 0) === 0 ? (
        <WidgetEmpty text="Alles erledigt – keine offenen Aufgaben." action={{ label: 'Aufgabe anlegen', to: '/tasks' }} />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <TaskStat label="Offen" value={summary!.open} />
          <TaskStat label="Heute" value={summary!.dueToday} accent="var(--info)" />
          <TaskStat label="Überfällig" value={summary!.overdue} accent="var(--neg)" />
        </div>
      )}
    </Card>
  );
}

function TaskStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md bg-soft px-3 py-2.5 text-center">
      <div className="tnum text-xl font-bold" style={{ color: value > 0 && accent ? accent : 'var(--text)' }}>
        {value}
      </div>
      <div className="text-[0.7rem] font-semibold uppercase text-ink-3">{label}</div>
    </div>
  );
}

function ListsWidget() {
  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listsApi.getAll().then((r) => r.data),
  });

  const withOpen = useMemo(
    () => (lists ?? []).filter((l) => (l._count?.items ?? 0) > 0).slice(0, 4),
    [lists],
  );

  return (
    <Card>
      <WidgetHead title="Listen" to="/lists" icon={ClipboardList} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : withOpen.length === 0 ? (
        <WidgetEmpty
          text={
            (lists?.length ?? 0) === 0
              ? 'Noch keine Listen angelegt.'
              : 'Alles abgehakt – keine offenen Einträge.'
          }
          action={{ label: 'Liste öffnen', to: '/lists' }}
        />
      ) : (
        <ul className="space-y-2">
          {withOpen.map((list) => (
            <li key={list.id}>
              <Link
                to={`/lists/${list.id}`}
                className="flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-soft"
              >
                <span aria-hidden>{list.icon ?? LIST_TYPE_ICON[list.type]}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {list.name}
                </span>
                <span className="tnum shrink-0 text-xs text-ink-3">
                  {list._count!.items} offen
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ContractsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractsApi.getAll().then((r) => r.data),
  });

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (data?.contracts ?? [])
      .filter((c) => c.isActive && c.cancellationDate && new Date(c.cancellationDate).getTime() > now)
      .sort((a, b) => a.cancellationDate!.localeCompare(b.cancellationDate!))
      .slice(0, 3);
  }, [data]);

  return (
    <Card>
      <WidgetHead title="Verträge & Abos" to="/finance/contracts" icon={FileText} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-xl font-bold text-ink">
              {formatCurrency(data?.totalMonthly ?? 0)}
            </span>
            <span className="text-xs text-ink-3">Fixkosten / Monat ({data?.contracts.length ?? 0} Verträge)</span>
          </div>
          {upcoming.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {upcoming.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-ink-2">{c.name}</span>
                  <span className="tnum shrink-0 text-warn">
                    Kündbar bis {format(parseISO(c.cancellationDate!), 'd.M.yyyy')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function WidgetEmpty({ text, action }: { text: string; action?: { label: string; to: string } }) {
  return (
    <div className="py-3 text-sm text-ink-3">
      {text}
      {action && (
        <Link to={action.to} className={cn('mt-2 flex w-fit items-center gap-1 text-xs font-semibold text-indigo hover:underline')}>
          <Plus className="h-3 w-3" /> {action.label}
        </Link>
      )}
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-32 animate-pulse rounded bg-soft" />
      <div className="h-4 w-48 animate-pulse rounded bg-soft" />
      <div className="h-4 w-40 animate-pulse rounded bg-soft" />
    </div>
  );
}
