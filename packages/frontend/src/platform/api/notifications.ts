import { api } from './client';

export type NotificationType =
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'LARGE_TRANSACTION'
  | 'RECURRING_DETECTED'
  | 'SAVINGS_MILESTONE'
  | 'SYNC_ERROR'
  | 'TASK_DUE'
  | 'EVENT_REMINDER'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export const notificationsApi = {
  list: (opts: { unread?: boolean; limit?: number } = {}) =>
    api.get<Notification[]>('/notifications', {
      params: { ...(opts.unread ? { unread: 'true' } : {}), ...(opts.limit ? { limit: opts.limit } : {}) },
    }),
  count: () => api.get<{ count: number }>('/notifications/count'),
  markAsRead: (id: string) => api.post<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () => api.post<{ updated: number }>('/notifications/read-all'),
  remove: (id: string) => api.delete(`/notifications/${id}`),
};
