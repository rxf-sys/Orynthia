import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encrypt, decrypt } from '../../../platform/common/crypto/encryption';
import { ExternalCalendar, ExternalEventInstance } from './calendar-provider.interface';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPE_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';
// Schreibrechte nur auf Termine – nicht auf Kalender-Verwaltung/Einstellungen
const SCOPE_READWRITE = 'https://www.googleapis.com/auth/calendar.events';
const STATE_TTL_MS = 10 * 60_000;

/** Signalisiert einen abgelaufenen syncToken (HTTP 410) → voller Resync nötig. */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super('syncToken abgelaufen');
  }
}

/**
 * Der Termin wurde bei Google zwischenzeitlich geändert (HTTP 412 auf
 * If-Match). Wird bewusst nach oben gereicht, statt stumm zu überschreiben.
 */
export class RemoteConflictError extends Error {
  constructor() {
    super('Der Termin wurde bei Google zwischenzeitlich geändert');
  }
}

/** Feldsatz, den Orynthia nach Google schreibt. */
export interface WritableEvent {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
}

interface GoogleEventItem {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  etag?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export interface GoogleEventsPage {
  upserts: ExternalEventInstance[];
  cancelledIds: string[];
  nextSyncToken: string | null;
}

/**
 * Google-Calendar-Anbindung (read-only) über die REST-API mit nativem
 * fetch – bewusst ohne das schwergewichtige googleapis-Paket. Der
 * Refresh-Token wird verschlüsselt im Integration-Vault gehalten;
 * Access-Tokens leben nur im Prozessspeicher.
 */
@Injectable()
export class GoogleCalendarProvider {
  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET'));
  }

