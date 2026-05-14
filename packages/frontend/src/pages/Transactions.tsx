import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Download,
  Loader2,
} from 'lucide-react';
import { transactionsApi, categoriesApi, accountsApi } from '@/lib/api';
import { formatCurrency, formatDate, formatDateRelative, cn } from '@/lib/utils';
import type { Transaction, Category, CreateTransactionData, BankAccount } from '@/lib/types';
import toast from 'react-hot-toast';
import {
  Card,
  Btn,
  Field,
  PageHead,
  CategoryIcon,
  pickCategoryColor,
} from '@/components/ui';

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
      transactionsApi
        .getAll({
          page,
          limit: 25,
          search: debouncedSearch || undefined,
          categoryId: categoryFilter || undefined,
        })
        .then((r) => r.data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) =>
      transactionsApi.update(id, data),
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
      setNewTx({
        bankAccountId: accounts?.[0]?.id || '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        purpose: '',
        counterpartName: '',
        type: 'EXPENSE',
        categoryId: '',
      });
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

  useEffect(() => {
    if (accounts?.length && !newTx.bankAccountId) {
      setNewTx((prev) => ({ ...prev, bankAccountId: accounts[0].id }));
    }
  }, [accounts, newTx.bankAccountId]);

  const transactions: Transaction[] = result?.data || [];
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

  // Group transactions by date
  const groups = new Map<string, Transaction[]>();
  transactions.forEach((tx) => {
    const key = tx.date.split('T')[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  });

  return (
    <div className="space-y-5">
      <PageHead
        title="Transaktionen"
        sub={`${meta.total} Einträge${categoryFilter ? ' · gefiltert' : ''}`}
        actions={
          <>
            <Btn
              variant="ghost"
              icon={Download}
              onClick={async () => {
                try {
                  const res = await transactionsApi.exportCsv({
                    categoryId: categoryFilter || undefined,
                    search: debouncedSearch || undefined,
                  });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transaktionen_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('CSV exportiert');
                } catch {
                  toast.error('Export fehlgeschlagen');
                }
              }}
            >
              Export
            </Btn>
            <Btn
              variant="grad"
              icon={showForm ? X : Plus}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? 'Abbrechen' : 'Neue Transaktion'}
            </Btn>
          </>
        }
      />

      {showForm && (
        <Card
          className="animate-fade-in"
          style={{
            borderStyle: 'dashed',
            borderColor: 'var(--peach)',
            background: 'rgba(255,177,122,.05)',
          }}
        >
          <h3 className="mb-4 text-lg font-bold text-ink">Neue Transaktion</h3>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Typ">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'EXPENSE' })}
                  className={cn(
                    'flex-1 rounded-md border py-2.5 text-sm font-semibold transition',
                    newTx.type === 'EXPENSE'
                      ? 'border-transparent bg-indigo text-white'
                      : 'border-line bg-elev text-ink-2',
                  )}
                >
                  Ausgabe
                </button>
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'INCOME' })}
                  className={cn(
                    'flex-1 rounded-md border py-2.5 text-sm font-semibold transition',
                    newTx.type === 'INCOME'
                      ? 'border-transparent text-white'
                      : 'border-line bg-elev text-ink-2',
                  )}
                  style={newTx.type === 'INCOME' ? { background: 'var(--pos)' } : undefined}
                >
                  Einnahme
                </button>
              </div>
            </Field>
            <Field label="Betrag (EUR)" required>
              <input
                type="number"
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                className="input tnum"
                placeholder="0,00"
                step="0.01"
                min="0.01"
                required
              />
            </Field>
            <Field label="Datum" required>
              <input
                type="date"
                value={newTx.date}
                onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Empfänger / Auftraggeber">
              <input
                value={newTx.counterpartName}
                onChange={(e) => setNewTx({ ...newTx, counterpartName: e.target.value })}
                className="input"
                placeholder="z. B. REWE, Arbeitgeber"
              />
            </Field>
            <Field label="Verwendungszweck">
              <input
                value={newTx.purpose}
                onChange={(e) => setNewTx({ ...newTx, purpose: e.target.value })}
                className="input"
                placeholder="z. B. Wocheneinkauf"
              />
            </Field>
            <Field label="Konto" required>
              <select
                value={newTx.bankAccountId}
                onChange={(e) => setNewTx({ ...newTx, bankAccountId: e.target.value })}
                className="select"
                required
              >
                {accounts?.map((acc: BankAccount) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} — {acc.accountName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kategorie">
              <select
                value={newTx.categoryId}
                onChange={(e) => setNewTx({ ...newTx, categoryId: e.target.value })}
                className="select"
              >
                <option value="">Automatisch zuordnen</option>
                {categories?.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Btn type="submit" variant="grad" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Filter strip */}
      <Card variant="flat" className="!py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche nach Name, Verwendungszweck…"
              className="input pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="select w-full sm:w-56"
          >
            <option value="">Alle Kategorien</option>
            {categories?.map((cat: Category) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* List */}
      <Card className="!p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Search className="h-8 w-8 text-ink-4" />
            <p className="text-sm font-semibold text-ink-2">Keine Transaktionen gefunden</p>
            <p className="text-xs text-ink-3">Passe deine Filter an oder erstelle eine neue Transaktion.</p>
          </div>
        ) : (
          <div>
            {Array.from(groups.entries()).map(([dateKey, txs]) => (
              <div key={dateKey}>
                <div className="flex items-center justify-between border-y bg-soft px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-3" style={{ borderColor: 'var(--line-2)' }}>
                  <span>{formatDateRelative(dateKey)}</span>
                  <span>{formatDate(dateKey)}</span>
                </div>
                <div>
                  {txs.map((tx) => {
                    const amount = Number(tx.amount);
                    const isIncome = amount > 0;
                    return (
                      <div
                        key={tx.id}
                        className="group flex items-center gap-4 border-b px-5 py-3 transition-colors last:border-0 hover:bg-soft"
                        style={{ borderColor: 'var(--line-2)' }}
                      >
                        <CategoryIcon cat={tx.category} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[0.9rem] font-semibold text-ink">
                            {tx.counterpartName || tx.purpose || 'Transaktion'}
                          </div>
                          {tx.purpose && tx.counterpartName && (
                            <div className="truncate text-[0.75rem] text-ink-3">{tx.purpose}</div>
                          )}
                        </div>
                        <select
                          value={tx.categoryId || ''}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: tx.id,
                              data: { categoryId: e.target.value || undefined },
                            })
                          }
                          className="hidden max-w-[160px] rounded-md border border-line bg-elev px-2 py-1 text-xs text-ink-2 md:block"
                        >
                          <option value="">Unkategorisiert</option>
                          {categories?.map((cat: Category) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                        <div
                          className="tnum w-28 text-right text-sm font-bold"
                          style={isIncome ? { color: 'var(--pos)' } : undefined}
                        >
                          {isIncome ? '+' : ''}
                          {formatCurrency(amount)}
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Transaktion wirklich löschen?')) {
                              deleteMutation.mutate(tx.id);
                            }
                          }}
                          className="text-ink-3 opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
                          aria-label="Transaktion löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm text-ink-3">
              Seite {meta.page} von {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                aria-label="Vorherige Seite"
              >
                <ChevronLeft className="h-4 w-4" />
              </Btn>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                disabled={page === meta.totalPages}
                aria-label="Nächste Seite"
              >
                <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// silence unused import warning when palette not in use
void pickCategoryColor;
