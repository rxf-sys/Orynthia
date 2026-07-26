import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckSquare,
  ChefHat,
  ClipboardList,
  Link2,
  Loader2,
  Luggage,
  MapPin,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { tripsApi } from '@/features/trips/api';
import {
  LINKABLE_LABEL,
  TRIP_STATUS_LABEL,
  type LinkableType,
  type TripStatus,
} from '@/features/trips/types';
import { calendarApi } from '@/features/calendar/api';
import { tasksApi } from '@/features/tasks/api';
import { listsApi } from '@/features/lists/api';
import { notesApi } from '@/features/notes/api';
import { cn, formatCurrency, parseApiError, parseDecimal } from '@/lib/utils';
import { Btn, Card, Field, IconBtn, Modal, PageHead, Tag, useConfirm } from '@/components/ui';

const LINK_ICON: Record<LinkableType, LucideIcon> = {
  TRIP: Luggage,
  CALENDAR_EVENT: CalendarDays,
  TASK: CheckSquare,
  LIST: ClipboardList,
  NOTE: StickyNote,
  RECIPE: ChefHat,
};

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    budgetAmount: '',
    status: 'PLANNED' as TripStatus,
    notes: '',
  });

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['trip', id] });
    queryClient.invalidateQueries({ queryKey: ['trips'] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof tripsApi.update>[1]) => tripsApi.update(id!, data),
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
      toast.success('Reise gespeichert');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tripsApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Reise gelöscht');
      navigate('/trips');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => tripsApi.unlink(id!, linkId),
    onSuccess: () => {
      invalidate();
      toast.success('Verknüpfung entfernt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Entfernen')),
  });

  const packingListMutation = useMutation({
    mutationFn: () => tripsApi.createPackingList(id!),
    onSuccess: (r) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      toast.success(`Packliste „${r.data.name}" angelegt`);
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Anlegen')),
  });

  const openEdit = () => {
    if (!trip) return;
    setForm({
      title: trip.title,
      destination: trip.destination ?? '',
      startDate: trip.startDate.slice(0, 10),
      endDate: trip.endDate.slice(0, 10),
      budgetAmount: trip.budgetAmount != null ? String(trip.budgetAmount) : '',
      status: trip.status,
      notes: trip.notes ?? '',
    });
    setEditOpen(true);
  };

  if (isLoading || !trip) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
      </div>
    );
  }

  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const days = differenceInCalendarDays(end, start) + 1;
  const hasPackingList = trip.linked.some((l) => l.type === 'LIST');

  // Verknüpfungen nach Typ gruppieren, damit die Reise als Bühne für
  // alle beteiligten Module lesbar bleibt.
  const grouped = trip.linked.reduce<Record<string, typeof trip.linked>>((acc, link) => {
    (acc[link.type] ??= []).push(link);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Link
        to="/trips"
        className="inline-flex items-center gap-1 text-sm text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Alle Reisen
      </Link>

      <PageHead
        title={trip.title}
        sub={[
          trip.destination,
          `${format(start, 'd. MMM', { locale: de })} – ${format(end, 'd. MMM yyyy', { locale: de })}`,
          `${days} Tage`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tag variant={trip.status === 'ONGOING' ? 'pos' : 'default'}>
              {TRIP_STATUS_LABEL[trip.status]}
            </Tag>
            <Btn variant="ghost" icon={Pencil} onClick={openEdit}>
              Bearbeiten
            </Btn>
            <Btn variant="grad" icon={Link2} onClick={() => setLinkOpen(true)}>
              Verknüpfen
            </Btn>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Eckdaten */}
        <div className="space-y-4">
          <Card className="space-y-3">
            {trip.destination && (
              <div className="flex items-center gap-2 text-sm text-ink-2">
                <MapPin className="h-4 w-4 text-ink-3" /> {trip.destination}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <CalendarDays className="h-4 w-4 text-ink-3" />
              <span className="tnum">
                {format(start, 'dd.MM.yyyy')} – {format(end, 'dd.MM.yyyy')}
              </span>
            </div>
            {trip.budgetAmount != null && (
              <div className="flex items-center gap-2 text-sm text-ink-2">
                <Wallet className="h-4 w-4 text-ink-3" />
                <span className="tnum font-semibold">
                  {formatCurrency(Number(trip.budgetAmount))}
                </span>
                <span className="text-xs text-ink-3">Budget</span>
              </div>
            )}
            {!hasPackingList && (
              <Btn
                variant="ghost"
                size="sm"
                icon={Luggage}
                disabled={packingListMutation.isPending}
                onClick={() => packingListMutation.mutate()}
              >
                Packliste anlegen
              </Btn>
            )}
          </Card>

          {trip.notes && (
            <Card>
              <h2 className="mb-2 text-sm font-bold text-ink">Notizen zur Reise</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{trip.notes}</p>
            </Card>
          )}
        </div>

        {/* Verknüpfte Einträge */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Gehört zu dieser Reise</h2>
            <span className="text-xs text-ink-3">{trip.linked.length} Verknüpfungen</span>
          </div>
          {trip.linked.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">
              Noch nichts verknüpft. Häng Termine, deine Packliste oder Notizen an diese Reise –
              sie bleiben in ihrem Modul und sind hier gebündelt sichtbar.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([type, links]) => {
                const Icon = LINK_ICON[type as LinkableType];
                return (
                  <section key={type}>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-ink-3">
                      <Icon className="h-3.5 w-3.5" />
                      {LINKABLE_LABEL[type as LinkableType]}
                    </h3>
                    <ul className="divide-y divide-line rounded-md border border-line">
                      {links.map((link) => (
                        <li key={link.linkId} className="group flex items-center gap-2 px-3 py-2">
                          <Link
                            to={link.to}
                            className="min-w-0 flex-1 truncate text-sm text-ink hover:underline"
                          >
                            {link.title}
                          </Link>
                          {link.subtitle && (
                            <span className="shrink-0 text-xs text-ink-3">{link.subtitle}</span>
                          )}
                          <IconBtn
                            variant="quiet"
                            size="sm"
                            icon={X}
                            aria-label="Verknüpfung entfernen"
                            className="shrink-0 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                            onClick={() => unlinkMutation.mutate(link.linkId)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bearbeiten */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Reise bearbeiten"
        footer={
          <>
            <Btn
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Reise löschen?',
                  description:
                    'Die Reise und ihre Verknüpfungen werden entfernt. Termine, Listen und Notizen bleiben erhalten.',
                  confirmLabel: 'Löschen',
                  destructive: true,
                });
                if (ok) deleteMutation.mutate();
              }}
            >
              Löschen
            </Btn>
            <div className="ml-auto flex gap-2">
              <Btn variant="ghost" onClick={() => setEditOpen(false)}>
                Abbrechen
              </Btn>
              <Btn
                variant="grad"
                icon={Check}
                type="submit"
                form="trip-edit-form"
                disabled={updateMutation.isPending || !form.title.trim()}
              >
                Speichern
              </Btn>
            </div>
          </>
        }
      >
        <form
          id="trip-edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            const budget = form.budgetAmount ? parseDecimal(form.budgetAmount) : null;
            updateMutation.mutate({
              title: form.title.trim(),
              destination: form.destination.trim() || undefined,
              startDate: form.startDate,
              endDate: form.endDate,
              budgetAmount: budget ?? undefined,
              status: form.status,
              notes: form.notes.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <Field label="Titel" required>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ziel">
              <input
                className="input"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                maxLength={200}
              />
            </Field>
            <Field label="Status">
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TripStatus })}
              >
                {(Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {TRIP_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Von" required>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="Bis" required>
              <input
                type="date"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Budget (€)" hint="Reine Planungsgröße – unabhängig von deinen Konten">
            <input
              className="input"
              inputMode="decimal"
              value={form.budgetAmount}
              onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
            />
          </Field>
          <Field label="Notizen">
            <textarea
              className="input min-h-[90px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={5000}
            />
          </Field>
        </form>
      </Modal>

      <LinkEntityModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        tripId={trip.id}
        alreadyLinked={new Set(trip.linked.map((l) => `${l.type}:${l.id}`))}
        onLinked={invalidate}
      />
    </div>
  );
}

/** Bestehende Termine, Aufgaben, Listen, Notizen oder Rezepte anhängen. */
function LinkEntityModal({
  open,
  onClose,
  tripId,
  alreadyLinked,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  alreadyLinked: Set<string>;
  onLinked: () => void;
}) {
  const [type, setType] = useState<LinkableType>('LIST');

  const { data: options, isLoading } = useQuery({
    queryKey: ['linkable-options', type],
    queryFn: async () => {
      switch (type) {
        case 'LIST':
          return (await listsApi.getAll()).data.map((l) => ({ id: l.id, label: l.name }));
        case 'NOTE':
          return (await notesApi.getAll()).data.map((n) => ({
            id: n.id,
            label: n.title || n.content.slice(0, 60) || 'Notiz',
          }));
        case 'TASK':
          return (await tasksApi.getAll({ status: 'open' })).data.map((t) => ({
            id: t.id,
            label: t.title,
          }));
        case 'CALENDAR_EVENT': {
          const from = new Date();
          const to = new Date(from.getTime() + 365 * 86_400_000);
          const events = (await calendarApi.getEvents(from.toISOString(), to.toISOString())).data;
          // Serien liefern mehrere Instanzen derselben ID – eindeutig machen
          const seen = new Set<string>();
          return events
            .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
            .map((e) => ({
              id: e.id,
              label: `${e.title} (${format(parseISO(e.startsAt), 'd.M.yy')})`,
            }));
        }
        default:
          return [];
      }
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: (entityId: string) => tripsApi.link(tripId, { type, id: entityId }),
    onSuccess: () => {
      onLinked();
      toast.success('Verknüpft');
    },
    onError: (e) => toast.error(parseApiError(e, 'Verknüpfen fehlgeschlagen')),
  });

  const selectable = (options ?? []).filter((o) => !alreadyLinked.has(`${type}:${o.id}`));

  return (
    <Modal open={open} onClose={onClose} title="Mit der Reise verknüpfen" size="sm">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(['LIST', 'CALENDAR_EVENT', 'TASK', 'NOTE'] as LinkableType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                'rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
                type === t
                  ? 'border-indigo bg-indigo text-white'
                  : 'border-line bg-elev text-ink-2 hover:bg-soft',
              )}
            >
              {LINKABLE_LABEL[t]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-ink-3" />
          </div>
        ) : selectable.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">
            Nichts (mehr) zum Verknüpfen vorhanden.
          </p>
        ) : (
          <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto rounded-md border border-line">
            {selectable.map((option) => (
              <li key={option.id}>
                <button
                  onClick={() => linkMutation.mutate(option.id)}
                  disabled={linkMutation.isPending}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-soft"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
