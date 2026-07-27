import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

const STORAGE_KEY = 'orynthia-offline-cache';

/**
 * Cache-Version. Ändert sich das Format einer persistierten Antwort,
 * wird der Wert erhöht – alte Stände werden dann verworfen statt
 * fehlerhaft weiterverwendet.
 */
const CACHE_BUSTER = 'v1';

/** Nach 24 Stunden gilt ein Offline-Stand als zu alt zum Anzeigen. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Nur Alltags-Module werden offline vorgehalten. Finanz- und Banking-Daten
 * bleiben bewusst außen vor: sie sind hochsensibel und hätten im
 * localStorage einen dauerhaften Klartext-Abzug hinterlassen – auch nach
 * dem Abmelden. Dasselbe gilt für Dokumenten-Metadaten, Suchtreffer und
 * die Assistenten-Historie.
 */
const PERSISTED_KEYS = new Set([
  'tasks',
  'task-lists',
  'tasks-summary',
  'calendar-events',
  'calendar-upcoming',
  'calendar-tasks',
  'calendar-meals',
  'calendars',
  'recipes',
  'recipe',
  'meal-plan',
  'lists',
  'list',
  'notes',
  'note-tags',
  'trips',
  'trip',
  'habits',
  'habit-summary',
  'dashboard-layout',
]);

export function isPersistable(query: Query): boolean {
  // Fehlgeschlagene Abfragen nicht konservieren – sonst zeigt die App
  // offline einen Fehlerzustand statt des letzten guten Standes.
  if (query.state.status !== 'success') return false;
  const key = query.queryKey[0];
  return typeof key === 'string' && PERSISTED_KEYS.has(key);
}

export function createPersister() {
  // localStorage ist in manchen Browser-Modi gesperrt; dann läuft die App
  // einfach ohne Offline-Cache weiter.
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return createSyncStoragePersister({ storage: window.localStorage, key: STORAGE_KEY });
  } catch {
    return null;
  }
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient' | 'persister'> = {
  maxAge: MAX_AGE_MS,
  buster: CACHE_BUSTER,
};

export const dehydrateOptions = { shouldDehydrateQuery: isPersistable };

/** Beim Abmelden bleibt kein Datenrest im Browser zurück. */
export function clearOfflineCache() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Kein Storage verfügbar – dann gibt es auch nichts zu löschen.
  }
}
