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
});

// Request Interceptor: JWT Token hinzufügen
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Token Refresh bei 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
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

export const budgetsApi = {
  getAll: () => api.get<Budget[]>('/budgets'),
  create: (data: CreateBudgetData) => api.post<Budget>('/budgets', data),
  update: (id: string, data: Partial<CreateBudgetData>) => api.patch<Budget>(`/budgets/${id}`, data),
  remove: (id: string) => api.delete(`/budgets/${id}`),
};
