import { BadRequestException, Injectable } from '@nestjs/common';
import * as ical from 'node-ical';
import {
  ExternalEventInstance,
  MAX_IMPORTED_EVENTS,
  SyncWindow,
} from './calendar-provider.interface';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FEED_BYTES = 5 * 1024 * 1024;

/**
 * Read-only ICS-Abo: lädt einen iCalendar-Feed (z. B. iCloud
 * „Kalender teilen per Link", Outlook, Nextcloud) und expandiert
 * VEVENTs inkl. RRULE/EXDATE in Einzel-Instanzen im Sync-Fenster.
 */
@Injectable()
export class IcsProvider {
  validateUrl(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://'));
    } catch {
      throw new BadRequestException('Ungültige ICS-URL');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BadRequestException('Nur http(s)- oder webcal-URLs werden unterstützt');
    }
    return url.toString();
  }

  async fetchInstances(url: string, window: SyncWindow): Promise<{ name?: string; instances: ExternalEventInstance[] }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let text: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'text/calendar, text/plain, */*' },
        redirect: 'follow',
      });
      if (!res.ok) throw new BadRequestException(`ICS-Feed antwortet mit HTTP ${res.status}`);
      text = await res.text();
      if (text.length > MAX_FEED_BYTES) throw new BadRequestException('ICS-Feed ist zu groß (max. 5 MB)');
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('ICS-Feed konnte nicht geladen werden');
    } finally {
      clearTimeout(timer);
    }
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      throw new BadRequestException('Antwort ist kein iCalendar-Feed');
    }

    const parsed = ical.parseICS(text);
    const instances: ExternalEventInstance[] = [];
    let calendarName: string | undefined;

    for (const item of Object.values(parsed)) {
      if (!item) continue;
      if (item.type === 'VCALENDAR') {
        const wrapped = item as unknown as { 'WR-CALNAME'?: string };
        calendarName = wrapped['WR-CALNAME'] ?? calendarName;
      }
      if (item.type !== 'VEVENT') continue;
      const event = item as ical.VEvent;
      if (!event.start || !event.uid || !event.summary) continue;
      const durationMs =
        (event.end?.getTime() ?? event.start.getTime() + 3_600_000) - event.start.getTime();
      const isAllDay = (event.start as ical.DateWithTimeZone & { dateOnly?: boolean }).dateOnly === true ||
        event.datetype === 'date';

      const push = (start: Date, suffix = '') => {
        if (instances.length >= MAX_IMPORTED_EVENTS) return;
        if (start >= window.to || new Date(start.getTime() + durationMs) <= window.from) return;
        instances.push({
          externalId: `${event.uid}${suffix}`,
          title: event.summary as unknown as string,
          description: typeof event.description === 'string' ? event.description : null,
          location: typeof event.location === 'string' ? event.location : null,
          startsAt: start,
          endsAt: new Date(start.getTime() + Math.max(durationMs, 0)),
          isAllDay,
          etag: null,
        });
      };

      if (!event.rrule) {
        push(event.start);
        continue;
      }

      // RRULE-Expansion im Fenster; EXDATEs und Overrides (RECURRENCE-ID)
      // werden berücksichtigt.
      const exdates = new Set(
        Object.values(event.exdate ?? {}).map((d) => (d as Date).getTime()),
      );
      const overrides = event.recurrences ?? {};
      const occurrences = event.rrule.between(window.from, window.to, true).slice(0, 500);
      for (const occ of occurrences) {
        if (exdates.has(occ.getTime())) continue;
        const key = occ.toISOString().slice(0, 10);
        const override = Object.entries(overrides).find(([k]) => k.startsWith(key))?.[1] as
          | ical.VEvent
          | undefined;
        if (override?.start) {
          if (instances.length < MAX_IMPORTED_EVENTS) {
            const oDuration =
              (override.end?.getTime() ?? override.start.getTime() + durationMs) -
              override.start.getTime();
            instances.push({
              externalId: `${event.uid}:${occ.toISOString()}`,
              title: (override.summary ?? event.summary) as unknown as string,
              description: typeof override.description === 'string' ? override.description : null,
              location: typeof override.location === 'string' ? override.location : null,
              startsAt: override.start,
              endsAt: new Date(override.start.getTime() + Math.max(oDuration, 0)),
              isAllDay,
              etag: null,
            });
          }
        } else {
          push(occ, `:${occ.toISOString()}`);
        }
      }
    }

    return { name: calendarName, instances };
  }
}
