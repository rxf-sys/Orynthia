import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Check, Minus } from 'lucide-react';
import { savingsGoalsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { SavingsGoal, CreateSavingsGoalData } from '@/lib/types';
import toast from 'react-hot-toast';

const defaultIcons = ['🏖️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🎁', '🏥', '📈'];

export function SavingsGoalsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', targetAmount: '', currentAmount: '', deadline: '', icon: '🏖️', color: '#3b82f6' });
  const [addAmountId, setAddAmountId] = useState<string | null>(null);
  const [addAmountValue, setAddAmountValue] = useState('');

  const { data: goals, isLoading } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => savingsGoalsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSavingsGoalData) => savingsGoalsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      setShowForm(false);
      setForm({ name: '', targetAmount: '', currentAmount: '', deadline: '', icon: '🏖️', color: '#3b82f6' });
      toast.success('Sparziel erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const addAmountMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => savingsGoalsApi.addAmount(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      setAddAmountId(null);
      setAddAmountValue('');
      toast.success('Betrag aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savingsGoalsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      toast.success('Sparziel gelöscht');
    },
  });

  const activeGoals = goals?.filter((g) => !g.isCompleted) || [];
  const completedGoals = goals?.filter((g) => g.isCompleted) || [];
  const totalSaved = goals?.reduce((sum, g) => sum + g.currentAmount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sparziele</h1>
          <p className="text-surface-400 mt-1">
            Gespart: <span className="text-emerald-400 font-semibold">{formatCurrency(totalSaved)}</span>
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Abbrechen' : 'Neues Ziel'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Neues Sparziel</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const targetAmount = Number(form.targetAmount);
              if (!targetAmount || targetAmount <= 0) { toast.error('Bitte Zielbetrag eingeben'); return; }
              createMutation.mutate({
                name: form.name,
                targetAmount,
                currentAmount: Number(form.currentAmount) || 0,
                deadline: form.deadline || undefined,
                icon: form.icon,
                color: form.color,
              });
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="label">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="z.B. Urlaub, Auto..." required />
            </div>
            <div>
              <label className="label">Zielbetrag *</label>
              <input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} className="input" placeholder="3000" min="1" step="0.01" required />
            </div>
            <div>
              <label className="label">Bereits gespart</label>
              <input type="number" value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} className="input" placeholder="0" min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Deadline</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Icon</label>
              <div className="flex gap-1 flex-wrap">
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={cn(
                      'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all',
                      form.icon === icon ? 'bg-brand-600 ring-2 ring-brand-400' : 'bg-surface-800 hover:bg-surface-700',
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Farbe</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="input h-10 p-1 cursor-pointer" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : goals?.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-500">Noch keine Sparziele.</p>
          <p className="text-surface-600 text-sm mt-1">Setze dir ein Sparziel und verfolge deinen Fortschritt.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeGoals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  showAddAmount={addAmountId === goal.id}
                  addAmountValue={addAmountValue}
                  onToggleAdd={() => { setAddAmountId(addAmountId === goal.id ? null : goal.id); setAddAmountValue(''); }}
                  onAddAmountChange={setAddAmountValue}
                  onAddAmount={(amount) => addAmountMutation.mutate({ id: goal.id, amount })}
                  onDelete={() => { if (confirm('Sparziel wirklich löschen?')) deleteMutation.mutate(goal.id); }}
                  isPending={addAmountMutation.isPending}
                />
              ))}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-surface-500 mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" /> Erreichte Ziele
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    showAddAmount={false}
                    addAmountValue=""
                    onToggleAdd={() => {}}
                    onAddAmountChange={() => {}}
                    onAddAmount={() => {}}
                    onDelete={() => { if (confirm('Sparziel wirklich löschen?')) deleteMutation.mutate(goal.id); }}
                    isPending={false}
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

function GoalCard({
  goal,
  showAddAmount,
  addAmountValue,
  onToggleAdd,
  onAddAmountChange,
  onAddAmount,
  onDelete,
  isPending,
}: {
  goal: SavingsGoal;
  showAddAmount: boolean;
  addAmountValue: string;
  onToggleAdd: () => void;
  onAddAmountChange: (val: string) => void;
  onAddAmount: (amount: number) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const percentage = Math.min(goal.percentage, 100);
  const color = goal.color || '#3b82f6';

  return (
    <div className="card-hover group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{goal.icon || '🎯'}</span>
          <div>
            <h4 className="font-medium text-surface-200">{goal.name}</h4>
            {goal.deadline && (
              <p className="text-xs text-surface-500">
                Bis {new Date(goal.deadline).toLocaleDateString('de-DE')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!goal.isCompleted && (
            <button onClick={onToggleAdd} className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-brand-400 p-1" title="Betrag einzahlen">
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-3 rounded-full bg-surface-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-surface-200 font-semibold">
          {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
        </span>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          goal.isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-800 text-surface-400',
        )}>
          {goal.percentage}%
        </span>
      </div>

      {goal.remaining > 0 && (
        <p className="text-xs text-surface-500 mt-2">
          Noch {formatCurrency(goal.remaining)} bis zum Ziel
        </p>
      )}

      {goal.isCompleted && (
        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
          <Check className="h-3 w-3" /> Ziel erreicht!
        </p>
      )}

      {/* Add Amount Form */}
      {showAddAmount && (
        <div className="mt-4 pt-4 border-t border-surface-800">
          <div className="flex gap-2">
            <input
              type="number"
              value={addAmountValue}
              onChange={(e) => onAddAmountChange(e.target.value)}
              placeholder="Betrag"
              className="input flex-1 text-sm"
              step="0.01"
              autoFocus
            />
            <button
              onClick={() => {
                const val = Number(addAmountValue);
                if (!val) return;
                onAddAmount(val);
              }}
              disabled={isPending}
              className="btn-primary text-sm px-3"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </button>
            <button
              onClick={() => {
                const val = Number(addAmountValue);
                if (!val || val <= 0) return;
                onAddAmount(-val);
              }}
              disabled={isPending}
              className="btn-ghost text-sm px-3"
              title="Abheben"
            >
              <Minus className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
