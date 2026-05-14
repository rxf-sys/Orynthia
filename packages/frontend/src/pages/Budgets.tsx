import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Target } from 'lucide-react';
import { budgetsApi, categoriesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Budget, Category, CreateBudgetData } from '@/lib/types';
import toast from 'react-hot-toast';
import { Card, Btn, Field, PageHead, Progress, Tag, CategoryIcon } from '@/components/ui';

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
    mutationFn: (data: CreateBudgetData) => budgetsApi.create(data),
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

  const totalBudget = (budgets || []).reduce((s: number, b: Budget) => s + b.amount, 0);
  const totalSpent = (budgets || []).reduce((s: number, b: Budget) => s + b.spent, 0);
  const overBudgetCount = (budgets || []).filter((b: Budget) => b.percentage > 100).length;
  const overallPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  return (
    <div className="space-y-5">
      <PageHead
        title="Budgets"
        sub={`${budgets?.length ?? 0} aktive Budgets · ${overBudgetCount} überzogen`}
        actions={
          <Btn variant="grad" icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Abbrechen' : 'Budget anlegen'}
          </Btn>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Gesamtbudget
          </div>
          <div className="tnum mt-2 text-[1.85rem] font-bold">{formatCurrency(totalBudget)}</div>
          <Progress value={overallPercent} className="mt-3" />
          <div className="mt-1 text-xs text-ink-3 tnum">
            {formatCurrency(totalSpent)} ausgegeben · {overallPercent}%
          </div>
        </Card>
        <Card>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Verfügbar
          </div>
          <div
            className="tnum mt-2 text-[1.85rem] font-bold"
            style={{ color: totalBudget - totalSpent >= 0 ? 'var(--pos)' : 'var(--neg)' }}
          >
            {formatCurrency(Math.max(0, totalBudget - totalSpent))}
          </div>
          <div className="mt-1 text-xs text-ink-3">in laufendem Zeitraum</div>
        </Card>
        <Card>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Über Budget
          </div>
          <div
            className="tnum mt-2 text-[1.85rem] font-bold"
            style={{ color: overBudgetCount > 0 ? 'var(--neg)' : undefined }}
          >
            {overBudgetCount}
          </div>
          <div className="mt-1 text-xs text-ink-3">Kategorien</div>
        </Card>
        <Card variant="soft" style={{ background: 'var(--grad-soft)' }}>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Tipp
          </div>
          <p className="mt-2 text-sm text-ink">
            Halte einen Puffer von <strong>10–20 %</strong> in jedem Budget, um Überraschungen abzufedern.
          </p>
        </Card>
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
          <h3 className="mb-4 text-lg font-bold text-ink">Neues Budget</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(newBudget.amount);
              if (!amount || amount <= 0) {
                toast.error('Bitte gültigen Betrag eingeben');
                return;
              }
              createMutation.mutate({ categoryId: newBudget.categoryId, amount });
            }}
            className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
          >
            <Field label="Kategorie" required>
              <select
                value={newBudget.categoryId}
                onChange={(e) => setNewBudget({ ...newBudget, categoryId: e.target.value })}
                className="select"
                required
              >
                <option value="">Kategorie wählen</option>
                {categories?.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Betrag" required>
              <input
                type="number"
                value={newBudget.amount}
                onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
                placeholder="0,00 €"
                className="input tnum"
                required
                min="1"
                step="0.01"
              />
            </Field>
            <Btn type="submit" variant="grad" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erstellen'}
            </Btn>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo" />
        </div>
      ) : budgets?.length === 0 ? (
        <Card className="text-center" style={{ padding: '48px 24px' }}>
          <Target className="mx-auto mb-3 h-10 w-10 text-ink-4" />
          <p className="font-semibold text-ink">Noch keine Budgets</p>
          <p className="mt-1 text-sm text-ink-3">
            Erstelle dein erstes Budget, um Ausgaben im Griff zu behalten.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets?.map((b: Budget) => (
            <BudgetCard key={b.id} budget={b} onDelete={() => deleteMutation.mutate(b.id)} />
          ))}
          <button
            onClick={() => setShowForm(true)}
            className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-ink-3 transition-colors hover:border-peach hover:bg-soft hover:text-ink"
            style={{ borderColor: 'var(--line)' }}
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-semibold">Budget anlegen</span>
          </button>
        </div>
      )}
    </div>
  );
}

function BudgetCard({ budget, onDelete }: { budget: Budget; onDelete: () => void }) {
  const pct = Math.min(budget.percentage, 100);
  const over = budget.percentage > 100;
  const warn = budget.percentage > 80 && !over;
  const cat = budget.category || { name: 'Kategorie', icon: '📌' };

  let statusVariant: 'pos' | 'warn' | 'neg' = 'pos';
  let statusLabel = 'Im Plan';
  if (over) {
    statusVariant = 'neg';
    statusLabel = 'Überzogen';
  } else if (warn) {
    statusVariant = 'warn';
    statusLabel = 'Knapp';
  }

  return (
    <Card className="group flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <CategoryIcon cat={cat} size={36} />
          <div>
            <div className="font-semibold text-ink">{cat.name}</div>
            <div className="text-[0.72rem] text-ink-3">Monatsbudget</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Tag variant={statusVariant}>{statusLabel}</Tag>
          <button
            onClick={onDelete}
            className="opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
            aria-label="Budget löschen"
          >
            <Trash2 className="h-4 w-4 text-ink-3" />
          </button>
        </div>
      </div>

      <div>
        <div className="tnum text-[1.6rem] font-bold leading-tight">
          {formatCurrency(budget.spent)}
        </div>
        <div className="text-xs text-ink-3 tnum">
          von {formatCurrency(budget.amount)}
        </div>
      </div>

      <Progress
        value={pct}
        color={over ? 'var(--neg)' : cat.color || undefined}
        thick
      />

      <div className="flex items-center justify-between text-xs">
        <span className="tnum font-semibold text-ink-2">{budget.percentage}%</span>
        {budget.remaining >= 0 ? (
          <span className="tnum text-ink-3">Noch {formatCurrency(budget.remaining)}</span>
        ) : (
          <span className="tnum text-neg">{formatCurrency(Math.abs(budget.remaining))} drüber</span>
        )}
      </div>
    </Card>
  );
}
