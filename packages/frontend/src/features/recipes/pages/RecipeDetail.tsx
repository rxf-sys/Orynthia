import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock,
  GripVertical,
  Heart,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { recipesApi } from '@/features/recipes/api';
import { listsApi } from '@/features/lists/api';
import {
  DIETARY,
  DIFFICULTY_LABEL,
  MEAL_TYPES,
  type CreateRecipeData,
  type IngredientInput,
  type RecipeDifficulty,
} from '@/features/recipes/types';
import { LIST_TYPE_ICON } from '@/features/lists/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, Field, IconBtn, Modal, PageHead, Tag, useConfirm } from '@/components/ui';

interface FormState {
  title: string;
  description: string;
  imageUrl: string;
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  difficulty: RecipeDifficulty;
  mealTypes: string[];
  dietary: string[];
  tags: string;
  instructions: string[];
  ingredients: IngredientInput[];
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [form, setForm] = useState<FormState | null>(null);
  const [portions, setPortions] = useState<number | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  // Formular aus dem geladenen Rezept initialisieren
  useEffect(() => {
    if (!recipe) return;
    setPortions((p) => p ?? recipe.servings);
    setForm({
      title: recipe.title,
      description: recipe.description ?? '',
      imageUrl: recipe.imageUrl ?? '',
      prepMinutes: String(recipe.prepMinutes),
      cookMinutes: String(recipe.cookMinutes),
      servings: String(recipe.servings),
      difficulty: recipe.difficulty,
      mealTypes: recipe.mealTypes,
      dietary: recipe.dietary,
      tags: recipe.tags.join(', '),
      instructions: recipe.instructions.length ? recipe.instructions : [''],
      ingredients: recipe.ingredients.length
        ? recipe.ingredients.map((i) => ({
            name: i.name,
            amount: i.amount != null ? Number(i.amount) : undefined,
            unit: i.unit ?? undefined,
          }))
        : [{ name: '' }],
    });
  }, [recipe]);

