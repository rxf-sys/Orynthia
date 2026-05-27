import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Calendar, Repeat } from 'lucide-react';
import { recurringPaymentsApi, categoriesApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { RecurringPayment, Category, CreateRecurringPaymentData } from '@/lib/types';
import toast from 'react-hot-toast';
import { Card, Btn, Field, PageHead, CategoryIcon, Tag, useConfirm } from '@/components/ui';

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Wöchentlich',
  BIWEEKLY: 'Alle 2 Wochen',
  MONTHLY: 'Monatlich',
  QUARTERLY: 'Vierteljährlich',
  BIANNUALLY: 'Halbjährlich',
  YEARLY: 'Jährlich',
};

export function RecurringPaymentsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    amount: '',
    frequency: 'MONTHLY',
    counterpartName: '',
    categoryId: '',
    nextDueDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['recurring-payments'],
    queryFn: () => recurringPaymentsApi.getAll().then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRecurringPaymentData) => recurringPaymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payments'] });
      setShowForm(false);
      setForm({ name: '', amount: '', frequency: 'MONTHLY', counterpartName: '', categoryId: '', nextDueDate: '' });
      toast.success('Wiederkehrende Zahlung erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringPaymentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payments'] });
      toast.success('Zahlung gelöscht');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      recurringPaymentsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payments'] });
    },
  });

  const payments = data?.payments || [];
  const activePayments = payments.filter((p) => p.isActive);
  const inactivePayments = payments.filter((p) => !p.isActive);
  const sorted = [...activePayments].sort((a, b) =>
    (a.nextDueDate || '').localeCompare(b.nextDueDate || ''),
  );
  const biggest = activePayments.reduce<RecurringPayment | null>((max, p) => {
    if (!max) return p;
    return Math.abs(Number(p.amount)) > Math.abs(Number(max.amount)) ? p : max;
  }, null);

  const today = new Date();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  const dueThisWeek = activePayments.filter((p) => {
    if (!p.nextDueDate) return false;
    const d = new Date(p.nextDueDate);
    return d >= today && d <= weekFromNow;
  });

  return (
    <div className="space-y-5">
      <PageHead
        title="Wiederkehrend"
        sub={`${activePayments.length} aktiv · ${inactivePayments.length} pausiert`}
        actions={
          <Btn variant="grad" icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Abbrechen' : 'Neue Zahlung'}
          </Btn>
        }
      />

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Pro Monat" value={formatCurrency(data?.monthlyTotal || 0)} />
        <KpiTile label="Pro Jahr" value={formatCurrency(data?.yearlyTotal || 0)} />
        <KpiTile label="Diese Woche fällig" value={`${dueThisWeek.length}`} />
        <KpiTile label="Größte Position" value={biggest ? formatCurrency(Number(biggest.amount)) : '—'} />
      </div>

      {showForm && (
        <Card
          className="animate-fade-in"
          style={{
            borderStyle: 'dashed',
            borderColor: 'var(--peach)',
            background: 'rgba(255,177,122,.05)',
          }}
        >
          <h3 className="mb-4 text-lg font-bold text-ink">Neue wiederkehrende Zahlung</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(form.amount);
              if (!amount) {
                toast.error('Bitte Betrag eingeben');
                return;
              }
              createMutation.mutate({
                name: form.name,
                amount,
                frequency: form.frequency as CreateRecurringPaymentData['frequency'],
                counterpartName: form.counterpartName || undefined,
                categoryId: form.categoryId || undefined,
                nextDueDate: form.nextDueDate || undefined,
              });
            }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="z. B. Netflix, Miete…"
                required
              />
            </Field>
            <Field label="Betrag (negativ = Ausgabe)" required>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input tnum"
                placeholder="-12,99"
                step="0.01"
                required
              />
            </Field>
            <Field label="Häufigkeit">
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="select"
              >
                {Object.entries(frequencyLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Empfänger">
              <input
                value={form.counterpartName}
                onChange={(e) => setForm({ ...form, counterpartName: e.target.value })}
                className="input"
                placeholder="z. B. Netflix Inc."
              />
            </Field>
            <Field label="Kategorie">
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="select"
              >
                <option value="">Keine</option>
                {categories?.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nächste Fälligkeit">
              <input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
                className="input"
              />
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Btn type="submit" variant="grad" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erstellen'}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo" />
        </div>
      ) : payments.length === 0 ? (
        <Card className="text-center" style={{ padding: '48px 24px' }}>
          <Repeat className="mx-auto mb-3 h-10 w-10 text-ink-4" />
          <p className="font-semibold text-ink">Noch keine wiederkehrenden Zahlungen</p>
          <p className="mt-1 text-sm text-ink-3">Erfasse Abos, Miete und regelmäßige Zahlungen.</p>
        </Card>
      ) : (
        <Card className="!p-0">
          <div className="border-b px-5 py-3" style={{ borderColor: 'var(--line-2)' }}>
            <div className="text-[1.05rem] font-bold text-ink">Kommende Buchungen</div>
            <div className="text-[0.78rem] text-ink-3">
              Nach Fälligkeitsdatum sortiert
            </div>
          </div>
          {sorted.map((payment, i) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              isLast={i === sorted.length - 1 && inactivePayments.length === 0}
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Zahlung löschen?',
                  description: payment.name,
                  confirmLabel: 'Löschen',
                  destructive: true,
                });
                if (ok) deleteMutation.mutate(payment.id);
              }}
              onToggle={() => toggleMutation.mutate({ id: payment.id, isActive: false })}
            />
          ))}
          {inactivePayments.length > 0 && (
            <>
              <div
                className="border-y bg-soft px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-3"
                style={{ borderColor: 'var(--line-2)' }}
              >
                Pausiert
              </div>
              {inactivePayments.map((payment, i) => (
                <div key={payment.id} className="opacity-60">
                  <PaymentRow
                    payment={payment}
                    isLast={i === inactivePayments.length - 1}
                    onDelete={async () => {
                      const ok = await confirm({
                        title: 'Zahlung endgültig löschen?',
                        description: payment.name,
                        confirmLabel: 'Löschen',
                        destructive: true,
                      });
                      if (ok) deleteMutation.mutate(payment.id);
                    }}
                    onToggle={() => toggleMutation.mutate({ id: payment.id, isActive: true })}
                  />
                </div>
              ))}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <div className="tnum mt-2 text-[1.85rem] font-bold leading-none">{value}</div>
    </Card>
  );
}

