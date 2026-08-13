import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Clock, Heart, Loader2, Plus, Search, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { recipesApi } from '@/features/recipes/api';
import {
  DIETARY,
  DIFFICULTY_LABEL,
  MEAL_TYPES,
  type Recipe,
  type RecipeFilters,
} from '@/features/recipes/types';
import { cn, parseApiError } from '@/lib/utils';
import { Btn, Card, EmptyState, PageHead, Tag } from '@/components/ui';

export function RecipesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<RecipeFilters>({});
  const [searchInput, setSearchInput] = useState('');

  const { data: recipes, isLoading } = useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => recipesApi.getAll(filters).then((r) => r.data),
  });

  const favoriteMutation = useMutation({
    mutationFn: recipesApi.toggleFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Speichern')),
  });

  const createMutation = useMutation({
    mutationFn: recipesApi.create,
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Rezept angelegt');
      navigate(`/recipes/${r.data.id}?edit=1`);
    },
    onError: (e) => toast.error(parseApiError(e, 'Fehler beim Erstellen')),
  });

  const setFilter = <K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div className="space-y-5">
      <PageHead
        title="Rezepte"
        sub={`${recipes?.length ?? 0} Rezept${recipes?.length === 1 ? '' : 'e'}`}
        actions={
          <Btn
            variant="grad"
            icon={Plus}
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate({ title: 'Neues Rezept', servings: 2 })}
          >
            Neues Rezept
          </Btn>
        }
      />

      {/* Suche & Filter */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rezepte durchsuchen…"
              className="input pl-9"
              aria-label="Rezepte durchsuchen"
            />
          </div>
          <Btn type="submit">Suchen</Btn>
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={filters.favorite === true}
            onClick={() => setFilter('favorite', filters.favorite ? undefined : true)}
          >
            <Heart className={cn('h-3 w-3', filters.favorite && 'fill-current')} /> Favoriten
          </FilterChip>
          {MEAL_TYPES.map((m) => (
            <FilterChip
              key={m.value}
              active={filters.mealType === m.value}
              onClick={() => setFilter('mealType', m.value)}
            >
              {m.label}
            </FilterChip>
          ))}
          {DIETARY.slice(0, 3).map((d) => (
            <FilterChip
              key={d.value}
              active={filters.dietary === d.value}
              onClick={() => setFilter('dietary', d.value)}
            >
              {d.label}
            </FilterChip>
          ))}
          <FilterChip
            active={filters.maxTotalMinutes === 30}
            onClick={() => setFilter('maxTotalMinutes', 30)}
          >
            ≤ 30 Min
          </FilterChip>
          {hasFilters && (
            <button
              onClick={() => {
                setFilters({});
                setSearchInput('');
              }}
              className="flex items-center gap-1 rounded-pill px-2.5 py-1.5 text-sm text-ink-3 hover:text-ink"
            >
              <X className="h-3 w-3" /> Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (recipes?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ChefHat}
          title={hasFilters ? 'Keine Treffer' : 'Noch keine Rezepte'}
          description={
            hasFilters
              ? 'Passe die Filter an oder setze sie zurück.'
              : 'Lege dein erstes Rezept an – mit Zutaten, Zubereitung und Portionen. Die Zutaten kannst du später direkt in eine Einkaufsliste übernehmen.'
          }
          action={
            hasFilters
              ? { label: 'Filter zurücksetzen', onClick: () => setFilters({}) }
              : {
                  label: 'Rezept anlegen',
                  onClick: () => createMutation.mutate({ title: 'Neues Rezept', servings: 2 }),
                  icon: Plus,
                }
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes!.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onToggleFavorite={() => favoriteMutation.mutate(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-indigo bg-indigo text-white'
          : 'border-line bg-elev text-ink-2 hover:bg-soft',
      )}
    >
      {children}
    </button>
  );
}

function RecipeCard({ recipe, onToggleFavorite }: { recipe: Recipe; onToggleFavorite: () => void }) {
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  return (
    <Card hover className="flex flex-col overflow-hidden p-0">
      <Link to={`/recipes/${recipe.id}`} className="block">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt=""
            className="h-36 w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          // Bewusst gestalteter Platzhalter statt einer leeren Fläche:
          // diagonale Streifen und eine Beschriftung machen erkennbar,
          // dass hier ein Foto fehlt und nicht etwa etwas kaputt ist.
          <div
            className="relative grid h-36 w-full place-items-center bg-soft"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent 0 10px, color-mix(in oklab, var(--violet) 7%, transparent) 10px 20px)',
            }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <ChefHat className="h-8 w-8 text-ink-4" aria-hidden />
              <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-ink-4">
                Rezeptfoto
              </span>
            </div>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/recipes/${recipe.id}`} className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-ink hover:underline">{recipe.title}</h3>
          </Link>
          <button
            onClick={onToggleFavorite}
            aria-label={recipe.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
            aria-pressed={recipe.isFavorite}
            className="shrink-0 text-ink-3 transition-colors hover:text-peach-press"
          >
            <Heart className={cn('h-4 w-4', recipe.isFavorite && 'fill-peach text-peach')} />
          </button>
        </div>
        {recipe.description && (
          <p className="line-clamp-2 text-xs leading-snug text-ink-3">{recipe.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          {totalMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {totalMinutes} Min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {recipe.servings}
          </span>
          <Tag>{DIFFICULTY_LABEL[recipe.difficulty]}</Tag>
        </div>
      </div>
    </Card>
  );
}
