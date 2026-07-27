import { api } from '@/platform/api/client';
import type {
  CreateMealPlanEntryData,
  CreateRecipeData,
  MealPlanEntry,
  Recipe,
  RecipeFilters,
} from './types';

export const recipesApi = {
  getAll: (filters?: RecipeFilters) =>
    api.get<Recipe[]>('/recipes', {
      params: {
        ...filters,
        favorite: filters?.favorite ? 'true' : undefined,
      },
    }),
  getById: (id: string) => api.get<Recipe>(`/recipes/${id}`),
  create: (data: CreateRecipeData) => api.post<Recipe>('/recipes', data),
  update: (id: string, data: Partial<CreateRecipeData> & { isFavorite?: boolean }) =>
    api.patch<Recipe>(`/recipes/${id}`, data),
  toggleFavorite: (id: string) => api.post<Recipe>(`/recipes/${id}/favorite`),
  remove: (id: string) => api.delete(`/recipes/${id}`),
};

export const mealPlanApi = {
  getRange: (from: string, to: string) =>
    api.get<MealPlanEntry[]>('/meal-plan', { params: { from, to } }),
  create: (data: CreateMealPlanEntryData) => api.post<MealPlanEntry>('/meal-plan', data),
  update: (id: string, data: { date?: string; slot?: string; servings?: number; note?: string }) =>
    api.patch<MealPlanEntry>(`/meal-plan/${id}`, data),
  remove: (id: string) => api.delete(`/meal-plan/${id}`),
  /** Zutaten aller geplanten Mahlzeiten eines Zeitraums in eine Liste übernehmen. */
  addRangeToList: (data: { listId: string; from: string; to: string }) =>
    api.post<{ added: number; updated: number; meals: number }>('/meal-plan/to-list', data),
};
