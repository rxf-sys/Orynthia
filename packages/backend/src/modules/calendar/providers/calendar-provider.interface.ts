// Kalender-Provider-Abstraktion (analog BankingProviderInterface):
// ICS heute, Google Calendar heute, Apple CalDAV in Phase 2b.

/** Ein externer Kalender, wie ihn der Provider liefert. */
export interface ExternalCalendar {
  externalId: string;
  name: string;
  color?: string;
}

/**
 * Eine konkrete, bereits expandierte Termin-Instanz aus einer externen
 * Quelle. Wiederholungen werden providerseitig aufgelöst (Google:
 * singleEvents=true, ICS: RRULE-Expansion beim Import) – in der DB landet
 * pro Instanz ein Einzeltermin mit eindeutiger externalId.
 */
export interface ExternalEventInstance {
  externalId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  etag?: string | null;
}

export interface SyncWindow {
  from: Date;
  to: Date;
}

/** Standard-Sync-Fenster: 30 Tage zurück, ~13 Monate voraus. */
export function defaultSyncWindow(now = new Date()): SyncWindow {
  return {
    from: new Date(now.getTime() - 30 * 86_400_000),
    to: new Date(now.getTime() + 400 * 86_400_000),
  };
}

/** Obergrenze importierter Instanzen pro externem Kalender und Sync-Lauf. */
export const MAX_IMPORTED_EVENTS = 2000;
