import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { createPersister, dehydrateOptions, persistOptions } from '@/platform/offline/persistence';
// Self-hosted Fonts statt Google-CDN: kein render-blockender Drittanbieter-Request
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      // Damit ein persistierter Stand nach dem Start nicht sofort als
      // veraltet verworfen wird, bevor die Antwort vom Server da ist.
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

// Offline-Lesbarkeit: der letzte Stand der Alltags-Module überlebt einen
// Reload. Ohne verfügbaren localStorage läuft die App unverändert weiter.
const persister = createPersister();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

const tree = (
  <BrowserRouter>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-elev)',
          color: 'var(--text)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          fontSize: '0.875rem',
          boxShadow: 'var(--shadow-2)',
        },
      }}
    />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {persister ? (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ ...persistOptions, persister, dehydrateOptions }}
      >
        {tree}
      </PersistQueryClientProvider>
    ) : (
      <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>
    )}
  </React.StrictMode>,
);
