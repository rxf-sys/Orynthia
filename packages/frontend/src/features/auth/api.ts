import { api } from '@/platform/api/client';

export const authApi = {
  login: (data: { email: string; password: string; twoFactorCode?: string }) =>
    api.post('/auth/login', data),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  sessions: () =>
    api.get<Array<{ id: string; userAgent: string | null; createdAt: string; lastUsedAt: string; current: boolean }>>(
      '/auth/sessions',
    ),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
  me: () => api.get('/auth/me'),
  generate2FA: () => api.get('/auth/2fa/generate'),
  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),
};
