import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
}));

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const mockedAuthApi = vi.mocked(authApi);

const testUser = {
  id: 'u1',
  email: 'test@example.com',
  firstName: 'Max',
  lastName: 'Mustermann',
  isActive: true,
};

function resetStore() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
}

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('checkAuth', () => {
    it('setzt den User bei gültiger Session', async () => {
      mockedAuthApi.me.mockResolvedValue({ data: testUser } as never);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user?.email).toBe('test@example.com');
    });

    it('setzt den State sauber zurück, wenn keine Session existiert', async () => {
      mockedAuthApi.me.mockRejectedValue(new Error('401') as never);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('login', () => {
    it('authentifiziert und lädt das Profil', async () => {
      mockedAuthApi.login.mockResolvedValue({} as never);
      mockedAuthApi.me.mockResolvedValue({ data: testUser } as never);

      await useAuthStore.getState().login('test@example.com', 'passwort123');

      expect(mockedAuthApi.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'passwort123',
        twoFactorCode: undefined,
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('bleibt unauthentifiziert, wenn der Login fehlschlägt', async () => {
      mockedAuthApi.login.mockRejectedValue(new Error('Ungültige Anmeldedaten') as never);

      await expect(
        useAuthStore.getState().login('test@example.com', 'falsch'),
      ).rejects.toThrow();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('setzt den State auch zurück, wenn der Server-Logout fehlschlägt', async () => {
      useAuthStore.setState({ user: testUser, isAuthenticated: true, isLoading: false });
      mockedAuthApi.logout.mockRejectedValue(new Error('Netzwerkfehler') as never);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });
});
