import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Check,
  CloudDownload,
  RefreshCw,
  Link2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  CheckSquare,
  UtensilsCrossed,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calendarApi } from '@/features/calendar/api';
import { tasksApi } from '@/features/tasks/api';
import { mealPlanApi } from '@/features/recipes/api';
import type { CreateEventData, EventOccurrence, EventRecurrence, UpdateEventData } from '@/features/calendar/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, EmptyState, Field, Modal, PageHead, useConfirm } from '@/components/ui';

type ViewMode = 'month' | 'week' | 'agenda';

const RECURRENCE_LABEL: Record<EventRecurrence, string> = {
  DAILY: 'Täglich',
  WEEKLY: 'Wöchentlich',
  BIWEEKLY: 'Alle 2 Wochen',
  MONTHLY: 'Monatlich',
  YEARLY: 'Jährlich',
};

const REMINDER_OPTIONS = [
  { value: '', label: 'Keine' },
  { value: '0', label: 'Zum Beginn' },
  { value: '5', label: '5 Minuten vorher' },
  { value: '15', label: '15 Minuten vorher' },
  { value: '30', label: '30 Minuten vorher' },
  { value: '60', label: '1 Stunde vorher' },
  { value: '1440', label: '1 Tag vorher' },
];

const CAL_COLORS = ['#5b8def', '#37415c', '#fda481', '#1f8a5b', '#b97aff', '#e76b8d', '#3aa3a5', '#d99a2b'];

interface EventFormState {
  calendarId: string;
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  reminder: string;
  recurrence: '' | EventRecurrence;
  recurrenceUntil: string;
}

