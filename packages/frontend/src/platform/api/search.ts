import { api } from './client';

export interface SearchHit {
  module: 'tasks' | 'calendar' | 'recipes' | 'lists' | 'notes' | 'trips';
  id: string;
  title: string;
  subtitle?: string;
  to: string;
}

export const searchApi = {
  query: (q: string) => api.get<SearchHit[]>('/search', { params: { q } }),
};