function PaymentRow({
  payment,
  isLast,
  onDelete,
  onToggle,
}: {
  payment: RecurringPayment;
  isLast?: boolean;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const amount = Number(payment.amount);
  const isExpense = amount < 0;
  const dueDate = payment.nextDueDate ? new Date(payment.nextDueDate) : null;
  const daysUntil = dueDate ? Math.round((dueDate.getTime() - Date.now()) / 86400000) : null;

  return (
    <div
      className={cn('group flex items-center gap-4 px-5 py-3.5', !isLast && 'border-b')}
      style={!isLast ? { borderColor: 'var(--line-2)' } : undefined}
    >
      {dueDate && (
        <div className="hidden h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-soft text-center sm:flex">
          <div className="text-[0.6rem] font-semibold uppercase text-ink-3">
            {dueDate.toLocaleDateString('de-DE', { month: 'short' })}
          </div>
          <div className="text-base font-bold leading-none tnum">{dueDate.getDate()}</div>
        </div>
      )}
      <CategoryIcon cat={payment.category} fallbackIcon={isExpense ? '💸' : '💰'} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate font-semibold text-ink">{payment.name}</h4>
          <Tag>{frequencyLabels[payment.frequency] || payment.frequency}</Tag>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          {payment.counterpartName && <span>{payment.counterpartName}</span>}
          {daysUntil !== null && (
            <span
              className="flex items-center gap-1"
              style={daysUntil <= 7 ? { color: 'var(--warn)' } : undefined}
            >
              <Calendar className="h-3 w-3" />
              {daysUntil < 0 ? `vor ${Math.abs(daysUntil)} T.` : `in ${daysUntil} T.`}
            </span>
          )}
        </div>
      </div>
      <div
        className="tnum w-28 text-right text-[1.05rem] font-bold"
        style={isExpense ? undefined : { color: 'var(--pos)' }}
      >
        {formatCurrency(amount)}
      </div>
      <label className="inline-flex shrink-0 cursor-pointer items-center" title={payment.isActive ? 'Pausieren' : 'Aktivieren'}>
        <input
          type="checkbox"
          checked={payment.isActive}
          onChange={onToggle}
          className="peer sr-only"
          aria-label={payment.isActive ? 'Pausieren' : 'Aktivieren'}
        />
        <div
          className={cn(
            'relative h-5 w-9 rounded-pill transition-colors',
            payment.isActive ? 'bg-indigo' : 'bg-sunken',
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
              payment.isActive ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </div>
      </label>
      <button
        onClick={onDelete}
        className="opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
        aria-label="Zahlung löschen"
      >
        <Trash2 className="h-4 w-4 text-ink-3" />
      </button>
    </div>
  );
}
