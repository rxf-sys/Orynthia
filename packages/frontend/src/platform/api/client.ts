import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // httpOnly Cookies automatisch mitsenden
  timeout: 30_000, // hängende Requests nicht unbegrenzt offen halten
});

/**
 * Offline-Guard: Lesen darf offline aus dem persistierten Query-Cache
 * bedient werden, Schreiben nicht. Ohne diese Sperre würden Mutationen
 * ins Leere laufen und der Nutzer hielte Änderungen für gespeichert, die
 * den Server nie erreicht haben.
 */
export class OfflineWriteError extends Error {
  constructor() {
    super('Offline – Änderungen sind erst wieder möglich, sobald du verbunden bist.');
    this.name = 'OfflineWriteError';
  }
}

const READ_METHODS = new Set(['get', 'head', 'options']);

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline && !READ_METHODS.has(method)) {
    throw new OfflineWriteError();
  }
  return config;
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

// Auth-Endpoints vom Auto-Refresh ausnehmen: Ein 401 von /auth/login ist
// "falsches Passwort", ein 401 von /auth/refresh ist "Session abgelaufen" —
// beides darf keinen weiteren Refresh anstoßen. Ohne diese Ausnahme landet
// der Refresh-Request bei eigenem 401 in der failedQueue und wartet auf
// sich selbst (Deadlock: isRefreshing bleibt true, alle Requests hängen).
const AUTH_NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl: string = originalRequest?.url ?? '';
    const isAuthEndpoint = AUTH_NO_RETRY.some((p) => requestUrl.includes(p));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
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
        // Kein harter window.location-Redirect: Auth-State zurücksetzen,
        // die Route-Guards navigieren dann ohne Full-Reload (und ohne
        // Mehrfach-Redirects bei parallelen 401ern).
        const { useAuthStore } = await import('@/stores/authStore');
        const { clearOfflineCache } = await import('@/platform/offline/persistence');
        clearOfflineCache();
        useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
