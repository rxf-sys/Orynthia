import { api } from '@/platform/api/client';
import type { CreateRecipeData, Recipe, RecipeFilters } from './types';

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
