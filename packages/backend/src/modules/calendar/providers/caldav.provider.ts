import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createDAVClient } from 'tsdav';
import * as ical from 'node-ical';
import {
  ExternalCalendar,
  ExternalEventInstance,
  MAX_IMPORTED_EVENTS,
  SyncWindow,
} from './calendar-provider.interface';

// iCloud-Standard-Endpunkt; andere CalDAV-Server (Nextcloud, Radicale)
// funktionieren mit derselben Implementierung über eine eigene Server-URL.
const ICLOUD_CALDAV_URL = 'https://caldav.icloud.com';
const MAX_CALENDARS = 25;

export interface CalDavCredentials {
  serverUrl: string;
  username: string;
  /** Bei iCloud zwingend ein app-spezifisches Passwort, nie das Apple-ID-Passwort. */
  appPassword: string;
}

/**
 * Apple-/CalDAV-Anbindung (read-only Import).
 *
 * Apple bietet keine öffentliche Kalender-REST-API – der offizielle Weg ist
 * CalDAV mit Apple-ID und **app-spezifischem Passwort**. Dieses Passwort ist
 * ein Vollzugriffs-Credential für CalDAV und wird deshalb ausschließlich
 * verschlüsselt im Integration-Vault gehalten und nie geloggt.
 *
 * Bewusst nur lesend: Schreiben würde eigene iCalendar-Serialisierung samt
 * Konfliktbehandlung erfordern – siehe Roadmap.
 */
@Injectable()
export class CalDavProvider {
  private readonly logger = new Logger(CalDavProvider.name);

  normalizeServerUrl(raw?: string): string {
    const value = (raw ?? '').trim();
    if (!value) return ICLOUD_CALDAV_URL;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Ungültige CalDAV-Server-URL');
    }
    if (url.protocol !== 'https:') {
      // App-Passwörter dürfen niemals über Klartext-HTTP gehen
      throw new BadRequestException('CalDAV-Server muss über HTTPS erreichbar sein');
    }
    return url.toString().replace(/\/+$/, '');
  }

  private async connect(credentials: CalDavCredentials) {
    try {
      return await createDAVClient({
        serverUrl: credentials.serverUrl,
        credentials: { username: credentials.username, password: credentials.appPassword },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });
    } catch {
      // Fehlermeldung bewusst ohne Credential-Details
      throw new BadRequestException(
        'CalDAV-Anmeldung fehlgeschlagen – bitte Apple-ID und app-spezifisches Passwort prüfen',
      );
    }
  }

  /** Verbindung testen und verfügbare Kalender auflisten. */
  async listCalendars(credentials: CalDavCredentials): Promise<ExternalCalendar[]> {
    const client = await this.connect(credentials);
    const calendars = await client.fetchCalendars();
    return calendars
      .filter((c) => {
        // Nur Kalender, die überhaupt VEVENTs enthalten (keine Aufgabenlisten)
        const components = (c.components ?? []) as string[];
        return components.length === 0 || components.includes('VEVENT');
      })
      .slice(0, MAX_CALENDARS)
      .map((c) => ({
        externalId: c.url,
        name: typeof c.displayName === 'string' && c.displayName ? c.displayName : 'CalDAV-Kalender',
        color: typeof c.calendarColor === 'string' ? c.calendarColor.slice(0, 7) : undefined,
      }));
  }

  /**
   * Termine eines Kalenders im Zeitfenster laden. CalDAV liefert
   * iCalendar-Objekte, die hier – wie beim ICS-Abo – zu Einzel-Instanzen
   * expandiert werden.
   */
  async fetchInstances(
    credentials: CalDavCredentials,
    calendarUrl: string,
    window: SyncWindow,
  ): Promise<{ instances: ExternalEventInstance[]; ctag?: string }> {
    const client = await this.connect(credentials);
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find((c) => c.url === calendarUrl);
    if (!calendar) throw new BadRequestException('CalDAV-Kalender nicht mehr vorhanden');

    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: { start: window.from.toISOString(), end: window.to.toISOString() },
    });

    const instances: ExternalEventInstance[] = [];
    for (const object of objects) {
      if (!object.data || instances.length >= MAX_IMPORTED_EVENTS) continue;
      try {
        instances.push(...this.parseObject(object.data, object.etag ?? null, window));
      } catch {
        // Ein defektes Objekt darf den gesamten Sync nicht scheitern lassen
        this.logger.warn('CalDAV-Objekt konnte nicht geparst werden – übersprungen');
      }
    }

    return {
      instances,
      ctag: typeof calendar.ctag === 'string' ? calendar.ctag : undefined,
    };
  }

  /** iCalendar-Objekt in Instanzen zerlegen (inkl. RRULE/EXDATE). */
  private parseObject(
    data: string,
    etag: string | null,
    window: SyncWindow,
  ): ExternalEventInstance[] {
    const parsed = ical.parseICS(data);
    const result: ExternalEventInstance[] = [];

    for (const item of Object.values(parsed)) {
      if (!item || item.type !== 'VEVENT') continue;
      const event = item as ical.VEvent;
      if (!event.start || !event.uid || !event.summary) continue;

      const durationMs =
        (event.end?.getTime() ?? event.start.getTime() + 3_600_000) - event.start.getTime();
      const isAllDay =
        (event.start as ical.DateWithTimeZone & { dateOnly?: boolean }).dateOnly === true ||
        event.datetype === 'date';

      const push = (start: Date, suffix = '') => {
        if (result.length >= MAX_IMPORTED_EVENTS) return;
        if (start >= window.to || new Date(start.getTime() + durationMs) <= window.from) return;
        result.push({
          externalId: `${event.uid}${suffix}`,
          title: event.summary as unknown as string,
          description: typeof event.description === 'string' ? event.description : null,
          location: typeof event.location === 'string' ? event.location : null,
          startsAt: start,
          endsAt: new Date(start.getTime() + Math.max(durationMs, 0)),
          isAllDay,
          etag,
        });
      };

      if (!event.rrule) {
        push(event.start);
        continue;
      }

      const exdates = new Set(
        Object.values(event.exdate ?? {}).map((d) => (d as Date).getTime()),
      );
      for (const occ of event.rrule.between(window.from, window.to, true).slice(0, 500)) {
        if (exdates.has(occ.getTime())) continue;
        push(occ, `:${occ.toISOString()}`);
      }
    }

    return result;
  }
}
