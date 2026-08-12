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
  Plane,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Goal,
  Plus,
  PiggyBank,
  Settings2,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { contractsApi, savingsGoalsApi } from '@/features/finance/api';
import { calendarApi } from '@/features/calendar/api';
import { tasksApi } from '@/features/tasks/api';
import { listsApi } from '@/features/lists/api';
import { tripsApi } from '@/features/trips/api';
import { habitsApi } from '@/features/habits/api';
import { LIST_TYPE_ICON } from '@/features/lists/types';
import { homeApi } from '@/features/home/api';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Btn, Card, Progress } from '@/components/ui';
import { HeroCard } from '@/features/home/components/HeroCard';
import { FocusBand, SectionHead } from '@/features/home/components/FocusBand';
import { BudgetRings } from '@/features/home/components/BudgetRings';

/**
 * Widget-Registry des Home-Dashboards: Jedes Modul steuert genau ein
 * Widget über die schmale Public API seines Features bei. Neue Module
 * ergänzen hier einen Eintrag – Sichtbarkeit/Reihenfolge kommen aus
 * dem serverseitig gespeicherten Layout (User.dashboardLayout).
 */
const WIDGETS = [
  { id: 'savings', title: 'Sparziele', section: 'money' },
  { id: 'contracts', title: 'Verträge & Abos', section: 'money' },
  { id: 'today', title: 'Heute & demnächst', section: 'day' },
  { id: 'tasks', title: 'Aufgaben', section: 'day' },
  { id: 'habits', title: 'Gewohnheiten', section: 'day' },
  { id: 'lists', title: 'Listen', section: 'house' },
  { id: 'trips', title: 'Reisen', section: 'house' },
] as const;

type WidgetId = (typeof WIDGETS)[number]['id'];
type SectionId = (typeof WIDGETS)[number]['section'];

