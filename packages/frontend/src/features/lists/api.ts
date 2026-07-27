import { api } from '@/platform/api/client';
import type { CreateListData, ListItem, ShoppingList } from './types';

export const listsApi = {
  getAll: () => api.get<ShoppingList[]>('/lists'),
  getById: (id: string) => api.get<ShoppingList>(`/lists/${id}`),
  create: (data: CreateListData) => api.post<ShoppingList>('/lists', data),
  update: (id: string, data: Partial<CreateListData>) => api.patch<ShoppingList>(`/lists/${id}`, data),
  remove: (id: string) => api.delete(`/lists/${id}`),

  addItem: (listId: string, data: { name: string; amount?: number; unit?: string }) =>
    api.post<ListItem>(`/lists/${listId}/items`, data),
  updateItem: (
    itemId: string,
    data: { name?: string; amount?: number | null; unit?: string | null; checked?: boolean },
  ) => api.patch<ListItem>(`/lists/items/${itemId}`, data),
  removeItem: (itemId: string) => api.delete(`/lists/items/${itemId}`),
  clearChecked: (listId: string) => api.delete<{ removed: number }>(`/lists/${listId}/checked`),

  /** Cross-Module: Zutaten eines Rezepts übernehmen (mit Portions-Skalierung). */
  addFromRecipe: (
    listId: string,
    data: { recipeId: string; servings?: number; ingredientIds?: string[] },
  ) =>
    api.post<{ added: number; updated: number; recipeTitle: string; servings: number }>(
      `/lists/${listId}/from-recipe`,
      data,
    ),
};
