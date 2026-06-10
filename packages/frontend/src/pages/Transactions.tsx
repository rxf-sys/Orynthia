import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Pencil,
  Download,
  Loader2,
} from 'lucide-react';
import { transactionsApi, categoriesApi, accountsApi } from '@/lib/api';
import { formatCurrency, formatDate, formatDateRelative, parseDecimal, cn } from '@/lib/utils';
import type { Transaction, Category, CreateTransactionData, BankAccount } from '@/lib/types';
import toast from 'react-hot-toast';
import {
  Card,
  Btn,
  Field,
  PageHead,
  CategoryIcon,
  Modal,
  EmptyState,
  useConfirm,
} from '@/components/ui';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
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

  // ⌘K-Palette navigiert mit /transactions?search=… hierher: Param einmalig
  // in den Such-State übernehmen und aus der URL entfernen.
  useEffect(() => {
    const param = searchParams.get('search');
    if (param !== null) {
      setSearch(param);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditing(null);
      toast.success('Transaktion aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const inlineCategoryMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string; previousCategoryId: string }) =>
      transactionsApi.update(id, { categoryId: categoryId || undefined }),
    onSuccess: (_res, { id, previousCategoryId }) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success((t) => (
        <span>
          Kategorie geändert{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              updateMutation.mutate({ id, data: { categoryId: previousCategoryId || undefined } });
              toast.dismiss(t.id);
            }}
          >
            Rückgängig
          </button>
        </span>
      ));
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
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
    const parsed = parseDecimal(newTx.amount);
    const amount = parsed === null ? null : Math.abs(parsed);
    if (amount === null || amount <= 0) {
      setAmountError('Ungültiger Betrag');
      return;
    }
    setAmountError(null);
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
            <fieldset disabled={createMutation.isPending} className="contents">
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
              <Field label="Betrag (EUR)" required error={amountError}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newTx.amount}
                  onChange={(e) => {
                    setNewTx({ ...newTx, amount: e.target.value });
                    setAmountError(null);
                  }}
                  className="input tnum"
                  placeholder="0,00"
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
                <Btn
                  type="submit"
                  variant="grad"
                  disabled={createMutation.isPending || !newTx.bankAccountId}
                  className="w-full"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
                </Btn>
              </div>
            </fieldset>
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
          <div className="px-4 py-6">
            <EmptyState
              icon={Search}
              title={debouncedSearch || categoryFilter ? 'Keine Transaktionen gefunden' : 'Noch keine Transaktionen'}
              description={
                debouncedSearch || categoryFilter
                  ? 'Passe deine Filter an oder erstelle eine neue Transaktion.'
                  : 'Verbinde ein Bankkonto für automatischen Import oder erfasse Transaktionen manuell.'
              }
              action={{ label: 'Neue Transaktion', icon: Plus, onClick: () => setShowForm(true) }}
              compact
            />
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
                            inlineCategoryMutation.mutate({
                              id: tx.id,
                              categoryId: e.target.value,
                              previousCategoryId: tx.categoryId || '',
                            })
                          }
                          className="hidden max-w-[160px] rounded-md border border-line bg-elev px-2 py-1 text-xs text-ink-2 md:block"
                          aria-label="Kategorie ändern"
                        >
                          <option value="">Unkategorisiert</option>
                          {categories?.map((cat: Category) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                        {tx.category && (
                          <span className="hidden truncate rounded-pill bg-soft px-2 py-0.5 text-[0.7rem] text-ink-2 sm:inline md:hidden">
                            {tx.category.icon} {tx.category.name}
                          </span>
                        )}
                        <div
                          className="tnum w-24 text-right text-sm font-bold sm:w-28"
                          style={isIncome ? { color: 'var(--pos)' } : undefined}
                        >
                          {isIncome ? '+' : ''}
                          {formatCurrency(amount)}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          <button
                            onClick={() => setEditing(tx)}
                            className="rounded p-1.5 text-ink-3 hover:bg-soft hover:text-indigo"
                            aria-label="Transaktion bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Transaktion löschen?',
                                description: tx.counterpartName || tx.purpose || formatCurrency(amount),
                                confirmLabel: 'Löschen',
                                destructive: true,
                              });
                              if (ok) deleteMutation.mutate(tx.id);
                            }}
                            className="rounded p-1.5 text-ink-3 hover:bg-soft hover:text-neg"
                            aria-label="Transaktion löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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

      {editing && (
        <EditTransactionModal
          tx={editing}
          accounts={accounts || []}
          categories={categories || []}
          onClose={() => setEditing(null)}
          onSave={(data) => updateMutation.mutate({ id: editing.id, data })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditTransactionModal({
  tx,
  accounts,
  categories,
  onClose,
  onSave,
  isPending,
}: {
  tx: Transaction;
  accounts: BankAccount[];
  categories: Category[];
  onClose: () => void;
  onSave: (data: Partial<CreateTransactionData>) => void;
  isPending: boolean;
}) {
  const initialAmount = Number(tx.amount);
  const [form, setForm] = useState({
    amount: String(Math.abs(initialAmount)),
    date: tx.date.split('T')[0],
    purpose: tx.purpose || '',
    counterpartName: tx.counterpartName || '',
    categoryId: tx.categoryId || '',
    type: (initialAmount >= 0 ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
    notes: tx.notes || '',
  });

  const handleSubmit = () => {
    const amt = Math.abs(Number(form.amount));
    if (!amt || amt <= 0) {
      toast.error('Bitte gültigen Betrag eingeben');
      return;
    }
    onSave({
      amount: form.type === 'EXPENSE' ? -amt : amt,
      date: form.date,
      purpose: form.purpose || undefined,
      counterpartName: form.counterpartName || undefined,
      categoryId: form.categoryId || undefined,
      type: form.type,
      notes: form.notes || undefined,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Transaktion bearbeiten"
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={isPending}>
            Abbrechen
          </Btn>
          <Btn variant="grad" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={isPending} className="contents">
          <Field label="Typ">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'EXPENSE' })}
                className={cn(
                  'flex-1 rounded-md border py-2.5 text-sm font-semibold transition',
                  form.type === 'EXPENSE'
                    ? 'border-transparent bg-indigo text-white'
                    : 'border-line bg-elev text-ink-2',
                )}
              >
                Ausgabe
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'INCOME' })}
                className={cn(
                  'flex-1 rounded-md border py-2.5 text-sm font-semibold transition',
                  form.type === 'INCOME'
                    ? 'border-transparent text-white'
                    : 'border-line bg-elev text-ink-2',
                )}
                style={form.type === 'INCOME' ? { background: 'var(--pos)' } : undefined}
              >
                Einnahme
              </button>
            </div>
          </Field>
          <Field label="Betrag (EUR)" required>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input tnum"
              step="0.01"
              min="0.01"
            />
          </Field>
          <Field label="Datum" required>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Empfänger / Auftraggeber">
            <input
              value={form.counterpartName}
              onChange={(e) => setForm({ ...form, counterpartName: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Verwendungszweck">
            <input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Kategorie">
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="select"
            >
              <option value="">Unkategorisiert</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notizen" className="sm:col-span-2">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input min-h-[80px]"
            />
          </Field>
        </fieldset>
      </div>
      {accounts.length > 0 && (
        <p className="mt-3 text-xs text-ink-3">
          Konto: <strong>{accounts.find((a) => a.id === tx.bankAccountId)?.bankName}</strong> –{' '}
          {accounts.find((a) => a.id === tx.bankAccountId)?.accountName} (Konto-Zuordnung ist nicht änderbar)
        </p>
      )}
    </Modal>
  );
}