// Die drei Abschnitte des Home-Screens; ein Abschnitt ohne sichtbares
// Widget verschwindet samt Überschrift, statt leer dazustehen.
const SECTIONS: { id: SectionId; title: string; link?: { to: string; label: string } }[] = [
  { id: 'money', title: 'Geld', link: { to: '/finance', label: 'Finanzen öffnen' } },
  { id: 'day', title: 'Dein Tag', link: { to: '/calendar', label: 'Kalender öffnen' } },
  { id: 'house', title: 'Haushalt', link: { to: '/lists', label: 'Listen öffnen' } },
];

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

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'savings':
        return <SavingsWidget key={id} />;
      case 'today':
        return <TodayWidget key={id} />;
      case 'tasks':
        return <TasksWidget key={id} />;
      case 'lists':
        return <ListsWidget key={id} />;
      case 'trips':
        return <TripsWidget key={id} />;
      case 'habits':
        return <HabitsWidget key={id} />;
      case 'contracts':
        return <ContractsWidget key={id} />;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-9 pb-6 lg:gap-11">
      {/* Begrüßung */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="h-display text-[2.1rem] leading-[1.02] tracking-[-0.025em] text-ink sm:text-[3.25rem]">
            Hallo{firstName ? ` ${firstName}` : ''}
          </h1>
          <p className="mt-2.5 max-w-[520px] text-[0.95rem] leading-[1.6] text-ink-3">
            {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })} – dein Tag auf einen Blick.
          </p>
        </div>
        <div className="relative">
          <Btn variant="ghost" size="sm" icon={Settings2} onClick={() => setCustomizeOpen((v) => !v)}>
            Widgets anpassen
          </Btn>
          {customizeOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCustomizeOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-md border border-line bg-elev p-1.5 shadow-md animate-o-fade">
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
                      <Eye className="h-4 w-4 text-violet" />
                    )}
                    {w.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <HeroCard />

      <FocusBand />

      {SECTIONS.map((section) => {
        const widgets = visibleWidgets.filter((w) => w.section === section.id);
        // Die Budget-Ringe hängen nicht am Widget-Layout: sie sind der
        // Kern des Geld-Abschnitts, nicht ein Widget unter vielen.
        const hasContent = widgets.length > 0 || section.id === 'money';
        if (!hasContent) return null;
        return (
          <section key={section.id}>
            <SectionHead title={section.title} link={section.link} />
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr))]">
              {section.id === 'money' && <BudgetRings />}
              {widgets.map((w) => renderWidget(w.id))}
            </div>
          </section>
        );
      })}

      {visibleWidgets.length === 0 && (
        <Card className="py-10 text-center text-sm text-ink-3">
          Alle Widgets ausgeblendet – über „Widgets anpassen“ kannst du sie wieder aktivieren.
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

/**
 * Sparziele: der Balken ist violett, nicht grün – ein halb gefülltes
 * Sparziel ist kein Warnfall. Nur „erreicht“ ist ein Status.
 */
function SavingsWidget() {
  const { data: goals, isLoading } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => savingsGoalsApi.getAll().then((r) => r.data),
  });

  const shown = (goals ?? []).slice(0, 3);

  return (
    <Card>
      <WidgetHead title="Sparziele" to="/finance/savings" icon={PiggyBank} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : shown.length === 0 ? (
        <WidgetEmpty text="Noch kein Sparziel." action={{ label: 'Ziel anlegen', to: '/finance/savings' }} />
      ) : (
        <ul className="space-y-3">
          {shown.map((goal) => {
            const done = goal.percentage >= 100;
            return (
              <li key={goal.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-ink">
                    {goal.icon} {goal.name}
                  </span>
                  <span
                    className="tnum shrink-0 text-xs font-bold"
                    style={{ color: done ? 'var(--pos)' : 'var(--violet)' }}
                  >
                    {formatPercent(goal.percentage)}
                  </span>
                </div>
                <Progress
                  value={goal.percentage}
                  color={done ? 'var(--pos)' : 'var(--violet)'}
                  className="mt-1.5"
                  label={`${goal.name}: ${goal.percentage} Prozent erreicht`}
                />
                <div className="tnum mt-1 flex justify-between text-[0.7rem] text-ink-3">
                  <span>
                    {formatCurrency(goal.currentAmount)} von {formatCurrency(goal.targetAmount)}
                  </span>
                  {goal.deadline && <span>bis {format(parseISO(goal.deadline), 'dd.MM.yyyy')}</span>}
                </div>
              </li>
            );
          })}
        </ul>
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

function TripsWidget() {
  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripsApi.getAll().then((r) => r.data),
  });

  // Nur bevorstehende bzw. laufende Reisen sind auf dem Home relevant –
  // und zwar die nächste zuerst. Die Liste selbst sortiert absteigend,
  // weil dort auch vergangene Reisen stehen.
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (trips ?? [])
      .filter((t) => t.endDate.slice(0, 10) >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3);
  }, [trips]);

  return (
    <Card>
      <WidgetHead title="Reisen" to="/trips" icon={Plane} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : upcoming.length === 0 ? (
        <WidgetEmpty text="Keine Reise geplant." action={{ label: 'Reise anlegen', to: '/trips' }} />
      ) : (
        <ul className="space-y-2">
          {upcoming.map((trip) => {
            const start = parseISO(trip.startDate);
            const daysUntil = Math.ceil((start.getTime() - Date.now()) / 86_400_000);
            return (
              <li key={trip.id}>
                <Link
                  to={`/trips/${trip.id}`}
                  className="flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{trip.title}</div>
                    <div className="text-xs text-ink-3">
                      {format(start, 'd. MMM yyyy', { locale: de })}
                      {trip.destination ? ` · ${trip.destination}` : ''}
                    </div>
                  </div>
                  {daysUntil > 0 && (
                    <span className="tnum shrink-0 text-xs font-semibold text-indigo">
                      in {daysUntil} T
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function HabitsWidget() {
  const queryClient = useQueryClient();
  const { data: habits, isLoading } = useQuery({
    queryKey: ['habits', false],
    queryFn: () => habitsApi.getAll().then((r) => r.data),
  });

  // Offene zuerst: das Widget soll zeigen, was heute noch ansteht.
  const shown = useMemo(
    () => [...(habits ?? [])].sort((a, b) => Number(a.doneToday) - Number(b.doneToday)).slice(0, 4),
    [habits],
  );

  const toggleMutation = useMutation({
    mutationFn: (id: string) => habitsApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const doneToday = habits?.filter((h) => h.doneToday).length ?? 0;

  return (
    <Card>
      <WidgetHead title="Gewohnheiten" to="/habits" icon={Goal} />
      {isLoading ? (
        <WidgetSkeleton />
      ) : shown.length === 0 ? (
        <WidgetEmpty
          text="Noch keine Gewohnheiten."
          action={{ label: 'Gewohnheit anlegen', to: '/habits' }}
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-3">
            <span className="tnum font-semibold text-ink">
              {doneToday}/{habits!.length}
            </span>{' '}
            für heute erledigt
          </p>
          <ul className="space-y-1">
            {shown.map((habit) => (
              <li key={habit.id}>
                <button
                  onClick={() => toggleMutation.mutate(habit.id)}
                  disabled={toggleMutation.isPending}
                  aria-pressed={habit.doneToday}
                  className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-soft disabled:opacity-60"
                >
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-pill border-2',
                      habit.doneToday ? 'border-transparent text-white' : 'border-line text-ink-4',
                    )}
                    style={habit.doneToday ? { background: habit.color ?? 'var(--indigo)' } : undefined}
                  >
                    <CheckSquare className="h-3 w-3" />
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      habit.doneToday ? 'text-ink-3 line-through' : 'text-ink',
                    )}
                  >
                    {habit.title}
                  </span>
                  {habit.streak > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-ink-3">
                      <Flame className="h-3.5 w-3.5 text-peach" />
                      <span className="tnum">{habit.streak}</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
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
