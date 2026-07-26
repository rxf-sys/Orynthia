import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Calendar, ExternalIntegration } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { IntegrationsService } from '../../platform/integrations/integrations.service';
import { IcsProvider } from './providers/ics.provider';
import { GoogleCalendarProvider, SyncTokenExpiredError } from './providers/google.provider';
import { defaultSyncWindow, ExternalEventInstance } from './providers/calendar-provider.interface';

// ICS-Feeds ändern sich selten – stündlich reicht; Google alle 15 Minuten.
const ICS_MIN_SYNC_INTERVAL_MS = 55 * 60_000;

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
    private notifications: NotificationsService,
    private ics: IcsProvider,
    private google: GoogleCalendarProvider,
  ) {}

  // ---------- Verbinden ----------

  async connectIcs(userId: string, dto: { url: string; name?: string; color?: string }) {
    const url = this.ics.validateUrl(dto.url);
    // Feed sofort laden – ungültige URLs scheitern beim Verbinden, nicht erst im Cron.
    const { name: feedName, instances } = await this.ics.fetchInstances(url, defaultSyncWindow());

    const label = dto.name?.trim() || feedName || new URL(url).hostname;
    const integration = await this.integrations.create(userId, 'ICS', url, label);
    const calendar = await this.createExternalCalendar(userId, integration.id, {
      name: label,
      color: dto.color,
      source: 'ICS',
      externalId: url,
    });
    await this.replaceCalendarEvents(calendar.id, instances);
    await this.integrations.markSynced(integration.id);
    this.logger.log(`ICS-Abo verbunden (${instances.length} Termine importiert)`);
    return { integrationId: integration.id, calendarId: calendar.id, imported: instances.length };
  }

  googleStart(userId: string) {
    if (!this.google.isConfigured()) {
      throw new ServiceUnavailableException(
        'Google-Integration ist nicht konfiguriert (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env)',
      );
    }
    return { authUrl: this.google.buildAuthUrl(userId) };
  }

  async googleCallback(userId: string, code: string, state: string) {
    this.google.verifyState(state, userId);
    const { refreshToken, accessToken } = await this.google.exchangeCode(code);
    const integration = await this.integrations.create(
      userId,
      'GOOGLE_CALENDAR',
      JSON.stringify({ refreshToken }),
      'Google Kalender',
    );
    try {
      const imported = await this.syncGoogle(integration, accessToken);
      await this.integrations.markSynced(integration.id);
      return { integrationId: integration.id, imported };
    } catch (e) {
      await this.integrations.markError(integration.id, (e as Error).message);
      throw new BadRequestException('Google-Kalender konnte nicht importiert werden');
    }
  }

  async disconnect(userId: string, integrationId: string) {
    const integration = await this.integrations.findOwned(userId, integrationId);
    if (integration.provider === 'GOOGLE_CALENDAR') {
      try {
        const { refreshToken } = JSON.parse(this.integrations.getCredential(integration));
        await this.google.revoke(refreshToken);
      } catch {
        // Revoke ist best effort – Trennen darf nicht daran scheitern.
      }
    }
    return this.integrations.remove(userId, integrationId);
  }

  async syncNow(userId: string, integrationId: string) {
    const integration = await this.integrations.findOwned(userId, integrationId);
    await this.syncIntegration(integration);
    const fresh = await this.integrations.findOwned(userId, integrationId);
    return { status: fresh.status, lastSyncAt: fresh.lastSyncAt, lastError: fresh.lastError };
  }

  // ---------- Cron ----------

  @Cron('*/15 * * * *')
  async syncAll() {
    const [googleIntegrations, icsIntegrations] = await Promise.all([
      this.integrations.findAllByProvider('GOOGLE_CALENDAR'),
      this.integrations.findAllByProvider('ICS'),
    ]);
    const now = Date.now();
    const due = [
      ...googleIntegrations,
      ...icsIntegrations.filter(
        (i) => !i.lastSyncAt || now - i.lastSyncAt.getTime() > ICS_MIN_SYNC_INTERVAL_MS,
      ),
    ];
    for (const integration of due) {
      await this.syncIntegration(integration);
    }
    if (due.length > 0) this.logger.log(`Kalender-Sync-Lauf: ${due.length} Integration(en)`);
  }

  private async syncIntegration(integration: ExternalIntegration) {
    try {
      if (integration.provider === 'ICS') {
        const url = this.integrations.getCredential(integration);
        const { instances } = await this.ics.fetchInstances(url, defaultSyncWindow());
        const calendar = await this.prisma.calendar.findFirst({
          where: { integrationId: integration.id },
        });
        if (calendar) await this.replaceCalendarEvents(calendar.id, instances);
      } else if (integration.provider === 'GOOGLE_CALENDAR') {
        const { refreshToken } = JSON.parse(this.integrations.getCredential(integration));
        const accessToken = await this.google.refreshAccessToken(refreshToken);
        await this.syncGoogle(integration, accessToken);
      } else {
        return; // APPLE_CALDAV: Phase 2b
      }
      await this.integrations.markSynced(integration.id);
    } catch (e) {
      const message = (e as Error).message ?? 'Unbekannter Fehler';
      this.logger.warn(`Kalender-Sync fehlgeschlagen (${integration.provider}): ${message}`);
      await this.integrations.markError(integration.id, message);
      await this.notifications.create({
        userId: integration.userId,
        type: 'CALENDAR_SYNC_ERROR',
        title: 'Kalender-Sync fehlgeschlagen',
        message: `${integration.label ?? integration.provider}: ${message}`,
        dedupeKey: `calendar-sync-error:${integration.id}:${new Date().toISOString().slice(0, 10)}`,
        data: { integrationId: integration.id },
      });
    }
  }

  // ---------- Google-Sync ----------

  /** Importiert alle Google-Kalender; inkrementell via syncToken pro Kalender. */
  private async syncGoogle(integration: ExternalIntegration, accessToken: string): Promise<number> {
    const externalCalendars = await this.google.listCalendars(accessToken);
    let total = 0;

    for (const external of externalCalendars) {
      let calendar = await this.prisma.calendar.findFirst({
        where: { integrationId: integration.id, externalId: external.externalId },
      });
      if (!calendar) {
        calendar = await this.createExternalCalendar(integration.userId, integration.id, {
          name: external.name,
          color: external.color,
          source: 'GOOGLE',
          externalId: external.externalId,
        });
      }

      try {
        total += await this.syncGoogleCalendar(accessToken, calendar);
      } catch (e) {
        if (e instanceof SyncTokenExpiredError) {
          // 410: Token verworfen → einmalig voller Resync
          await this.prisma.calendar.update({ where: { id: calendar.id }, data: { syncToken: null } });
          total += await this.syncGoogleCalendar(accessToken, { ...calendar, syncToken: null });
        } else {
          throw e;
        }
      }
    }

    // Kalender entfernen, die es bei Google nicht mehr gibt
    await this.prisma.calendar.deleteMany({
      where: {
        integrationId: integration.id,
        externalId: { notIn: externalCalendars.map((c) => c.externalId) },
      },
    });
    return total;
  }

  private async syncGoogleCalendar(accessToken: string, calendar: Calendar): Promise<number> {
    const window = defaultSyncWindow();
    const page = await this.google.listEvents(accessToken, calendar.externalId!, {
      syncToken: calendar.syncToken,
      timeMin: window.from,
      timeMax: window.to,
    });

    if (!calendar.syncToken) {
      // Voller Import: kompletter Fensterstand ersetzt den alten
      await this.replaceCalendarEvents(calendar.id, page.upserts);
    } else {
      for (const instance of page.upserts) {
        await this.upsertEvent(calendar.id, instance);
      }
      if (page.cancelledIds.length > 0) {
        await this.prisma.calendarEvent.deleteMany({
          where: { calendarId: calendar.id, externalId: { in: page.cancelledIds } },
        });
      }
    }
    await this.prisma.calendar.update({
      where: { id: calendar.id },
      data: { syncToken: page.nextSyncToken },
    });
    return page.upserts.length;
  }

  // ---------- Persistenz-Helfer ----------

  private async createExternalCalendar(
    userId: string,
    integrationId: string,
    data: { name: string; color?: string; source: 'ICS' | 'GOOGLE'; externalId: string },
  ) {
    // @@unique([userId, name]) – bei Namenskollision Suffix anhängen
    let name = data.name.slice(0, 100);
    for (let i = 2; i < 20; i++) {
      const exists = await this.prisma.calendar.findFirst({ where: { userId, name } });
      if (!exists) break;
      name = `${data.name.slice(0, 90)} (${i})`;
    }
    return this.prisma.calendar.create({
      data: {
        userId,
        name,
        color: data.color,
        source: data.source,
        externalId: data.externalId,
        integrationId,
        readOnly: true,
        isDefault: false,
      },
    });
  }

  private async replaceCalendarEvents(calendarId: string, instances: ExternalEventInstance[]) {
    await this.prisma.$transaction([
      this.prisma.calendarEvent.deleteMany({ where: { calendarId } }),
      this.prisma.calendarEvent.createMany({
        data: instances.map((i) => this.toEventData(calendarId, i)),
        skipDuplicates: true,
      }),
    ]);
  }

  private async upsertEvent(calendarId: string, instance: ExternalEventInstance) {
    await this.prisma.calendarEvent.upsert({
      where: { calendarId_externalId: { calendarId, externalId: instance.externalId } },
      create: this.toEventData(calendarId, instance),
      update: {
        title: instance.title,
        description: instance.description,
        location: instance.location,
        startsAt: instance.startsAt,
        endsAt: instance.endsAt,
        isAllDay: instance.isAllDay,
        etag: instance.etag,
      },
    });
  }

  private toEventData(calendarId: string, instance: ExternalEventInstance) {
    return {
      calendarId,
      externalId: instance.externalId,
      title: instance.title,
      description: instance.description,
      location: instance.location,
      startsAt: instance.startsAt,
      endsAt: instance.endsAt,
      isAllDay: instance.isAllDay,
      etag: instance.etag,
    };
  }
}
