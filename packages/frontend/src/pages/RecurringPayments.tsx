import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Pause, Play, Calendar } from 'lucide-react';
import { recurringPaymentsApi, categoriesApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { RecurringPayment, Category, CreateRecurringPaymentData } from '@/lib/types';
import toast from 'react-hot-toast';

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', frequency: 'MONTHLY', counterpartName: '', categoryId: '', nextDueDate: '' });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wiederkehrende Zahlungen</h1>
          <p className="text-surface-400 mt-1">
            Monatlich: <span className="text-white font-semibold">{formatCurrency(data?.monthlyTotal || 0)}</span>
            {' / '}
            Jährlich: <span className="text-white font-semibold">{formatCurrency(data?.yearlyTotal || 0)}</span>
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Abbrechen' : 'Neue Zahlung'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Neue wiederkehrende Zahlung</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(form.amount);
              if (!amount) { toast.error('Bitte Betrag eingeben'); return; }
              createMutation.mutate({
                name: form.name,
                amount,
                frequency: form.frequency as CreateRecurringPaymentData['frequency'],
                counterpartName: form.counterpartName || undefined,
                categoryId: form.categoryId || undefined,
                nextDueDate: form.nextDueDate || undefined,
              });
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="label">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="z.B. Netflix, Miete..." required />
            </div>
            <div>
              <label className="label">Betrag (negativ = Ausgabe) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" placeholder="-12.99" step="0.01" required />
            </div>
            <div>
              <label className="label">Häufigkeit</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="input">
                {Object.entries(frequencyLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Empfänger</label>
              <input value={form.counterpartName} onChange={(e) => setForm({ ...form, counterpartName: e.target.value })} className="input" placeholder="z.B. Netflix Inc." />
            </div>
            <div>
              <label className="label">Kategorie</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input">
                <option value="">Keine</option>
                {categories?.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nächste Fälligkeit</label>
              <input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="input" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : payments.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-500">Noch keine wiederkehrenden Zahlungen.</p>
          <p className="text-surface-600 text-sm mt-1">Erfasse deine Abos, Miete und regelmäßige Zahlungen.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activePayments.length > 0 && (
            <div className="space-y-2">
              {activePayments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  onDelete={() => { if (confirm('Zahlung wirklich löschen?')) deleteMutation.mutate(payment.id); }}
                  onToggle={() => toggleMutation.mutate({ id: payment.id, isActive: false })}
                />
              ))}
            </div>
          )}

          {inactivePayments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-surface-500 mb-2">Pausiert</h3>
              <div className="space-y-2 opacity-60">
                {inactivePayments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    onDelete={() => { if (confirm('Zahlung wirklich löschen?')) deleteMutation.mutate(payment.id); }}
                    onToggle={() => toggleMutation.mutate({ id: payment.id, isActive: true })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentRow({
  payment,
  onDelete,
  onToggle,
}: {
  payment: RecurringPayment;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const amount = Number(payment.amount);
  const isExpense = amount < 0;

  return (
    <div className="card-hover group flex items-center gap-4">
      <div className="flex-shrink-0 text-lg">
        {payment.category?.icon || (isExpense ? '💸' : '💰')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-surface-200 truncate">{payment.name}</h4>
          <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-full">
            {frequencyLabels[payment.frequency] || payment.frequency}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {payment.counterpartName && (
            <span className="text-xs text-surface-500">{payment.counterpartName}</span>
          )}
          {payment.nextDueDate && (
            <span className="text-xs text-surface-500 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(payment.nextDueDate).toLocaleDateString('de-DE')}
            </span>
          )}
        </div>
      </div>
      <div className={cn('text-lg font-semibold tabular-nums', isExpense ? 'text-red-400' : 'text-emerald-400')}>
        {formatCurrency(amount)}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onToggle} className="text-surface-500 hover:text-amber-400 p-1" title={payment.isActive ? 'Pausieren' : 'Aktivieren'}>
          {payment.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={onDelete} className="text-surface-500 hover:text-red-400 p-1">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
