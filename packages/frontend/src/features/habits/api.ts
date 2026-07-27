import { api } from '@/platform/api/client';
import type { CreateHabitData, Habit, HabitSummary } from './types';

export const habitsApi = {
  getAll: (params?: { includeArchived?: boolean }) =>
    api.get<Habit[]>('/habits', {
      params: params?.includeArchived ? { includeArchived: 'true' } : undefined,
    }),
  getSummary: () => api.get<HabitSummary>('/habits/summary'),
  create: (data: CreateHabitData) => api.post<Habit>('/habits', data),
  update: (id: string, data: Partial<CreateHabitData> & { isArchived?: boolean }) =>
    api.patch<Habit>(`/habits/${id}`, data),
  /** Tag abhaken bzw. Haken entfernen; ohne Datum gilt heute. */
  toggle: (id: string, date?: string) =>
    api.post<{ done: boolean; date: string }>(`/habits/${id}/toggle`, date ? { date } : {}),
  remove: (id: string) => api.delete(`/habits/${id}`),
};
