import { api } from '@/platform/api/client';

export interface DashboardLayout {
  hidden: string[];
  order: string[];
}

export const homeApi = {
  getLayout: () => api.get<DashboardLayout>('/users/dashboard-layout'),
  updateLayout: (layout: Partial<DashboardLayout>) =>
    api.patch<DashboardLayout>('/users/dashboard-layout', layout),
};
