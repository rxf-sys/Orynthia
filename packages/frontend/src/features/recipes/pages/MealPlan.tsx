import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addWeeks, eachDayOfInterval, format, isToday, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { mealPlanApi, recipesApi } from '@/features/recipes/api';
import { MEAL_SLOTS, type MealPlanEntry, type MealSlot } from '@/features/recipes/types';
import { listsApi } from '@/features/lists/api';
import { useMealFlow } from '@/stores/flowStore';
import { LIST_TYPE_ICON } from '@/features/lists/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, Field, Modal, PageHead, useConfirm } from '@/components/ui';

export function MealPlanPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [addFor, setAddFor] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
    [weekStart],
  );
  const from = format(weekStart, 'yyyy-MM-dd');
  const to = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['meal-plan', from, to],
    queryFn: () => mealPlanApi.getRange(from, to).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meal-plan'] });

  const removeMutation = useMutation({
    mutationFn: mealPlanApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Aus dem Plan entfernt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Entfernen')),
  });

  const byDayAndSlot = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>();
    for (const entry of entries ?? []) {
      const key = `${entry.date.slice(0, 10)}|${entry.slot}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return map;
  }, [entries]);

  const plannedRecipes = (entries ?? []).filter((e) => e.recipeId).length;

  return (
    <div className="space-y-5">
      <PageHead
        title="Wochenplan"
        sub={`${format(weekStart, 'd. MMM', { locale: de })} – ${format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: de })} · ${plannedRecipes} Rezept${plannedRecipes === 1 ? '' : 'e'} geplant`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/recipes"
              className="text-sm font-semibold text-indigo hover:underline"
            >
              Zu den Rezepten
            </Link>
            <Btn
              variant="grad"
              icon={ShoppingCart}
              disabled={plannedRecipes === 0}
              onClick={() => setShoppingOpen(true)}
            >
              Einkaufsliste erzeugen
            </Btn>
          </div>
        }
      />

      <div className="flex items-center gap-1">
        <Btn
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          aria-label="Vorherige Woche"
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
        />
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Diese Woche
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          icon={ChevronRight}
          aria-label="Nächste Woche"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            return (
              <Card key={dayKey} className={cn('p-3', isToday(day) && 'ring-1 ring-indigo')}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[0.72rem] font-bold uppercase text-ink-3">
                    {format(day, 'EEE', { locale: de })}
                  </span>
                  <span
                    className={cn('tnum text-sm font-semibold', isToday(day) ? 'text-indigo' : 'text-ink-2')}
                  >
                    {format(day, 'd.M.')}
                  </span>
                </div>
                <div className="space-y-2">
                  {MEAL_SLOTS.map((slot) => {
                    const items = byDayAndSlot.get(`${dayKey}|${slot.value}`) ?? [];
                    if (items.length === 0 && slot.value === 'SNACK') return null;
                    return (
                      <div key={slot.value}>
                        <div className="mb-0.5 text-[0.65rem] font-semibold uppercase text-ink-4">
                          {slot.label}
                        </div>
                        {items.map((entry) => (
                          <div
                            key={entry.id}
                            className="group mb-1 flex items-start gap-1 rounded-md bg-soft px-2 py-1.5"
                          >
                            <div className="min-w-0 flex-1">
                              {entry.recipe ? (
                                <Link
                                  to={`/recipes/${entry.recipe.id}`}
                                  className="block truncate text-xs font-medium text-ink hover:underline"
                                >
                                  {entry.recipe.title}
                                </Link>
                              ) : (
                                <span className="block truncate text-xs font-medium text-ink-2">
                                  {entry.title}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-[0.65rem] text-ink-3">
                                <Users className="h-2.5 w-2.5" />
                                {entry.servings}
                              </span>
                            </div>
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Aus dem Plan entfernen?',
                                  description: entry.recipe?.title ?? entry.title ?? '',
                                  confirmLabel: 'Entfernen',
                                  destructive: true,
                                });
                                if (ok) removeMutation.mutate(entry.id);
                              }}
                              aria-label="Aus dem Plan entfernen"
                              className="shrink-0 text-ink-4 opacity-0 transition-opacity hover:text-neg focus:opacity-100 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setAddFor({ date: day, slot: slot.value })}
                          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-line py-1 text-[0.68rem] text-ink-3 transition-colors hover:border-indigo hover:text-indigo"
                        >
                          <Plus className="h-3 w-3" /> Planen
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddMealModal
        open={!!addFor}
        onClose={() => setAddFor(null)}
        date={addFor?.date ?? new Date()}
        slot={addFor?.slot ?? 'DINNER'}
        onAdded={invalidate}
      />

      <MealPlanToListModal
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        from={from}
        to={to}
      />
    </div>
  );
}

function AddMealModal({
  open,
  onClose,
  date,
  slot,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  date: Date;
  slot: MealSlot;
  onAdded: () => void;
}) {
  const [recipeId, setRecipeId] = useState('');
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState<number | ''>('');

  const { data: recipes } = useQuery({
    queryKey: ['recipes', {}],
    queryFn: () => recipesApi.getAll().then((r) => r.data),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: mealPlanApi.create,
    onSuccess: () => {
      onAdded();
      setRecipeId('');
      setTitle('');
      setServings('');
      onClose();
      toast.success('Zum Wochenplan hinzugefügt');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Planen')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeId && !title.trim()) return;
    createMutation.mutate({
      date: format(date, 'yyyy-MM-dd'),
      slot,
      recipeId: recipeId || undefined,
      title: recipeId ? undefined : title.trim(),
      servings: servings === '' ? undefined : Number(servings),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${MEAL_SLOTS.find((s) => s.value === slot)?.label} am ${format(date, 'EEEE, d. MMMM', { locale: de })}`}
      size="sm"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Abbrechen
          </Btn>
          <Btn
            variant="grad"
            icon={Check}
            type="submit"
            form="meal-form"
            disabled={createMutation.isPending || (!recipeId && !title.trim())}
          >
            Planen
          </Btn>
        </>
      }
    >
      <form id="meal-form" onSubmit={submit} className="space-y-4">
        <Field label="Rezept">
          <select
            className="select"
            value={recipeId}
            onChange={(e) => {
              setRecipeId(e.target.value);
              if (e.target.value) setTitle('');
            }}
          >
            <option value="">– Kein Rezept –</option>
            {recipes?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        {!recipeId && (
          <Field label="Stattdessen Freitext" hint={'z. B. „Reste“ oder „Essen gehen“'}>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </Field>
        )}
        <Field label="Portionen" hint="Leer = Portionen aus dem Rezept">
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            value={servings}
            onChange={(e) => setServings(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </Field>
      </form>
    </Modal>
  );
}

function MealPlanToListModal({
  open,
  onClose,
  from,
  to,
}: {
  open: boolean;
  onClose: () => void;
  from: string;
  to: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startFlow = useMealFlow((s) => s.startFromMealPlan);
  const [listId, setListId] = useState('');
  const [newListName, setNewListName] = useState('');

  const { data: lists } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listsApi.getAll().then((r) => r.data),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      let targetId = listId || lists?.find((l) => l.type === 'SHOPPING')?.id || lists?.[0]?.id;
      let targetName = lists?.find((l) => l.id === targetId)?.name ?? '';
      if (!targetId) {
        const created = await listsApi.create({
          name: newListName.trim() || 'Wocheneinkauf',
          type: 'SHOPPING',
        });
        targetId = created.data.id;
        targetName = created.data.name;
      }
      const res = await mealPlanApi.addRangeToList({ listId: targetId, from, to });
      return { ...res.data, listId: targetId, listName: targetName };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list'] });
      // Der Fortschritt wird Zustand, kein Toast: die Liste zeigt gleich,
      // was übernommen wurde, und bietet den nächsten Schritt an.
      startFlow({
        listId: r.listId,
        listName: r.listName,
        added: r.added,
        merged: r.updated,
        meals: r.meals,
      });
      onClose();
      navigate(`/lists/${r.listId}`);
    },
    onError: (e) => toast.error(parseApiError(e, 'Übernahme fehlgeschlagen')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Einkaufsliste aus Wochenplan"
      size="sm"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Abbrechen
          </Btn>
          <Btn
            variant="grad"
            icon={ShoppingCart}
            disabled={addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            Übernehmen
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          Die Zutaten aller in dieser Woche geplanten Rezepte werden auf die jeweils geplanten
          Portionen skaliert und zusammengeführt in eine Liste übernommen.
        </p>
        {lists && lists.length > 0 ? (
          <Field label="Ziel-Liste">
            <select className="select" value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.icon ?? LIST_TYPE_ICON[l.type]} {l.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Neue Liste" hint="Du hast noch keine Liste – wir legen eine an">
            <input
              className="input"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Wocheneinkauf"
              maxLength={100}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
