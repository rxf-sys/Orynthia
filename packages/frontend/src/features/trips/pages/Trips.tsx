import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, isPast, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarDays, Check, Loader2, MapPin, Plane, Plus, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { tripsApi } from '@/features/trips/api';
import { TRIP_STATUS_LABEL, type Trip } from '@/features/trips/types';
import { cn, formatCurrency, parseApiError, parseDecimal } from '@/lib/utils';
import { Btn, Card, EmptyState, Field, Modal, PageHead, Tag } from '@/components/ui';

export function TripsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    budgetAmount: '',
  });

  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: tripsApi.create,
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setShowForm(false);
      setForm({ title: '', destination: '', startDate: '', endDate: '', budgetAmount: '' });
      toast.success('Reise angelegt');
      navigate(`/trips/${r.data.id}`);
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Anlegen')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate || !form.endDate) return;
    const budget = form.budgetAmount ? parseDecimal(form.budgetAmount) : null;
    createMutation.mutate({
      title: form.title.trim(),
      destination: form.destination.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      budgetAmount: budget ?? undefined,
    });
  };

  const upcoming = (trips ?? []).filter((t) => !isPast(parseISO(t.endDate)));
  const past = (trips ?? []).filter((t) => isPast(parseISO(t.endDate)));

  return (
    <div className="space-y-5">
      <PageHead
        title="Reisen"
        sub={`${upcoming.length} bevorstehend · ${past.length} vergangen`}
        actions={
          <Btn variant="grad" icon={Plus} onClick={() => setShowForm(true)}>
            Neue Reise
          </Btn>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (trips?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Plane}
          title="Noch keine Reisen"
          description="Plane deine nächste Reise – mit Zeitraum, Budget und verknüpfter Packliste, Terminen und Notizen an einem Ort."
          action={{ label: 'Reise anlegen', onClick: () => setShowForm(true), icon: Plus }}
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section aria-label="Bevorstehend">
              <h2 className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-ink-3">
                Bevorstehend
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section aria-label="Vergangen">
              <h2 className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-ink-3">
                Vergangen
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} muted />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Neue Reise"
        size="sm"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>
              Abbrechen
            </Btn>
            <Btn
              variant="grad"
              icon={Check}
              type="submit"
              form="trip-form"
              disabled={
                createMutation.isPending || !form.title.trim() || !form.startDate || !form.endDate
              }
            >
              Anlegen
            </Btn>
          </>
        }
      >
        <form id="trip-form" onSubmit={submit} className="space-y-4">
          <Field label="Titel" required>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="z. B. Sommerurlaub Italien"
              maxLength={200}
            />
          </Field>
          <Field label="Ziel">
            <input
              className="input"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="z. B. Gardasee"
              maxLength={200}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Von" required>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Bis" required>
              <input
                type="date"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label="Budget (€)" hint="Reine Planungsgröße – unabhängig von deinen Konten">
            <input
              className="input"
              inputMode="decimal"
              value={form.budgetAmount}
              onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
              placeholder="1500"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function TripCard({ trip, muted }: { trip: Trip; muted?: boolean }) {
  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const days = differenceInCalendarDays(end, start) + 1;
  const daysUntil = differenceInCalendarDays(start, new Date());

  return (
    <Link to={`/trips/${trip.id}`} className="block">
      <Card hover className={cn('h-full', muted && 'opacity-70')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{trip.title}</h3>
          <Tag variant={trip.status === 'ONGOING' ? 'pos' : 'default'}>
            {TRIP_STATUS_LABEL[trip.status]}
          </Tag>
        </div>
        {trip.destination && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-3">
            <MapPin className="h-3 w-3" /> {trip.destination}
          </p>
        )}
        <div className="mt-3 space-y-1 text-xs text-ink-3">
          <p className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            <span className="tnum">
              {format(start, 'd. MMM', { locale: de })} – {format(end, 'd. MMM yyyy', { locale: de })}
            </span>
            <span className="text-ink-4">· {days} Tage</span>
          </p>
          {trip.budgetAmount != null && (
            <p className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              <span className="tnum">{formatCurrency(Number(trip.budgetAmount))}</span> Budget
            </p>
          )}
        </div>
        {!muted && daysUntil > 0 && (
          <p className="mt-2 text-[0.7rem] font-semibold text-indigo">
            noch {daysUntil} Tag{daysUntil === 1 ? '' : 'e'}
          </p>
        )}
      </Card>
    </Link>
  );
}
