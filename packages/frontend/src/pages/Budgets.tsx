import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import { budgetsApi, categoriesApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function BudgetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newBudget, setNewBudget] = useState({ categoryId: '', amount: '' });

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsApi.getAll().then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => budgetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowForm(false);
      setNewBudget({ categoryId: '', amount: '' });
      toast.success('Budget erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget gelöscht');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budgets</h1>
          <p className="text-surface-400 mt-1">Deine monatlichen Budgetgrenzen</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Abbrechen' : 'Neues Budget'}
        </button>
      </div>

      {/* New Budget Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Neues Budget erstellen</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ categoryId: newBudget.categoryId, amount: Number(newBudget.amount) });
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <select
              value={newBudget.categoryId}
              onChange={(e) => setNewBudget({ ...newBudget, categoryId: e.target.value })}
              className="input flex-1"
              required
            >
              <option value="">Kategorie wählen</option>
              {categories?.filter((c: any) => !c.isSystem).map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={newBudget.amount}
              onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
              placeholder="Betrag in €"
              className="input w-full sm:w-40"
              required
              min="1"
              step="0.01"
            />
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erstellen'}
            </button>
          </form>
        </div>
      )}

      {/* Budget List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : budgets?.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-500">Noch keine Budgets angelegt.</p>
          <p className="text-surface-600 text-sm mt-1">Erstelle dein erstes Budget, um deine Ausgaben im Blick zu behalten.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets?.map((budget: any) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onDelete={() => deleteMutation.mutate(budget.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetCard({ budget, onDelete }: { budget: any; onDelete: () => void }) {
  const percentage = Math.min(budget.percentage, 100);
  const isOverBudget = budget.percentage > 100;
  const isWarning = budget.percentage > 80 && budget.percentage <= 100;

  const barColor = isOverBudget
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="card-hover group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{budget.category?.icon || '📌'}</span>
          <h4 className="font-medium text-surface-200">{budget.category?.name}</h4>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-2.5 rounded-full bg-surface-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={cn(
          'font-semibold',
          isOverBudget ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-surface-200'
        )}>
          {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
        </span>
        <span className={cn(
          'text-xs font-medium',
          isOverBudget ? 'badge-red' : isWarning ? 'badge-yellow' : 'badge-green'
        )}>
          {budget.percentage}%
        </span>
      </div>

      {budget.remaining > 0 && (
        <p className="text-xs text-surface-500 mt-2">
          Noch {formatCurrency(budget.remaining)} übrig
        </p>
      )}
      {budget.remaining < 0 && (
        <p className="text-xs text-red-400 mt-2">
          {formatCurrency(Math.abs(budget.remaining))} über Budget
        </p>
      )}
    </div>
  );
}
