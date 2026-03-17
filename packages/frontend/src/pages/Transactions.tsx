import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { transactionsApi, categoriesApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Transaction, Category } from '@/lib/types';
import toast from 'react-hot-toast';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: result, isLoading } = useQuery({
    queryKey: ['transactions', page, search, categoryFilter],
    queryFn: () =>
      transactionsApi.getAll({
        page,
        limit: 25,
        search: search || undefined,
        categoryId: categoryFilter || undefined,
      }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) => transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaktion aktualisiert');
    },
  });

  const transactions = result?.data || [];
  const meta = result?.meta || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transaktionen</h1>
          <p className="text-surface-400 mt-1">{meta.total} Transaktionen</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
              <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-surface-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-800 text-lg shrink-0">
                    {tx.category?.icon || '💳'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-200 truncate">
                      {tx.counterpartName || tx.purpose || 'Transaktion'}
                    </p>
                    <p className="text-xs text-surface-500 truncate">
                      {tx.purpose && tx.counterpartName ? tx.purpose : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {/* Category Selector */}
                  <select
                    value={tx.categoryId || ''}
                    onChange={(e) => updateMutation.mutate({ id: tx.id, data: { categoryId: e.target.value || null } })}
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
                    <p className="text-xs text-surface-500">{formatDate(tx.date)}</p>
                  </div>
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