  useEffect(() => {
    if (searchParams.get('edit') === '1') setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateRecipeData> & { isFavorite?: boolean }) =>
      recipesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setEditing(false);
      toast.success('Rezept gespeichert');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const favoriteMutation = useMutation({
    mutationFn: () => recipesApi.toggleFavorite(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => recipesApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Rezept gelöscht');
      navigate('/recipes');
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Löschen')),
  });

  // Zutatenmengen auf die gewählte Portionszahl umrechnen (nur Anzeige)
  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    const factor = portions && recipe.servings > 0 ? portions / recipe.servings : 1;
    return recipe.ingredients.map((ing) => ({
      ...ing,
      scaledAmount:
        ing.amount != null ? Math.round(Number(ing.amount) * factor * 100) / 100 : null,
    }));
  }, [recipe, portions]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    updateMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      prepMinutes: parseInt(form.prepMinutes, 10) || 0,
      cookMinutes: parseInt(form.cookMinutes, 10) || 0,
      servings: parseInt(form.servings, 10) || 1,
      difficulty: form.difficulty,
      mealTypes: form.mealTypes,
      dietary: form.dietary,
      tags: form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      instructions: form.instructions.map((i) => i.trim()).filter(Boolean),
      ingredients: form.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), amount: i.amount, unit: i.unit?.trim() || undefined })),
    });
  };

  if (isLoading || !recipe || !form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
      </div>
    );
  }

  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <div className="space-y-5">
      <Link
        to="/recipes"
        className="inline-flex items-center gap-1 text-sm text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Alle Rezepte
      </Link>

      <PageHead
        title={recipe.title}
        sub={[
          totalMinutes > 0 ? `${totalMinutes} Min gesamt` : null,
          `${recipe.servings} Portionen`,
          DIFFICULTY_LABEL[recipe.difficulty],
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <IconBtn
              variant="quiet"
              icon={Heart}
              aria-label={recipe.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
              className={cn(recipe.isFavorite && 'text-peach')}
              onClick={() => favoriteMutation.mutate()}
            />
            {recipe.ingredients.length > 0 && (
              <Btn icon={ShoppingCart} onClick={() => setShoppingOpen(true)}>
                In Einkaufsliste
              </Btn>
            )}
            <Btn
              variant={editing ? 'ghost' : 'grad'}
              icon={editing ? undefined : Pencil}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Abbrechen' : 'Bearbeiten'}
            </Btn>
          </div>
        }
      />

      {editing ? (
        <RecipeEditor
          form={form}
          setForm={setForm}
          onSubmit={submit}
          saving={updateMutation.isPending}
          onDelete={async () => {
            const ok = await confirm({
              title: 'Rezept löschen?',
              description: recipe.title,
              confirmLabel: 'Löschen',
              destructive: true,
            });
            if (ok) deleteMutation.mutate();
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Zutaten mit Portionsrechner */}
          <div className="space-y-4">
            {recipe.imageUrl && (
              <img
                src={recipe.imageUrl}
                alt=""
                className="h-48 w-full rounded-lg object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-ink">Zutaten</h2>
                <div className="flex items-center gap-1.5">
                  <IconBtn
                    variant="quiet"
                    size="sm"
                    icon={Minus}
                    aria-label="Weniger Portionen"
                    disabled={(portions ?? 1) <= 1}
                    onClick={() => setPortions((p) => Math.max(1, (p ?? recipe.servings) - 1))}
                  />
                  <span className="tnum flex items-center gap-1 text-sm font-semibold text-ink">
                    <Users className="h-3.5 w-3.5 text-ink-3" />
                    {portions ?? recipe.servings}
                  </span>
                  <IconBtn
                    variant="quiet"
                    size="sm"
                    icon={Plus}
                    aria-label="Mehr Portionen"
                    onClick={() => setPortions((p) => Math.min(100, (p ?? recipe.servings) + 1))}
                  />
                </div>
              </div>
              {recipe.ingredients.length === 0 ? (
                <p className="text-sm text-ink-3">Noch keine Zutaten erfasst.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {scaledIngredients.map((ing) => (
                    <li key={ing.id} className="flex items-baseline gap-2 py-2 text-sm">
                      <span className="tnum shrink-0 font-semibold text-ink">
                        {ing.scaledAmount != null ? ing.scaledAmount : ''} {ing.unit ?? ''}
                      </span>
                      <span className="text-ink-2">{ing.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {(recipe.mealTypes.length > 0 || recipe.dietary.length > 0 || recipe.tags.length > 0) && (
              <Card>
                <div className="flex flex-wrap gap-1.5">
                  {recipe.mealTypes.map((m) => (
                    <Tag key={m}>{MEAL_TYPES.find((x) => x.value === m)?.label ?? m}</Tag>
                  ))}
                  {recipe.dietary.map((d) => (
                    <Tag key={d} variant="pos">
                      {DIETARY.find((x) => x.value === d)?.label ?? d}
                    </Tag>
                  ))}
                  {recipe.tags.map((t) => (
                    <Tag key={t}>#{t}</Tag>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Zubereitung */}
          <Card>
            <h2 className="mb-3 text-sm font-bold text-ink">Zubereitung</h2>
            {recipe.description && (
              <p className="mb-4 text-sm leading-relaxed text-ink-2">{recipe.description}</p>
            )}
            {recipe.instructions.length === 0 ? (
              <p className="text-sm text-ink-3">Noch keine Zubereitungsschritte erfasst.</p>
            ) : (
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-soft text-xs font-bold text-indigo">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
            {(recipe.prepMinutes > 0 || recipe.cookMinutes > 0) && (
              <div className="mt-4 flex gap-4 border-t border-line pt-3 text-xs text-ink-3">
                {recipe.prepMinutes > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Vorbereitung {recipe.prepMinutes} Min
                  </span>
                )}
                {recipe.cookMinutes > 0 && (
                  <span className="flex items-center gap-1">
                    <ChefHat className="h-3 w-3" /> Kochen {recipe.cookMinutes} Min
                  </span>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      <AddToListModal
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        defaultServings={portions ?? recipe.servings}
      />
    </div>
  );
}

// ---------- Editor ----------

function RecipeEditor({
  form,
  setForm,
  onSubmit,
  saving,
  onDelete,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  onDelete: () => void;
}) {
  const toggleArray = (key: 'mealTypes' | 'dietary', value: string) => {
    const current = form[key];
    setForm({
      ...form,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  const setIngredient = (index: number, patch: Partial<IngredientInput>) => {
    const next = [...form.ingredients];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, ingredients: next });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="Titel" required>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            required
          />
        </Field>
        <Field label="Kurzbeschreibung">
          <textarea
            className="input min-h-[70px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={2000}
          />
        </Field>
        <Field label="Bild-URL" hint="Optional – Bilder werden verlinkt, nicht hochgeladen">
          <input
            className="input"
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Vorbereitung (Min)">
            <input
              className="input"
              type="number"
              min={0}
              max={1440}
              value={form.prepMinutes}
              onChange={(e) => setForm({ ...form, prepMinutes: e.target.value })}
            />
          </Field>
          <Field label="Kochen (Min)">
            <input
              className="input"
              type="number"
              min={0}
              max={1440}
              value={form.cookMinutes}
              onChange={(e) => setForm({ ...form, cookMinutes: e.target.value })}
            />
          </Field>
          <Field label="Portionen">
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={form.servings}
              onChange={(e) => setForm({ ...form, servings: e.target.value })}
            />
          </Field>
          <Field label="Schwierigkeit">
            <select
              className="select"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as RecipeDifficulty })}
            >
              {(Object.keys(DIFFICULTY_LABEL) as RecipeDifficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Mahlzeit">
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map((m) => (
              <ToggleChip
                key={m.value}
                active={form.mealTypes.includes(m.value)}
                onClick={() => toggleArray('mealTypes', m.value)}
              >
                {m.label}
              </ToggleChip>
            ))}
          </div>
        </Field>
        <Field label="Ernährung">
          <div className="flex flex-wrap gap-1.5">
            {DIETARY.map((d) => (
              <ToggleChip
                key={d.value}
                active={form.dietary.includes(d.value)}
                onClick={() => toggleArray('dietary', d.value)}
              >
                {d.label}
              </ToggleChip>
            ))}
          </div>
        </Field>
        <Field label="Tags" hint="Kommagetrennt, z. B. schnell, familienessen">
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </Field>
      </Card>

      {/* Zutaten */}
      <Card>
        <h2 className="mb-3 text-sm font-bold text-ink">Zutaten</h2>
        <div className="space-y-2">
          {form.ingredients.map((ing, i) => (
            <div key={i} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-ink-4" aria-hidden />
              <input
                className="input w-20"
                type="number"
                step="any"
                min={0}
                placeholder="Menge"
                aria-label={`Menge Zutat ${i + 1}`}
                value={ing.amount ?? ''}
                onChange={(e) =>
                  setIngredient(i, {
                    amount: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
              <input
                className="input w-24"
                placeholder="Einheit"
                aria-label={`Einheit Zutat ${i + 1}`}
                value={ing.unit ?? ''}
                onChange={(e) => setIngredient(i, { unit: e.target.value })}
                maxLength={30}
              />
              <input
                className="input flex-1"
                placeholder="Zutat"
                aria-label={`Name Zutat ${i + 1}`}
                value={ing.name}
                onChange={(e) => setIngredient(i, { name: e.target.value })}
                maxLength={200}
              />
              <IconBtn
                type="button"
                variant="quiet"
                size="sm"
                icon={Trash2}
                aria-label={`Zutat ${i + 1} entfernen`}
                onClick={() =>
                  setForm({ ...form, ingredients: form.ingredients.filter((_, idx) => idx !== i) })
                }
              />
            </div>
          ))}
        </div>
        <Btn
          type="button"
          variant="ghost"
          size="sm"
          icon={Plus}
          className="mt-3"
          onClick={() => setForm({ ...form, ingredients: [...form.ingredients, { name: '' }] })}
        >
          Zutat hinzufügen
        </Btn>
      </Card>

      {/* Zubereitung */}
      <Card>
        <h2 className="mb-3 text-sm font-bold text-ink">Zubereitung</h2>
        <div className="space-y-2">
          {form.instructions.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-soft text-xs font-bold text-indigo">
                {i + 1}
              </span>
              <textarea
                className="input min-h-[54px] flex-1"
                value={step}
                aria-label={`Schritt ${i + 1}`}
                onChange={(e) => {
                  const next = [...form.instructions];
                  next[i] = e.target.value;
                  setForm({ ...form, instructions: next });
                }}
                maxLength={2000}
              />
              <IconBtn
                type="button"
                variant="quiet"
                size="sm"
                icon={Trash2}
                aria-label={`Schritt ${i + 1} entfernen`}
                onClick={() =>
                  setForm({ ...form, instructions: form.instructions.filter((_, idx) => idx !== i) })
                }
              />
            </div>
          ))}
        </div>
        <Btn
          type="button"
          variant="ghost"
          size="sm"
          icon={Plus}
          className="mt-3"
          onClick={() => setForm({ ...form, instructions: [...form.instructions, ''] })}
        >
          Schritt hinzufügen
        </Btn>
      </Card>

      <div className="flex items-center gap-2">
        <Btn type="submit" variant="grad" icon={Check} disabled={saving || !form.title.trim()}>
          Speichern
        </Btn>
        <Btn type="button" variant="danger" icon={Trash2} onClick={onDelete}>
          Rezept löschen
        </Btn>
      </div>
    </form>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-indigo bg-indigo text-white' : 'border-line bg-elev text-ink-2 hover:bg-soft',
      )}
    >
      {children}
    </button>
  );
}

// ---------- Cross-Module: In Einkaufsliste übernehmen ----------

function AddToListModal({
  open,
  onClose,
  recipeId,
  recipeTitle,
  defaultServings,
}: {
  open: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  defaultServings: number;
}) {
  const queryClient = useQueryClient();
  const [listId, setListId] = useState('');
  const [servings, setServings] = useState(defaultServings);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    if (open) setServings(defaultServings);
  }, [open, defaultServings]);

  const { data: lists } = useQuery({
    queryKey: ['lists'],
    queryFn: () => listsApi.getAll().then((r) => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (!listId && lists?.length) {
      setListId(lists.find((l) => l.type === 'SHOPPING')?.id ?? lists[0].id);
    }
  }, [lists, listId]);

  const addMutation = useMutation({
    mutationFn: async () => {
      let targetId = listId;
      // Ohne vorhandene Liste direkt eine neue Einkaufsliste anlegen
      if (!targetId) {
        const created = await listsApi.create({
          name: newListName.trim() || 'Einkaufsliste',
          type: 'SHOPPING',
        });
        targetId = created.data.id;
      }
      return listsApi.addFromRecipe(targetId, { recipeId, servings });
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list'] });
      const { added, updated } = r.data;
      toast.success(
        `${added} Zutat${added === 1 ? '' : 'en'} übernommen` +
          (updated > 0 ? `, ${updated} zusammengeführt` : ''),
      );
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e, 'Übernahme fehlgeschlagen')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Zutaten in Einkaufsliste"
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
          Zutaten von „{recipeTitle}" werden übernommen. Bereits vorhandene Einträge mit gleicher
          Einheit werden zusammengeführt.
        </p>
        <Field label="Portionen" hint="Die Mengen werden entsprechend skaliert">
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            value={servings}
            onChange={(e) => setServings(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </Field>
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
              placeholder="Einkaufsliste"
              maxLength={100}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
