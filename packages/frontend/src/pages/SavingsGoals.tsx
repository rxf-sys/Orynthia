import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Check, Minus, Lightbulb, PiggyBank } from 'lucide-react';
import { savingsGoalsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { SavingsGoal, CreateSavingsGoalData } from '@/lib/types';
import toast from 'react-hot-toast';
import { Card, Btn, Field, PageHead, Progress, Tag } from '@/components/ui';

const defaultIcons = ['🏖️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🎁', '🏥', '📈'];
const defaultColors = ['#424769', '#ffb17a', '#5b8def', '#1f8a5b', '#b97aff', '#e76b8d', '#3aa3a5', '#d99a2b'];

export function SavingsGoalsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    deadline: '',
    icon: '🏖️',
    color: '#424769',
  });
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
      setForm({ name: '', targetAmount: '', currentAmount: '', deadline: '', icon: '🏖️', color: '#424769' });
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
  const totalTarget = goals?.reduce((sum, g) => sum + g.targetAmount, 0) || 0;
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  return (
    <div className="space-y-5">
      <PageHead
        title="Sparziele"
        sub={`${activeGoals.length} aktive · ${completedGoals.length} erreicht`}
        actions={
          <Btn variant="grad" icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Abbrechen' : 'Neues Ziel'}
          </Btn>
        }
      />

      {/* Hero split */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card variant="hero">
          <div className="relative z-[2]">
            <div className="text-[0.78rem] uppercase tracking-[0.08em] opacity-90">Gesamt gespart</div>
            <div className="h-display mt-1 text-[3rem] leading-[1.05] tnum">
              {formatCurrency(totalSaved)}
            </div>
            <div className="mt-1 text-[0.85rem] opacity-80">
              von {formatCurrency(totalTarget)} Zielbetrag
            </div>
            <div
              className="mt-5 h-2 overflow-hidden rounded-pill"
              style={{ background: 'rgba(255,255,255,.2)' }}
            >
              <div
                className="h-full rounded-pill"
                style={{ width: `${overallPct}%`, background: 'rgba(255,255,255,.9)' }}
              />
            </div>
            <div className="mt-1.5 text-[0.78rem] tnum opacity-90">{overallPct}% erreicht</div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <SmallStat label="Aktive Ziele" value={`${activeGoals.length}`} />
          <SmallStat label="Erreicht" value={`${completedGoals.length}`} />
          <SmallStat
            label="Höchstes Ziel"
            value={
              activeGoals.length
                ? formatCurrency(Math.max(...activeGoals.map((g) => g.targetAmount)))
                : '—'
            }
          />
          <SmallStat label="Restbetrag" value={formatCurrency(Math.max(0, totalTarget - totalSaved))} />
        </div>
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
          <h3 className="mb-4 text-lg font-bold text-ink">Neues Sparziel</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const targetAmount = Number(form.targetAmount);
              if (!targetAmount || targetAmount <= 0) {
                toast.error('Bitte Zielbetrag eingeben');
                return;
              }
              createMutation.mutate({
                name: form.name,
                targetAmount,
                currentAmount: Number(form.currentAmount) || 0,
                deadline: form.deadline || undefined,
                icon: form.icon,
                color: form.color,
              });
            }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="z. B. Urlaub, Auto…"
                required
              />
            </Field>
            <Field label="Zielbetrag" required>
              <input
                type="number"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="input tnum"
                placeholder="3.000"
                min="1"
                step="0.01"
                required
              />
            </Field>
            <Field label="Bereits gespart">
              <input
                type="number"
                value={form.currentAmount}
                onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
                className="input tnum"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Icon">
              <div className="flex flex-wrap gap-1">
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-md border text-lg transition',
                      form.icon === icon
                        ? 'border-peach bg-peach/20'
                        : 'border-line bg-elev hover:bg-soft',
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Farbe">
              <div className="flex flex-wrap gap-1.5">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    aria-label={`Farbe ${c}`}
                    className={cn(
                      'h-9 w-9 rounded-md border-2 transition',
                      form.color === c ? 'border-ink' : 'border-transparent',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Btn type="submit" variant="grad" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sparziel anlegen'}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo" />
        </div>
      ) : goals?.length === 0 ? (
        <Card className="text-center" style={{ padding: '48px 24px' }}>
          <PiggyBank className="mx-auto mb-3 h-10 w-10 text-ink-4" />
          <p className="font-semibold text-ink">Noch keine Sparziele</p>
          <p className="mt-1 text-sm text-ink-3">Setze dir ein Sparziel und verfolge deinen Fortschritt.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeGoals.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  showAddAmount={addAmountId === goal.id}
                  addAmountValue={addAmountValue}
                  onToggleAdd={() => {
                    setAddAmountId(addAmountId === goal.id ? null : goal.id);
                    setAddAmountValue('');
                  }}
                  onAddAmountChange={setAddAmountValue}
                  onAddAmount={(amount) => addAmountMutation.mutate({ id: goal.id, amount })}
                  onDelete={() => {
                    if (confirm('Sparziel wirklich löschen?')) deleteMutation.mutate(goal.id);
                  }}
                  isPending={addAmountMutation.isPending}
                />
              ))}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-2">
                <Check className="h-4 w-4 text-pos" /> Erreichte Ziele
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedGoals.map((goal) => (
                  <Card
                    key={goal.id}
                    variant="soft"
                    className="relative overflow-hidden"
                    style={{ background: 'var(--grad-soft)' }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{goal.icon || '🎯'}</span>
                        <div>
                          <div className="font-semibold text-ink">{goal.name}</div>
                          <div className="text-[0.72rem] text-ink-3">Erfolgreich abgeschlossen</div>
                        </div>
                      </div>
                      <Tag variant="pos">
                        <Check className="h-3 w-3" /> Erreicht
                      </Tag>
                    </div>
                    <div className="tnum text-[1.4rem] font-bold">
                      {formatCurrency(goal.currentAmount)}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <div className="tnum mt-1.5 text-[1.4rem] font-bold">{value}</div>
    </Card>
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
  const color = goal.color || '#424769';

  const monthsRemaining = goal.deadline
    ? Math.max(
        1,
        Math.ceil(
          (new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30),
        ),
      )
    : null;
  const perMonth = monthsRemaining ? goal.remaining / monthsRemaining : null;

  return (
    <Card className="group relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-15"
        style={{ background: color }}
      />
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-10 w-10 place-items-center rounded-md text-xl"
            style={{ background: `${color}1f`, color }}
          >
            {goal.icon || '🎯'}
          </div>
          <div>
            <div className="font-semibold text-ink">{goal.name}</div>
            {goal.deadline && (
              <div className="text-[0.72rem] text-ink-3">
                Bis {new Date(goal.deadline).toLocaleDateString('de-DE')}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
          aria-label="Sparziel löschen"
        >
          <Trash2 className="h-4 w-4 text-ink-3" />
        </button>
      </div>

      <div className="tnum text-[1.6rem] font-bold leading-tight">
        {formatCurrency(goal.currentAmount)}
      </div>
      <div className="text-xs text-ink-3 tnum">von {formatCurrency(goal.targetAmount)}</div>

      <Progress value={percentage} color={color} className="mt-3" thick />

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="tnum font-semibold text-ink-2">{goal.percentage}%</span>
        <span className="tnum text-ink-3">
          Noch {formatCurrency(Math.max(0, goal.remaining))}
        </span>
      </div>

      {perMonth && perMonth > 0 && (
        <div
          className="mt-3 flex items-start gap-2 rounded-md p-3 text-xs"
          style={{ background: 'var(--bg-soft)' }}
        >
          <Lightbulb className="h-4 w-4 shrink-0 text-peach" />
          <span className="text-ink-2">
            <strong className="tnum text-ink">{formatCurrency(perMonth)}/Monat</strong> für{' '}
            <strong>{monthsRemaining} Monate</strong> — und du erreichst dein Ziel.
          </span>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Btn size="sm" variant="grad" icon={Plus} onClick={onToggleAdd}>
          {showAddAmount ? 'Schließen' : 'Einzahlen'}
        </Btn>
      </div>

      {showAddAmount && (
        <div
          className="mt-3 border-t pt-3"
          style={{ borderColor: 'var(--line-2)' }}
        >
          <div className="flex gap-2">
            <input
              type="number"
              value={addAmountValue}
              onChange={(e) => onAddAmountChange(e.target.value)}
              placeholder="Betrag"
              className="input tnum flex-1 text-sm"
              step="0.01"
              autoFocus
            />
            <Btn
              size="sm"
              variant="primary"
              onClick={() => {
                const val = Number(addAmountValue);
                if (!val) return;
                onAddAmount(val);
              }}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              aria-label="Abheben"
              onClick={() => {
                const val = Number(addAmountValue);
                if (!val || val <= 0) return;
                onAddAmount(-val);
              }}
              disabled={isPending}
            >
              <Minus className="h-3.5 w-3.5" />
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
