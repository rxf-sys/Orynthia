import { api } from '@/platform/api/client';
import type { CreateTaskData, Task, TaskList, TasksSummary, UpdateTaskData } from './types';

export const tasksApi = {
  getAll: (params?: {
    status?: 'open' | 'completed' | 'all';
    taskListId?: string;
    dueBefore?: string;
    dueAfter?: string;
  }) =>
    api.get<Task[]>('/tasks', { params }),
  getSummary: () => api.get<TasksSummary>('/tasks/summary'),
  create: (data: CreateTaskData) => api.post<Task>('/tasks', data),
  update: (id: string, data: UpdateTaskData) => api.patch<Task>(`/tasks/${id}`, data),
  remove: (id: string) => api.delete(`/tasks/${id}`),

  getLists: () => api.get<TaskList[]>('/tasks/lists'),
  createList: (data: { name: string; color?: string }) => api.post<TaskList>('/tasks/lists', data),
  updateList: (id: string, data: { name?: string; color?: string }) =>
    api.patch<TaskList>(`/tasks/lists/${id}`, data),
  removeList: (id: string) => api.delete(`/tasks/lists/${id}`),
};
