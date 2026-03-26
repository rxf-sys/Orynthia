import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Plus, X, Trash2, Download } from 'lucide-react';
import { transactionsApi, categoriesApi, accountsApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Transaction, Category, CreateTransactionData, BankAccount } from '@/lib/types';
import toast from 'react-hot-toast';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newTx, setNewTx] = useState({
    bankAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    counterpartName: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    categoryId: '',
  });
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data: result, isLoading } = useQuery({
    queryKey: ['transactions', page, debouncedSearch, categoryFilter],
    queryFn: () =>
      transactionsApi.getAll({
        page,
        limit: 25,
        search: debouncedSearch || undefined,
        categoryId: categoryFilter || undefined,
      }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) => transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaktion aktualisiert');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTransactionData) => transactionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setNewTx({ bankAccountId: accounts?.[0]?.id || '', amount: '', date: new Date().toISOString().split('T')[0], purpose: '', counterpartName: '', type: 'EXPENSE', categoryId: '' });
      toast.success('Transaktion erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Transaktion gelöscht');
    },
  });

  // Set default account when accounts load
  useEffect(() => {
    if (accounts?.length && !newTx.bankAccountId) {
      setNewTx(prev => ({ ...prev, bankAccountId: accounts[0].id }));
    }
  }, [accounts, newTx.bankAccountId]);

  const transactions = result?.data || [];
  const meta = result?.meta || { total: 0, page: 1, totalPages: 1 };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.abs(Number(newTx.amount));
    if (!amount || amount <= 0) {
      toast.error('Bitte gültigen Betrag eingeben');
      return;
    }
    createMutation.mutate({
      bankAccountId: newTx.bankAccountId,
      amount: newTx.type === 'EXPENSE' ? -amount : amount,
      date: newTx.date,
      purpose: newTx.purpose || undefined,
      counterpartName: newTx.counterpartName || undefined,
      categoryId: newTx.categoryId || undefined,
      type: newTx.type,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transaktionen</h1>
          <p className="text-surface-400 mt-1">{meta.total} Transaktionen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const res = await transactionsApi.exportCsv({ categoryId: categoryFilter || undefined, search: debouncedSearch || undefined });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `transaktionen_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success('CSV exportiert');
              } catch { toast.error('Export fehlgeschlagen'); }
            }}
            className="btn-ghost"
            title="Als CSV exportieren"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Abbrechen' : 'Neue Transaktion'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Neue Transaktion</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Typ</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'EXPENSE' })}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-colors', newTx.type === 'EXPENSE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-surface-800 text-surface-400')}
                >
                  Ausgabe
                </button>
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'INCOME' })}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-colors', newTx.type === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-surface-800 text-surface-400')}
                >
                  Einnahme
                </button>
              </div>
            </div>
            <div>
              <label className="label">Betrag (EUR) *</label>
              <input type="number" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} className="input" placeholder="0.00" step="0.01" min="0.01" required />
            </div>
            <div>
              <label className="label">Datum *</label>
              <input type="date" value={newTx.date} onChange={(e) => setNewTx({ ...newTx, date: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Empfänger / Auftraggeber</label>
              <input value={newTx.counterpartName} onChange={(e) => setNewTx({ ...newTx, counterpartName: e.target.value })} className="input" placeholder="z.B. REWE, Arbeitgeber" />
            </div>
            <div>
              <label className="label">Verwendungszweck</label>
              <input value={newTx.purpose} onChange={(e) => setNewTx({ ...newTx, purpose: e.target.value })} className="input" placeholder="z.B. Wocheneinkauf" />
            </div>
            <div>
              <label className="label">Konto *</label>
              <select value={newTx.bankAccountId} onChange={(e) => setNewTx({ ...newTx, bankAccountId: e.target.value })} className="input" required>
                {accounts?.map((acc: BankAccount) => (
                  <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kategorie</label>
              <select value={newTx.categoryId} onChange={(e) => setNewTx({ ...newTx, categoryId: e.target.value })} className="input">
                <option value="">Automatisch zuordnen</option>
                {categories?.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
                {createMutation.isPending ? 'Wird erstellt...' : 'Transaktion erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name, Verwendungszweck..."
            className="input pl-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="input w-full sm:w-48"
        >
          <option value="">Alle Kategorien</option>
          {categories?.map((cat: Category) => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
          ))}
        </select>
      </div>

      {/* Transaction List */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-surface-500">Keine Transaktionen gefunden</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {transactions.map((tx: Transaction) => (
              <div key={tx.id} className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-surface-800/30 transition-colors group">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-800 text-lg shrink-0">
                    {tx.category?.icon || '💳'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-200 truncate">
                      {tx.counterpartName || tx.purpose || 'Transaktion'}
                    </p>
                    <p className="text-xs text-surface-500 truncate">
                      {tx.purpose && tx.counterpartName ? tx.purpose : formatDate(tx.date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  {/* Category Selector */}
                  <select
                    value={tx.categoryId || ''}
                    onChange={(e) => updateMutation.mutate({ id: tx.id, data: { categoryId: e.target.value || undefined } })}
                    className="hidden md:block text-xs bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-surface-300 max-w-[140px]"
                  >
                    <option value="">Unkategorisiert</option>
                    {categories?.map((cat: Category) => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>

                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-semibold',
                      Number(tx.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {Number(tx.amount) >= 0 ? '+' : ''}{formatCurrency(Number(tx.amount))}
                    </p>
                    <p className="text-xs text-surface-500 hidden sm:block">{formatDate(tx.date)}</p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('Transaktion wirklich löschen?')) {
                        deleteMutation.mutate(tx.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-600 hover:text-red-400 p-1"
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-surface-800">
            <p className="text-sm text-surface-500">
              Seite {meta.page} von {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-ghost p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                disabled={page === meta.totalPages}
                className="btn-ghost p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
