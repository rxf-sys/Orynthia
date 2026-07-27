export type RecipeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface RecipeIngredient {
  id: string;
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  sortOrder: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  mealTypes: string[];
  dietary: string[];
  tags: string[];
  instructions: string[];
  isFavorite: boolean;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface IngredientInput {
  name: string;
  amount?: number;
  unit?: string;
}

export interface CreateRecipeData {
  title: string;
  description?: string;
  imageUrl?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  servings?: number;
  difficulty?: RecipeDifficulty;
  mealTypes?: string[];
  dietary?: string[];
  tags?: string[];
  instructions?: string[];
  ingredients?: IngredientInput[];
}

export interface RecipeFilters {
  search?: string;
  mealType?: string;
  dietary?: string;
  difficulty?: string;
  favorite?: boolean;
  maxTotalMinutes?: number;
}

export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
] as const;

export const DIETARY = [
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Glutenfrei' },
  { value: 'lactose-free', label: 'Laktosefrei' },
  { value: 'low-carb', label: 'Low Carb' },
] as const;

export const DIFFICULTY_LABEL: Record<RecipeDifficulty, string> = {
  EASY: 'Einfach',
  MEDIUM: 'Mittel',
  HARD: 'Anspruchsvoll',
};

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export const MEAL_SLOTS: Array<{ value: MealSlot; label: string }> = [
  { value: 'BREAKFAST', label: 'Frühstück' },
  { value: 'LUNCH', label: 'Mittag' },
  { value: 'DINNER', label: 'Abend' },
  { value: 'SNACK', label: 'Snack' },
];

export interface MealPlanEntry {
  id: string;
  recipeId?: string | null;
  title?: string | null;
  date: string;
  slot: MealSlot;
  servings: number;
  note?: string | null;
  recipe?: { id: string; title: string; imageUrl?: string | null; servings: number } | null;
}

export interface CreateMealPlanEntryData {
  recipeId?: string;
  title?: string;
  date: string;
  slot?: MealSlot;
  servings?: number;
  note?: string;
}