function emptyForm(date: Date, calendarId = ''): EventFormState {
  return {
    calendarId,
    title: '',
    description: '',
    location: '',
    date: format(date, 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    reminder: '',
    recurrence: '',
    recurrenceUntil: '',
  };
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventOccurrence | null>(null);
  const [form, setForm] = useState<EventFormState>(() => emptyForm(new Date()));
  const [manageOpen, setManageOpen] = useState(false);
  const [newCalendar, setNewCalendar] = useState({ name: '', color: CAL_COLORS[0] });
  const [icsForm, setIcsForm] = useState({ url: '', name: '' });
  // Zusatz-Layer: Aufgaben mit Fälligkeit und geplante Mahlzeiten
  const [showTasks, setShowTasks] = useState(true);
  const [showMeals, setShowMeals] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  // Sichtbarer Zeitraum je Ansicht (Agenda: 30 Tage ab heute)
  const range = useMemo(() => {
    if (view === 'month') {
      const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const to = addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), 1);
      return { from, to };
    }
    if (view === 'week') {
      const from = startOfWeek(cursor, { weekStartsOn: 1 });
      return { from, to: addDays(from, 7) };
    }
    const from = startOfDay(new Date());
    return { from, to: addDays(from, 30) };
  }, [view, cursor]);

  const { data: calendars } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => calendarApi.getCalendars().then((r) => r.data),
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      calendarApi.getEvents(range.from.toISOString(), range.to.toISOString()).then((r) => r.data),
  });

  const { data: dueTasks } = useQuery({
    queryKey: ['calendar-tasks', range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      tasksApi
        .getAll({
          status: 'open',
          dueAfter: range.from.toISOString(),
          dueBefore: range.to.toISOString(),
        })
        .then((r) => r.data),
    enabled: showTasks,
  });

  const { data: meals } = useQuery({
    queryKey: ['calendar-meals', range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      mealPlanApi
        .getRange(format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'))
        .then((r) => r.data),
    enabled: showMeals,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['calendars'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-integrations'] });
  };

  const { data: integrationsData } = useQuery({
    queryKey: ['calendar-integrations'],
    queryFn: () => calendarApi.getIntegrations().then((r) => r.data),
  });

  const googleCallbackMutation = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      calendarApi.googleCallback(code, state),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Google Kalender verbunden – ${r.data.imported} Termine importiert`);
    },
    onError: (e) => toast.error(parseApiError(e, 'Google-Verbindung fehlgeschlagen')),
  });

  // Rückkehr aus dem Google-OAuth-Flow: ?code=…&state=… einlösen und URL bereinigen
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) return;
    googleCallbackMutation.mutate({ code, state });
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectIcsMutation = useMutation({
    mutationFn: calendarApi.connectIcs,
    onSuccess: (r) => {
      invalidate();
      setIcsForm({ url: '', name: '' });
      toast.success(`ICS-Kalender abonniert – ${r.data.imported} Termine importiert`);
    },
    onError: (e) => toast.error(parseApiError(e, 'ICS-Abo fehlgeschlagen')),
  });

  const googleConnectMutation = useMutation({
    mutationFn: () => calendarApi.googleConnect(),
    onSuccess: (r) => {
      window.location.href = r.data.authUrl;
    },
    onError: (e) => toast.error(parseApiError(e, 'Google-Verbindung nicht möglich')),
  });

  const syncNowMutation = useMutation({
    mutationFn: calendarApi.syncIntegration,
    onSuccess: () => {
      invalidate();
      toast.success('Synchronisiert');
    },
    onError: (e) => toast.error(parseApiError(e, 'Sync fehlgeschlagen')),
  });

  const removeIntegrationMutation = useMutation({
    mutationFn: calendarApi.removeIntegration,
    onSuccess: () => {
      invalidate();
      toast.success('Verbindung getrennt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Trennen fehlgeschlagen')),
  });

  const createMutation = useMutation({
    mutationFn: calendarApi.createEvent,
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success('Termin erstellt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Erstellen')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventData }) => calendarApi.updateEvent(id, data),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success('Termin gespeichert');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const deleteMutation = useMutation({
    mutationFn: calendarApi.removeEvent,
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success('Termin gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const createCalendarMutation = useMutation({
    mutationFn: calendarApi.createCalendar,
    onSuccess: () => {
      invalidate();
      setNewCalendar({ name: '', color: CAL_COLORS[0] });
      toast.success('Kalender erstellt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Erstellen')),
  });

  const deleteCalendarMutation = useMutation({
    mutationFn: calendarApi.removeCalendar,
    onSuccess: () => {
      invalidate();
      toast.success('Kalender gelöscht');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const openCreate = (date: Date) => {
    setEditing(null);
    const def = calendars?.find((c) => c.isDefault) ?? calendars?.[0];
    setForm(emptyForm(date, def?.id ?? ''));
    setDialogOpen(true);
  };

  const isReadOnlyEvent = editing?.readOnly === true;

  const openEdit = (occ: EventOccurrence) => {
    setEditing(occ);
    const start = parseISO(occ.startsAt);
    const end = parseISO(occ.endsAt);
    setForm({
      calendarId: occ.calendarId,
      title: occ.title,
      description: occ.description ?? '',
      location: occ.location ?? '',
      date: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
      isAllDay: occ.isAllDay,
      reminder: occ.reminderMinutes === null ? '' : String(occ.reminderMinutes),
      recurrence: occ.recurrence ?? '',
      recurrenceUntil: occ.recurrenceUntil ? occ.recurrenceUntil.slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = form.isAllDay
      ? new Date(`${form.date}T00:00:00`)
      : new Date(`${form.date}T${form.startTime}`);
    const endsAt = form.isAllDay
      ? new Date(`${form.date}T23:59:59`)
      : new Date(`${form.date}T${form.endTime}`);
    if (endsAt < startsAt) {
      toast.error('Ende darf nicht vor dem Beginn liegen');
      return;
    }
    const payload: CreateEventData = {
      calendarId: form.calendarId || undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      isAllDay: form.isAllDay,
      reminderMinutes: form.reminder === '' ? undefined : parseInt(form.reminder, 10),
      recurrence: form.recurrence || undefined,
      recurrenceUntil: form.recurrenceUntil
        ? new Date(`${form.recurrenceUntil}T23:59:59`).toISOString()
        : undefined,
    };
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          ...payload,
          reminderMinutes: form.reminder === '' ? null : parseInt(form.reminder, 10),
          recurrence: form.recurrence || null,
          recurrenceUntil: form.recurrenceUntil
            ? new Date(`${form.recurrenceUntil}T23:59:59`).toISOString()
            : null,
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Layer-Daten nach Kalendertag gruppieren, damit die Ansichten sie
  // ohne eigene Logik einblenden können.
  const extrasByDay = useMemo(() => {
    const map = new Map<string, { tasks: typeof dueTasks; meals: typeof meals }>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { tasks: [], meals: [] });
      return map.get(key)!;
    };
    if (showTasks) {
      for (const task of dueTasks ?? []) {
        if (!task.dueAt) continue;
        ensure(format(parseISO(task.dueAt), 'yyyy-MM-dd')).tasks!.push(task);
      }
    }
    if (showMeals) {
      for (const meal of meals ?? []) {
        ensure(meal.date.slice(0, 10)).meals!.push(meal);
      }
    }
    return map;
  }, [dueTasks, meals, showTasks, showMeals]);

  const goToday = () => setCursor(new Date());
  const step = (dir: 1 | -1) => {
    if (view === 'month') setCursor((c) => addMonths(c, dir));
    else if (view === 'week') setCursor((c) => addWeeks(c, dir));
  };

  const heading =
    view === 'month'
      ? format(cursor, 'LLLL yyyy', { locale: de })
      : view === 'week'
        ? `KW ${format(cursor, 'I')} · ${format(startOfWeek(cursor, { weekStartsOn: 1 }), 'd. MMM', { locale: de })} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), 'd. MMM yyyy', { locale: de })}`
        : 'Nächste 30 Tage';

  return (
    <div className="space-y-5">
      <PageHead
        title="Kalender"
        sub={heading}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="ghost" size="sm" onClick={() => setManageOpen(true)}>
              Kalender verwalten
            </Btn>
            <Btn variant="grad" icon={Plus} onClick={() => openCreate(cursor)}>
              Neuer Termin
            </Btn>
          </div>
        }
      />

      {/* Steuerleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-line bg-elev p-0.5">
          {(['month', 'week', 'agenda'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded px-3 py-1.5 text-sm font-semibold',
                view === v ? 'bg-soft text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {v === 'month' ? 'Monat' : v === 'week' ? 'Woche' : 'Agenda'}
            </button>
          ))}
        </div>
        {view !== 'agenda' && (
          <div className="flex items-center gap-1">
            <Btn variant="ghost" size="sm" icon={ChevronLeft} onClick={() => step(-1)} aria-label="Zurück" />
            <Btn variant="ghost" size="sm" onClick={goToday}>
              Heute
            </Btn>
            <Btn variant="ghost" size="sm" icon={ChevronRight} onClick={() => step(1)} aria-label="Weiter" />
          </div>
        )}
        <div className="flex gap-1 rounded-md border border-line bg-elev p-0.5">
          <button
            onClick={() => setShowTasks((v) => !v)}
            aria-pressed={showTasks}
            title="Fällige Aufgaben einblenden"
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold',
              showTasks ? 'bg-soft text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Aufgaben
          </button>
          <button
            onClick={() => setShowMeals((v) => !v)}
            aria-pressed={showMeals}
            title="Geplante Mahlzeiten einblenden"
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold',
              showMeals ? 'bg-soft text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" /> Essen
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5 text-xs text-ink-3">
          {calendars?.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-pill" style={{ background: c.color ?? 'var(--ink-4)' }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : view === 'month' ? (
        <MonthGrid cursor={cursor} events={events ?? []} extras={extrasByDay} onDayClick={openCreate} onEventClick={openEdit} />
      ) : view === 'week' ? (
        <WeekList cursor={cursor} events={events ?? []} extras={extrasByDay} onDayClick={openCreate} onEventClick={openEdit} />
      ) : (
        <AgendaList events={events ?? []} onEventClick={openEdit} onCreate={() => openCreate(new Date())} />
      )}

      {/* Termin-Dialog */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Termin bearbeiten' : 'Neuer Termin'}
        footer={
          isReadOnlyEvent ? (
            <Btn variant="ghost" onClick={() => setDialogOpen(false)}>
              Schließen
            </Btn>
          ) : (
          <>
            {editing && (
              <Btn
                variant="danger"
                icon={Trash2}
                onClick={async () => {
                  const ok = await confirm({
                    title: editing.recurrence ? 'Ganze Serie löschen?' : 'Termin löschen?',
                    description: editing.title,
                    confirmLabel: 'Löschen',
                    destructive: true,
                  });
                  if (ok) deleteMutation.mutate(editing.id);
                }}
              >
                Löschen
              </Btn>
            )}
            <div className="ml-auto flex gap-2">
              <Btn variant="ghost" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Btn>
              <Btn
                variant="grad"
                icon={Check}
                type="submit"
                form="event-form"
                disabled={createMutation.isPending || updateMutation.isPending || !form.title.trim()}
              >
                Speichern
              </Btn>
            </div>
          </>
          )
        }
      >
        {isReadOnlyEvent && (
          <p className="mb-3 flex items-center gap-2 rounded-md bg-soft px-3 py-2 text-xs text-ink-2">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Dieser Termin stammt aus „{editing?.calendarName}“ (synchronisiert) und ist schreibgeschützt.
          </p>
        )}
        {!isReadOnlyEvent && editing?.isRecurringInstance && (
          <p className="mb-3 rounded-md bg-soft px-3 py-2 text-xs text-ink-2">
            Dies ist eine Instanz einer Serie – Änderungen gelten für die gesamte Serie.
          </p>
        )}
        <form id="event-form" onSubmit={submit} className="space-y-4">
          <fieldset disabled={isReadOnlyEvent} className="contents">
          <Field label="Titel" required>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={300}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kalender">
              <select
                className="select"
                value={form.calendarId}
                onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
                disabled={isReadOnlyEvent}
              >
                {calendars
                  ?.filter((c) => !c.readOnly || c.id === form.calendarId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.readOnly ? ' (synchronisiert)' : ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Datum" required>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={form.isAllDay}
              onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
            />
            Ganztägig
          </label>
          {!form.isAllDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Beginn" required>
                <input
                  type="time"
                  className="input"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </Field>
              <Field label="Ende" required>
                <input
                  type="time"
                  className="input"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                />
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ort">
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                maxLength={300}
              />
            </Field>
            <Field label="Erinnerung">
              <select
                className="select"
                value={form.reminder}
                onChange={(e) => setForm({ ...form, reminder: e.target.value })}
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Wiederholung">
              <select
                className="select"
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value as '' | EventRecurrence })}
              >
                <option value="">Keine</option>
                {(Object.keys(RECURRENCE_LABEL) as EventRecurrence[]).map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            {form.recurrence && (
              <Field label="Wiederholen bis" hint="Leer = ohne Ende">
                <input
                  type="date"
                  className="input"
                  value={form.recurrenceUntil}
                  onChange={(e) => setForm({ ...form, recurrenceUntil: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="Beschreibung">
            <textarea
              className="input min-h-[70px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={5000}
            />
          </Field>
          </fieldset>
        </form>
      </Modal>

      {/* Kalender verwalten */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Kalender verwalten">
        <div className="space-y-4">
          <div className="space-y-2">
            {calendars?.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2.5">
                <span className="h-3 w-3 rounded-pill" style={{ background: c.color ?? 'var(--ink-4)' }} />
                <span className="flex-1 text-sm font-medium text-ink">{c.name}</span>
                {c.readOnly && (
                  <span className="flex items-center gap-1 text-xs text-ink-3">
                    <Lock className="h-3 w-3" /> Sync
                  </span>
                )}
                {c.isDefault && <span className="text-xs text-ink-3">Standard</span>}
                {!c.isDefault && !c.readOnly && (
                  <Btn
                    variant="quiet"
                    size="sm"
                    onClick={() => calendarApi.updateCalendar(c.id, { isDefault: true }).then(invalidate)}
                  >
                    Als Standard
                  </Btn>
                )}
                {(calendars?.length ?? 0) > 1 && !c.readOnly && (
                  <Btn
                    variant="quiet"
                    size="sm"
                    icon={Trash2}
                    aria-label={`Kalender ${c.name} löschen`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Kalender „${c.name}“ löschen?`,
                        description: 'Alle Termine dieses Kalenders werden gelöscht.',
                        confirmLabel: 'Löschen',
                        destructive: true,
                      });
                      if (ok) deleteCalendarMutation.mutate(c.id);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Externe Kalender (read-only Sync) */}
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-3">
              Externe Kalender (schreibgeschützt)
            </p>
            {(integrationsData?.integrations.length ?? 0) > 0 && (
              <div className="space-y-2">
                {integrationsData!.integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2.5"
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {integration.label ??
                          (integration.provider === 'GOOGLE_CALENDAR' ? 'Google Kalender' : 'ICS-Abo')}
                      </div>
                      <div className="text-xs text-ink-3">
                        {integration.status === 'ERROR' ? (
                          <span className="text-neg" title={integration.lastError ?? undefined}>
                            Fehler beim Sync
                          </span>
                        ) : integration.lastSyncAt ? (
                          `Zuletzt: ${format(parseISO(integration.lastSyncAt), 'd.M. HH:mm')}`
                        ) : (
                          'Noch nicht synchronisiert'
                        )}
                      </div>
                    </div>
                    <Btn
                      variant="quiet"
                      size="sm"
                      icon={RefreshCw}
                      aria-label="Jetzt synchronisieren"
                      disabled={syncNowMutation.isPending}
                      onClick={() => syncNowMutation.mutate(integration.id)}
                    />
                    <Btn
                      variant="quiet"
                      size="sm"
                      icon={Trash2}
                      aria-label="Verbindung trennen"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Verbindung trennen?',
                          description:
                            'Der synchronisierte Kalender und seine Termine werden aus Orynthia entfernt. Gespeicherte Zugangsdaten werden gelöscht.',
                          confirmLabel: 'Trennen',
                          destructive: true,
                        });
                        if (ok) removeIntegrationMutation.mutate(integration.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!icsForm.url.trim()) return;
                connectIcsMutation.mutate({
                  url: icsForm.url.trim(),
                  name: icsForm.name.trim() || undefined,
                });
              }}
              className="space-y-2"
            >
              <Field
                label="ICS-Kalender abonnieren"
                hint="z. B. iCloud „Kalender teilen per Link“, Outlook oder Nextcloud (webcal:// oder https://)"
              >
                <input
                  className="input"
                  value={icsForm.url}
                  onChange={(e) => setIcsForm({ ...icsForm, url: e.target.value })}
                  placeholder="webcal://… oder https://….ics"
                  maxLength={2000}
                />
              </Field>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={icsForm.name}
                  onChange={(e) => setIcsForm({ ...icsForm, name: e.target.value })}
                  placeholder="Name (optional)"
                  maxLength={100}
                  aria-label="Name des ICS-Kalenders"
                />
                <Btn
                  type="submit"
                  size="sm"
                  icon={CloudDownload}
                  disabled={!icsForm.url.trim() || connectIcsMutation.isPending}
                >
                  Abonnieren
                </Btn>
              </div>
            </form>
            {integrationsData?.googleConfigured ? (
              <Btn
                variant="ghost"
                size="sm"
                icon={Link2}
                disabled={googleConnectMutation.isPending}
                onClick={() => googleConnectMutation.mutate()}
              >
                Mit Google Kalender verbinden
              </Btn>
            ) : (
              <p className="text-xs text-ink-4">
                Google-Sync verfügbar, sobald GOOGLE_CLIENT_ID/SECRET in der .env gesetzt sind (siehe README).
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCalendar.name.trim()) return;
              createCalendarMutation.mutate({ name: newCalendar.name.trim(), color: newCalendar.color });
            }}
            className="space-y-3 border-t border-line pt-4"
          >
            <Field label="Neuer Kalender">
              <input
                className="input"
                value={newCalendar.name}
                onChange={(e) => setNewCalendar({ ...newCalendar, name: e.target.value })}
                maxLength={100}
                placeholder="z. B. Arbeit, Familie"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {CAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCalendar({ ...newCalendar, color: c })}
                  aria-label={`Farbe ${c}`}
                  className={cn(
                    'h-7 w-7 rounded-pill border-2',
                    newCalendar.color === c ? 'border-ink' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <Btn type="submit" icon={Plus} size="sm" disabled={!newCalendar.name.trim() || createCalendarMutation.isPending}>
              Kalender anlegen
            </Btn>
          </form>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Ansichten ----------

interface DayExtra {
  tasks?: Array<{ id: string; title: string; dueAt?: string | null }>;
  meals?: Array<{ id: string; title?: string | null; recipe?: { title: string } | null }>;
}

interface ViewProps {
  events: EventOccurrence[];
  extras?: Map<string, DayExtra>;
  onEventClick: (occ: EventOccurrence) => void;
}

/** Aufgaben- und Essens-Layer eines Tages – bewusst dezent, damit
 *  Termine die Hauptrolle behalten. */
function DayExtras({ extra, compact }: { extra?: DayExtra; compact?: boolean }) {
  const tasks = extra?.tasks ?? [];
  const meals = extra?.meals ?? [];
  if (tasks.length === 0 && meals.length === 0) return null;
  return (
    <>
      {tasks.slice(0, compact ? 2 : 3).map((task) => (
        <Link
          key={`t-${task.id}`}
          to="/tasks"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="flex items-center gap-1 truncate rounded border border-dashed border-line px-1.5 py-0.5 text-[0.68rem] text-ink-2 hover:border-indigo"
          title={`Aufgabe: ${task.title}`}
        >
          <CheckSquare className="h-2.5 w-2.5 shrink-0 text-ink-3" />
          <span className="truncate">{task.title}</span>
        </Link>
      ))}
      {meals.slice(0, compact ? 1 : 2).map((meal) => (
        <Link
          key={`m-${meal.id}`}
          to="/meal-plan"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="flex items-center gap-1 truncate rounded border border-dashed border-line px-1.5 py-0.5 text-[0.68rem] text-ink-2 hover:border-indigo"
          title={`Geplant: ${meal.recipe?.title ?? meal.title ?? ''}`}
        >
          <UtensilsCrossed className="h-2.5 w-2.5 shrink-0 text-ink-3" />
          <span className="truncate">{meal.recipe?.title ?? meal.title}</span>
        </Link>
      ))}
    </>
  );
}

function MonthGrid({ cursor, events, extras, onDayClick, onEventClick }: ViewProps & { cursor: Date; onDayClick: (d: Date) => void }) {
  const days = useMemo(() => {
    const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: to });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occ of events) {
      const key = format(parseISO(occ.startsAt), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(occ);
    }
    return map;
  }, [events]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-line text-center text-[0.7rem] font-bold uppercase tracking-wide text-ink-3">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = byDay.get(key) ?? [];
          const outside = !isSameMonth(day, cursor);
          return (
            <button
              key={key}
              onClick={() => onDayClick(day)}
              className={cn(
                'flex min-h-[92px] flex-col items-stretch gap-1 border-b border-r border-line p-1.5 text-left align-top transition-colors hover:bg-soft',
                outside && 'bg-sunken',
              )}
              aria-label={format(day, 'EEEE, d. MMMM', { locale: de })}
            >
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-pill text-xs font-semibold tnum',
                  isToday(day) ? 'bg-indigo text-white' : outside ? 'text-ink-4' : 'text-ink-2',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((occ, i) => (
                  <span
                    key={`${occ.id}-${occ.startsAt}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(occ);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        onEventClick(occ);
                      }
                    }}
                    className="truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium text-white"
                    style={{ background: occ.calendarColor ?? 'var(--indigo)' }}
                    title={occ.title}
                  >
                    {!occ.isAllDay && (
                      <span className="tnum opacity-80">{format(parseISO(occ.startsAt), 'HH:mm')} </span>
                    )}
                    {occ.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="px-1 text-[0.68rem] text-ink-3">+{dayEvents.length - 3} weitere</span>
                )}
                <DayExtras extra={extras?.get(key)} compact />
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function WeekList({ cursor, events, extras, onDayClick, onEventClick }: ViewProps & { cursor: Date; onDayClick: (d: Date) => void }) {
  const days = useMemo(() => {
    const from = startOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: addDays(from, 6) });
  }, [cursor]);

  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const dayEvents = events.filter((occ) => isSameDay(parseISO(occ.startsAt), day));
        return (
          <Card key={day.toISOString()} className={cn('p-3', isToday(day) && 'ring-1 ring-indigo')}>
            <button
              onClick={() => onDayClick(day)}
              className="mb-2 flex w-full items-baseline justify-between text-left"
              aria-label={`Termin am ${format(day, 'd. MMMM', { locale: de })} anlegen`}
            >
              <span className="text-[0.72rem] font-bold uppercase text-ink-3">
                {format(day, 'EEE', { locale: de })}
              </span>
              <span className={cn('tnum text-sm font-semibold', isToday(day) ? 'text-indigo' : 'text-ink-2')}>
                {format(day, 'd.M.')}
              </span>
            </button>
            <div className="space-y-1.5">
              {dayEvents.length === 0 &&
                (extras?.get(format(day, 'yyyy-MM-dd'))?.tasks?.length ?? 0) === 0 &&
                (extras?.get(format(day, 'yyyy-MM-dd'))?.meals?.length ?? 0) === 0 && (
                  <p className="text-xs text-ink-4">–</p>
                )}
              {dayEvents.map((occ, i) => (
                <button
                  key={`${occ.id}-${occ.startsAt}-${i}`}
                  onClick={() => onEventClick(occ)}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-white"
                  style={{ background: occ.calendarColor ?? 'var(--indigo)' }}
                >
                  {!occ.isAllDay && (
                    <span className="tnum opacity-80">{format(parseISO(occ.startsAt), 'HH:mm')} </span>
                  )}
                  {occ.title}
                </button>
              ))}
              <DayExtras extra={extras?.get(format(day, 'yyyy-MM-dd'))} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AgendaList({ events, onEventClick, onCreate }: ViewProps & { onCreate: () => void }) {
  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occ of events) {
      const key = format(parseISO(occ.startsAt), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(occ);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarIcon}
        title="Keine Termine in den nächsten 30 Tagen"
        description="Lege deinen ersten Termin an – mit Erinnerung, Wiederholung und Kalenderfarbe."
        action={{ label: 'Neuer Termin', onClick: onCreate, icon: Plus }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {byDay.map(([key, dayEvents]) => {
        const day = parseISO(key);
        return (
          <section key={key} aria-label={format(day, 'EEEE, d. MMMM', { locale: de })}>
            <h2 className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-ink-3">
              {isToday(day) ? 'Heute' : format(day, 'EEEE, d. MMMM', { locale: de })}
            </h2>
            <Card className="divide-y divide-line p-0">
              {dayEvents.map((occ, i) => (
                <button
                  key={`${occ.id}-${occ.startsAt}-${i}`}
                  onClick={() => onEventClick(occ)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-soft"
                >
                  <span
                    className="h-9 w-1 shrink-0 rounded-pill"
                    style={{ background: occ.calendarColor ?? 'var(--indigo)' }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{occ.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {occ.isAllDay
                          ? 'Ganztägig'
                          : `${format(parseISO(occ.startsAt), 'HH:mm')} – ${format(parseISO(occ.endsAt), 'HH:mm')}`}
                      </span>
                      {occ.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {occ.location}
                        </span>
                      )}
                      {occ.recurrence && (
                        <span className="flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {RECURRENCE_LABEL[occ.recurrence]}
                        </span>
                      )}
                      <span>{occ.calendarName}</span>
                    </div>
                  </div>
                  <Pencil className="h-4 w-4 shrink-0 text-ink-4" aria-hidden />
                </button>
              ))}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
