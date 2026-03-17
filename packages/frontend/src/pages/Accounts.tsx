import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Building2, CreditCard, PiggyBank, TrendingUp } from 'lucide-react';
import { accountsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { BankAccount, CreateAccountData } from '@/lib/types';
import toast from 'react-hot-toast';

const accountTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CHECKING: { label: 'Girokonto', icon: <Building2 className="h-5 w-5" />, color: 'text-blue-400 bg-blue-500/10' },
  SAVINGS: { label: 'Sparkonto', icon: <PiggyBank className="h-5 w-5" />, color: 'text-emerald-400 bg-emerald-500/10' },
  CREDIT_CARD: { label: 'Kreditkarte', icon: <CreditCard className="h-5 w-5" />, color: 'text-amber-400 bg-amber-500/10' },
  DEPOT: { label: 'Depot', icon: <TrendingUp className="h-5 w-5" />, color: 'text-purple-400 bg-purple-500/10' },
};

export function AccountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bankName: '', accountName: '', iban: '', accountType: 'CHECKING', balance: '' });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then((r) => r.data),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['accounts-balance'],
    queryFn: () => accountsApi.getBalance().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountData) => accountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
      setShowForm(false);
      setForm({ bankName: '', accountName: '', iban: '', accountType: 'CHECKING', balance: '' });
      toast.success('Konto hinzugefügt');
    },
    onError: () => toast.error('Fehler beim Hinzufügen'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Konto entfernt');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Konten</h1>
          <p className="text-surface-400 mt-1">
            Gesamtsaldo: <span className="text-white font-semibold">{formatCurrency(balanceData?.totalBalance || 0)}</span>
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Abbrechen' : 'Konto hinzufügen'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Neues Konto</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ ...form, balance: Number(form.balance) || 0 });
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div>
              <label className="label">Bankname *</label>
              <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="input" placeholder="z.B. Sparkasse" required />
            </div>
            <div>
              <label className="label">Kontoname *</label>
              <input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className="input" placeholder="z.B. Girokonto" required />
            </div>
            <div>
              <label className="label">IBAN</label>
              <input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="input" placeholder="DE89 3704 0044 ..." />
            </div>
            <div>
              <label className="label">Kontotyp</label>
              <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })} className="input">
                <option value="CHECKING">Girokonto</option>
                <option value="SAVINGS">Sparkonto</option>
                <option value="CREDIT_CARD">Kreditkarte</option>
                <option value="DEPOT">Depot</option>
              </select>
            </div>
            <div>
              <label className="label">Aktueller Kontostand</label>
              <input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="input" placeholder="0.00" step="0.01" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Konto erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : accounts?.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-500">Noch keine Konten hinzugefügt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts?.map((acc: BankAccount) => {
            const config = accountTypeConfig[acc.accountType] || accountTypeConfig.CHECKING;
            return (
              <div key={acc.id} className="card-hover group">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('rounded-xl p-2.5', config.color)}>
                    {config.icon}
                  </div>
                  <button
                    onClick={() => { if (confirm('Konto wirklich entfernen?')) deleteMutation.mutate(acc.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h4 className="text-lg font-semibold text-white">{acc.accountName}</h4>
                <p className="text-sm text-surface-500">{acc.bankName}</p>
                {acc.iban && <p className="text-xs text-surface-600 mt-1 font-mono">{acc.iban}</p>}
                <div className="mt-4 pt-4 border-t border-surface-800">
                  <p className="text-2xl font-bold text-white">{formatCurrency(Number(acc.balance))}</p>
                  <p className="text-xs text-surface-500 mt-1">{config.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
