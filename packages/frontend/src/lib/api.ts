import axios from 'axios';
import type {
  BankAccount,
  Budget,
  Category,
  CreateAccountData,
  CreateBudgetData,
  CreateTransactionData,
  DashboardData,
  MonthlyOverview,
  PaginatedResult,
  Transaction,
  TransactionFilters,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // httpOnly Cookies automatisch mitsenden
});

// Response Interceptor: Token Refresh bei 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// --- API Functions ---

export const authApi = {
  login: (data: { email: string; password: string; twoFactorCode?: string }) =>
    api.post('/auth/login', data),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  generate2FA: () => api.get('/auth/2fa/generate'),
  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),
};

export const dashboardApi = {
  getData: () => api.get<DashboardData>('/dashboard'),
};

export const accountsApi = {
  getAll: () => api.get<BankAccount[]>('/accounts'),
  getBalance: () => api.get<{ totalBalance: number; currency: string; accountCount: number }>('/accounts/balance'),
  create: (data: CreateAccountData) => api.post<BankAccount>('/accounts', data),
  update: (id: string, data: Partial<CreateAccountData>) => api.patch<BankAccount>(`/accounts/${id}`, data),
  remove: (id: string) => api.delete(`/accounts/${id}`),
};

export const transactionsApi = {
  getAll: (params?: TransactionFilters) => api.get<PaginatedResult<Transaction>>('/transactions', { params }),
  getById: (id: string) => api.get<Transaction>(`/transactions/${id}`),
  create: (data: CreateTransactionData) => api.post<Transaction>('/transactions', data),
  update: (id: string, data: Partial<CreateTransactionData>) => api.patch<Transaction>(`/transactions/${id}`, data),
  remove: (id: string) => api.delete(`/transactions/${id}`),
  getExpensesByCategory: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/transactions/expenses-by-category', { params }),
  getMonthlyOverview: (months?: number) =>
    api.get<MonthlyOverview[]>('/transactions/monthly-overview', { params: { months } }),
};

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/categories'),
  create: (data: { name: string; icon?: string; color?: string; keywords?: string[] }) =>
    api.post<Category>('/categories', data),
  update: (id: string, data: { name?: string; icon?: string; color?: string; keywords?: string[] }) =>
    api.patch<Category>(`/categories/${id}`, data),
  remove: (id: string) => api.delete(`/categories/${id}`),
};

export const bankingApi = {
  getInstitutions: (country: string = 'DE') => api.get<{ id: string; name: string; bic?: string; logo?: string }[]>(`/banking/institutions?country=${country}`),
  connectBank: (institutionId: string) => api.post<{ connectionId: string; authUrl: string }>('/banking/connect', { institutionId }),
  handleCallback: (connectionId: string, code?: string) => api.post(`/banking/callback/${connectionId}`, { code }),
  syncAccount: (accountId: string, dateFrom?: string) => api.post(`/banking/sync/${accountId}`, { dateFrom }),
  syncAll: () => api.post('/banking/sync-all'),
  getConnections: () => api.get('/banking/connections'),
  removeConnection: (connectionId: string) => api.delete(`/banking/connections/${connectionId}`),
};

export const budgetsApi = {
  getAll: () => api.get<Budget[]>('/budgets'),
  create: (data: CreateBudgetData) => api.post<Budget>('/budgets', data),
  update: (id: string, data: Partial<CreateBudgetData>) => api.patch<Budget>(`/budgets/${id}`, data),
  remove: (id: string) => api.delete(`/budgets/${id}`),
};
