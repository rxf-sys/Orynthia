import { create } from 'zustand';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  twoFactorEnabled?: boolean;
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password, twoFactorCode) => {
    await authApi.login({ email, password, twoFactorCode });
    // Cookies werden automatisch vom Browser gesetzt
    const { data: user } = await authApi.me();
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (email, password, firstName, lastName) => {
    await authApi.register({ email, password, firstName, lastName });
    const { data: user } = await authApi.me();
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    try {
      const { data: user } = await authApi.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