  private clientId(): string {
    const id = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!id) throw new ServiceUnavailableException('Google-Integration ist nicht konfiguriert (GOOGLE_CLIENT_ID/SECRET in .env)');
    return id;
  }

  private clientSecret(): string {
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!secret) throw new ServiceUnavailableException('Google-Integration ist nicht konfiguriert (GOOGLE_CLIENT_ID/SECRET in .env)');
    return secret;
  }

  redirectUri(): string {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    return `${frontendUrl}/calendar`;
  }

  // ---------- OAuth ----------

  /** CSRF-Schutz: state trägt userId + Zeitstempel, AES-verschlüsselt. */
  buildState(userId: string, writable = false): string {
    return encodeURIComponent(encrypt(JSON.stringify({ u: userId, t: Date.now(), w: writable })));
  }

  verifyState(state: string, userId: string): { writable: boolean } {
    let parsed: { u?: string; t?: number; w?: boolean };
    try {
      parsed = JSON.parse(decrypt(decodeURIComponent(state)));
    } catch {
      throw new BadRequestException('Ungültiger OAuth-State');
    }
    if (parsed.u !== userId || !parsed.t || Date.now() - parsed.t > STATE_TTL_MS) {
      throw new BadRequestException('OAuth-State abgelaufen oder ungültig');
    }
    return { writable: parsed.w === true };
  }

  buildAuthUrl(userId: string, writable = false): string {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: writable ? SCOPE_READWRITE : SCOPE_READONLY,
      access_type: 'offline',
      prompt: 'consent',
      state: this.buildState(userId, writable),
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ refreshToken: string; accessToken: string }> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string };
    if (!res.ok || !data.access_token) {
      throw new BadRequestException(`Google-Token-Austausch fehlgeschlagen (${data.error ?? res.status})`);
    }
    if (!data.refresh_token) {
      throw new BadRequestException(
        'Google hat keinen Refresh-Token geliefert – bitte Zugriff unter myaccount.google.com/permissions entfernen und erneut verbinden',
      );
    }
    return { refreshToken: data.refresh_token, accessToken: data.access_token };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        grant_type: 'refresh_token',
      }),
    });
    const data = (await res.json()) as { access_token?: string; error?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(`Google-Token-Refresh fehlgeschlagen (${data.error ?? res.status})`);
    }
    return data.access_token;
  }

  async revoke(refreshToken: string): Promise<void> {
    // Best effort – ein bereits ungültiger Token soll das Trennen nicht blockieren.
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(
      () => undefined,
    );
  }

  // ---------- Kalender & Events ----------

  async listCalendars(accessToken: string): Promise<ExternalCalendar[]> {
    const res = await fetch(`${API_BASE}/users/me/calendarList?maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google calendarList fehlgeschlagen (${res.status})`);
    const data = (await res.json()) as {
      items?: Array<{ id: string; summary?: string; backgroundColor?: string; deleted?: boolean }>;
    };
    return (data.items ?? [])
      .filter((c) => !c.deleted)
      .map((c) => ({ externalId: c.id, name: c.summary ?? c.id, color: c.backgroundColor }));
  }

  /**
   * Events eines Kalenders laden. Mit syncToken inkrementell (gelöschte
   * kommen als status=cancelled), sonst voller Import im Zeitfenster.
   * singleEvents=true expandiert Serien serverseitig zu Instanzen.
   */
  async listEvents(
    accessToken: string,
    calendarExternalId: string,
    opts: { syncToken?: string | null; timeMin?: Date; timeMax?: Date },
  ): Promise<GoogleEventsPage> {
    const upserts: ExternalEventInstance[] = [];
    const cancelledIds: string[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    do {
      const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
      if (opts.syncToken) params.set('syncToken', opts.syncToken);
      else {
        if (opts.timeMin) params.set('timeMin', opts.timeMin.toISOString());
        if (opts.timeMax) params.set('timeMax', opts.timeMax.toISOString());
      }
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(calendarExternalId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (res.status === 410) throw new SyncTokenExpiredError();
      if (!res.ok) throw new Error(`Google events.list fehlgeschlagen (${res.status})`);
      const data = (await res.json()) as {
        items?: GoogleEventItem[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };

      for (const item of data.items ?? []) {
        if (item.status === 'cancelled') {
          cancelledIds.push(item.id);
          continue;
        }
        const instance = this.mapEvent(item);
        if (instance) upserts.push(instance);
      }
      pageToken = data.nextPageToken;
      nextSyncToken = data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { upserts, cancelledIds, nextSyncToken };
  }

  // ---------- Schreibrichtung (bidirektionaler Sync) ----------

  /** Google erwartet bei Ganztages-Terminen ein exklusives Enddatum. */
  private toGoogleBody(event: WritableEvent) {
    const dayString = (d: Date) => d.toISOString().slice(0, 10);
    return {
      summary: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start: event.isAllDay
        ? { date: dayString(event.startsAt) }
        : { dateTime: event.startsAt.toISOString() },
      end: event.isAllDay
        ? { date: dayString(new Date(event.endsAt.getTime() + 1000)) }
        : { dateTime: event.endsAt.toISOString() },
    };
  }

  async createEvent(
    accessToken: string,
    calendarExternalId: string,
    event: WritableEvent,
  ): Promise<{ externalId: string; etag: string | null }> {
    const res = await fetch(
      `${API_BASE}/calendars/${encodeURIComponent(calendarExternalId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.toGoogleBody(event)),
      },
    );
    if (!res.ok) throw new Error(`Google events.insert fehlgeschlagen (${res.status})`);
    const data = (await res.json()) as { id: string; etag?: string };
    return { externalId: data.id, etag: data.etag ?? null };
  }

  async updateEvent(
    accessToken: string,
    calendarExternalId: string,
    externalId: string,
    event: WritableEvent,
    etag?: string | null,
  ): Promise<{ etag: string | null }> {
    const res = await fetch(
      `${API_BASE}/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          // Optimistic Locking: nur schreiben, wenn die Remote-Version
          // noch die ist, die wir zuletzt gesehen haben.
          ...(etag ? { 'If-Match': etag } : {}),
        },
        body: JSON.stringify(this.toGoogleBody(event)),
      },
    );
    if (res.status === 412) throw new RemoteConflictError();
    if (!res.ok) throw new Error(`Google events.update fehlgeschlagen (${res.status})`);
    const data = (await res.json()) as { etag?: string };
    return { etag: data.etag ?? null };
  }

  async deleteEvent(
    accessToken: string,
    calendarExternalId: string,
    externalId: string,
    etag?: string | null,
  ): Promise<void> {
    const res = await fetch(
      `${API_BASE}/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(etag ? { 'If-Match': etag } : {}),
        },
      },
    );
    if (res.status === 412) throw new RemoteConflictError();
    // 410 = bei Google bereits gelöscht; für uns ein Erfolg
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google events.delete fehlgeschlagen (${res.status})`);
    }
  }

  private mapEvent(item: GoogleEventItem): ExternalEventInstance | null {
    const startRaw = item.start?.dateTime ?? item.start?.date;
    const endRaw = item.end?.dateTime ?? item.end?.date;
    if (!startRaw || !endRaw) return null;
    const isAllDay = !!item.start?.date;
    const startsAt = new Date(startRaw);
    // Ganztages-Enddatum ist bei Google exklusiv → letzte belegte Sekunde des Vortags.
    const endsAt = isAllDay ? new Date(new Date(endRaw).getTime() - 1000) : new Date(endRaw);
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) return null;
    return {
      externalId: item.id,
      title: item.summary ?? '(ohne Titel)',
      description: item.description ?? null,
      location: item.location ?? null,
      startsAt,
      endsAt: endsAt < startsAt ? startsAt : endsAt,
      isAllDay,
      etag: item.etag ?? null,
    };
  }
}
