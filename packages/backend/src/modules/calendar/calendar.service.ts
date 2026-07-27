import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarEvent, EventRecurrence } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { addRecurrence } from '../../platform/common/dates';
import { CreateCalendarDto, CreateEventDto, UpdateCalendarDto, UpdateEventDto } from './dto/calendar.dto';
import { CalendarSyncService } from './calendar-sync.service';

/** Eine konkrete Termin-Instanz (bei Wiederholungen expandiert). */
export interface EventOccurrence {
  id: string;
  calendarId: string;
  calendarColor: string | null;
  calendarName: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  reminderMinutes: number | null;
  recurrence: EventRecurrence | null;
  recurrenceInterval: number | null;
  recurrenceUntil: string | null;
  isRecurringInstance: boolean;
  readOnly: boolean;
}

// Obergrenze pro Event, damit fehlerhafte Wiederholungen keine
// unbegrenzten Instanz-Mengen erzeugen können.
const MAX_OCCURRENCES_PER_EVENT = 400;

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private sync: CalendarSyncService,
  ) {}

  // ---------- Kalender ----------

  async findAllCalendars(userId: string) {
    const calendars = await this.prisma.calendar.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { events: true } } },
    });
    if (calendars.some((c) => !c.readOnly)) return calendars;
    // Erster Zugriff: Standard-Kalender anlegen, damit Termine sofort
    // ohne Einrichtungs-Schritt funktionieren.
    const created = await this.prisma.calendar.create({
      data: { userId, name: 'Privat', color: '#5b8def', isDefault: true },
      include: { _count: { select: { events: true } } },
    });
    return [created, ...calendars];
  }

  async createCalendar(userId: string, dto: CreateCalendarDto) {
    const existing = await this.prisma.calendar.findFirst({ where: { userId, name: dto.name } });
    if (existing) throw new BadRequestException('Ein Kalender mit diesem Namen existiert bereits');
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.calendar.create({
      data: { userId, name: dto.name, color: dto.color, isDefault: dto.isDefault ?? false },
    });
  }

  async updateCalendar(userId: string, id: string, dto: UpdateCalendarDto) {
    const calendar = await this.prisma.calendar.findFirst({ where: { id, userId } });
    if (!calendar) throw new NotFoundException('Kalender nicht gefunden');
    if (dto.isDefault && calendar.readOnly) {
      throw new BadRequestException('Ein synchronisierter Kalender kann nicht Standard sein');
    }
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.calendar.update({ where: { id }, data: dto });
  }

  async removeCalendar(userId: string, id: string) {
    const calendar = await this.prisma.calendar.findFirst({ where: { id, userId } });
    if (!calendar) throw new NotFoundException('Kalender nicht gefunden');
    if (calendar.integrationId) {
      throw new BadRequestException(
        'Synchronisierte Kalender werden über „Verbindung trennen" bei den Integrationen entfernt',
      );
    }
    const count = await this.prisma.calendar.count({ where: { userId, integrationId: null } });
    if (count <= 1) throw new BadRequestException('Der letzte Kalender kann nicht gelöscht werden');
    await this.prisma.calendar.delete({ where: { id } });
    if (calendar.isDefault) {
      const next = await this.prisma.calendar.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.calendar.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { message: 'Kalender gelöscht' };
  }

  // ---------- Termine ----------

  async findEvents(userId: string, fromIso: string, toIso: string): Promise<EventOccurrence[]> {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
      throw new BadRequestException('Ungültiger Zeitraum');
    }
    const rangeDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (rangeDays > 400) throw new BadRequestException('Zeitraum zu groß (max. 400 Tage)');

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        calendar: { userId },
        OR: [
          // Einzeltermine, die den Zeitraum schneiden
          { recurrence: null, startsAt: { lt: to }, endsAt: { gt: from } },
          // Serien, deren Start vor dem Zeitraum-Ende liegt (Instanzen werden expandiert)
          { recurrence: { not: null }, startsAt: { lt: to } },
        ],
      },
      include: { calendar: { select: { name: true, color: true, readOnly: true } } },
      take: 2000,
    });

    const occurrences: EventOccurrence[] = [];
    for (const event of events) {
      occurrences.push(...this.expand(event, from, to));
    }
    occurrences.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return occurrences;
  }

  async createEvent(userId: string, dto: CreateEventDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt < startsAt) throw new BadRequestException('Ende darf nicht vor dem Beginn liegen');

    let calendarId = dto.calendarId;
    if (calendarId) {
      await this.assertCalendarWritable(userId, calendarId);
    } else {
      const calendars = await this.findAllCalendars(userId);
      const writable = calendars.filter((c) => !c.readOnly);
      if (writable.length === 0) throw new BadRequestException('Kein beschreibbarer Kalender vorhanden');
      calendarId = (writable.find((c) => c.isDefault) ?? writable[0]).id;
    }

    // Bei bidirektional verbundenen Kalendern zuerst extern anlegen: nur
    // wenn das gelingt, entsteht lokal ein Termin – so laufen beide Seiten
    // nicht auseinander.
    const remote = await this.sync.pushCreate(calendarId, {
      title: dto.title,
      description: dto.description,
      location: dto.location,
      startsAt,
      endsAt,
      isAllDay: dto.isAllDay ?? false,
    });

    return this.prisma.calendarEvent.create({
      data: {
        calendarId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startsAt,
        endsAt,
        isAllDay: dto.isAllDay ?? false,
        reminderMinutes: dto.reminderMinutes,
        recurrence: dto.recurrence,
        recurrenceInterval: dto.recurrence ? (dto.recurrenceInterval ?? 1) : null,
        recurrenceUntil: dto.recurrenceUntil ? new Date(dto.recurrenceUntil) : null,
        externalId: remote?.externalId,
        etag: remote?.etag,
      },
      include: { calendar: { select: { name: true, color: true } } },
    });
  }

  async updateEvent(userId: string, id: string, dto: UpdateEventDto) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, calendar: { userId } },
      include: { calendar: { select: { readOnly: true } } },
    });
    if (!event) throw new NotFoundException('Termin nicht gefunden');
    if (event.calendar.readOnly) {
      throw new BadRequestException('Termine aus synchronisierten Kalendern sind schreibgeschützt');
    }
    if (dto.calendarId) await this.assertCalendarWritable(userId, dto.calendarId);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : event.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : event.endsAt;
    if (endsAt < startsAt) throw new BadRequestException('Ende darf nicht vor dem Beginn liegen');

    // Bei bidirektionalem Sync erst extern schreiben (mit etag-Prüfung);
    // ein Konflikt bricht hier ab, statt die Remote-Version zu überschreiben.
    let remoteEtag: string | null | undefined;
    if (event.externalId) {
      const pushed = await this.sync.pushUpdate(
        dto.calendarId ?? event.calendarId,
        event.externalId,
        {
          title: dto.title ?? event.title,
          description: dto.description !== undefined ? dto.description : event.description,
          location: dto.location !== undefined ? dto.location : event.location,
          startsAt,
          endsAt,
          isAllDay: dto.isAllDay ?? event.isAllDay,
        },
        event.etag,
      );
      remoteEtag = pushed?.etag;
    }

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.calendarId !== undefined ? { calendarId: dto.calendarId } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.startsAt !== undefined ? { startsAt } : {}),
        ...(dto.endsAt !== undefined ? { endsAt } : {}),
        ...(dto.isAllDay !== undefined ? { isAllDay: dto.isAllDay } : {}),
        ...(dto.reminderMinutes !== undefined ? { reminderMinutes: dto.reminderMinutes } : {}),
        ...(dto.recurrence !== undefined ? { recurrence: dto.recurrence } : {}),
        ...(dto.recurrenceInterval !== undefined ? { recurrenceInterval: dto.recurrenceInterval } : {}),
        ...(dto.recurrenceUntil !== undefined
          ? { recurrenceUntil: dto.recurrenceUntil ? new Date(dto.recurrenceUntil) : null }
          : {}),
        ...(remoteEtag !== undefined ? { etag: remoteEtag } : {}),
      },
      include: { calendar: { select: { name: true, color: true } } },
    });
  }

  async removeEvent(userId: string, id: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, calendar: { userId } },
      select: {
        id: true,
        calendarId: true,
        externalId: true,
        etag: true,
        calendar: { select: { readOnly: true } },
      },
    });
    if (!event) throw new NotFoundException('Termin nicht gefunden');
    if (event.calendar.readOnly) {
      throw new BadRequestException('Termine aus synchronisierten Kalendern sind schreibgeschützt');
    }
    if (event.externalId) {
      await this.sync.pushDelete(event.calendarId, event.externalId, event.etag);
    }
    await this.prisma.calendarEvent.delete({ where: { id } });
    return { message: 'Termin gelöscht' };
  }

  // ---------- Zusammenfassung (Home-Widget / Public API des Moduls) ----------

  async getUpcoming(userId: string, days = 7, limit = 10) {
    const from = new Date();
    const to = new Date(from.getTime() + days * 86_400_000);
    const occurrences = await this.findEvents(userId, from.toISOString(), to.toISOString());
    return occurrences.slice(0, Math.min(limit, 50));
  }

  /**
   * Schmale Public API für die globale Suche. Sucht in Titel/Ort und liefert
   * pro Treffer die nächste relevante Instanz (Serien werden expandiert).
   */
  async search(userId: string, q: string, limit = 5) {
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        calendar: { userId },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { calendar: { select: { name: true, color: true, readOnly: true } } },
      orderBy: { startsAt: 'desc' },
      take: limit * 4,
    });

    const now = new Date();
    const horizon = new Date(now.getTime() + 400 * 86_400_000);
    return events
      .map((event) => {
        const next = this.nextOccurrenceStart(event, now, horizon) ?? event.startsAt;
        return {
          id: event.id,
          title: event.title,
          startsAt: next.toISOString(),
          calendarName: event.calendar.name,
          isAllDay: event.isAllDay,
        };
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, limit);
  }

  // ---------- Termin-Erinnerungen ----------

  // Alle 5 Minuten: Termine melden, deren Erinnerungsfenster erreicht ist.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async notifyReminders() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 8 * 86_400_000);
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        reminderMinutes: { not: null },
        OR: [{ recurrence: null, startsAt: { gte: now, lte: horizon } }, { recurrence: { not: null } }],
      },
      include: { calendar: { select: { userId: true, name: true, color: true } } },
      take: 2000,
    });

    let sent = 0;
    for (const event of events) {
      const next = this.nextOccurrenceStart(event, now, horizon);
      if (!next) continue;
      const remindAt = new Date(next.getTime() - (event.reminderMinutes ?? 0) * 60_000);
      if (remindAt > now) continue;
      const created = await this.notifications.create({
        userId: (event as CalendarEvent & { calendar: { userId: string } }).calendar.userId,
        type: 'EVENT_REMINDER',
        title: 'Termin-Erinnerung',
        message: `${event.title} – ${next.toLocaleString('de-DE', {
          dateStyle: 'medium',
          timeStyle: event.isAllDay ? undefined : 'short',
        })}`,
        dedupeKey: `event-reminder:${event.id}:${next.toISOString()}`,
        data: { eventId: event.id, startsAt: next.toISOString() },
      });
      if (created) sent++;
    }
    if (sent > 0) this.logger.log(`Termin-Erinnerungen versendet: ${sent}`);
  }

  // ---------- interne Helfer ----------

  private expand(
    event: CalendarEvent & { calendar: { name: string; color: string | null; readOnly?: boolean } },
    from: Date,
    to: Date,
  ): EventOccurrence[] {
    const durationMs = event.endsAt.getTime() - event.startsAt.getTime();
    const toOccurrence = (start: Date, isInstance: boolean): EventOccurrence => ({
      id: event.id,
      calendarId: event.calendarId,
      calendarColor: event.calendar.color,
      calendarName: event.calendar.name,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + durationMs).toISOString(),
      isAllDay: event.isAllDay,
      reminderMinutes: event.reminderMinutes,
      recurrence: event.recurrence,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
      isRecurringInstance: isInstance,
      readOnly: event.calendar.readOnly ?? false,
    });

    if (!event.recurrence) {
      return [toOccurrence(event.startsAt, false)];
    }

    const result: EventOccurrence[] = [];
    const until = event.recurrenceUntil && event.recurrenceUntil < to ? event.recurrenceUntil : to;
    const anchorDay = event.startsAt.getDate();
    let current = new Date(event.startsAt);
    for (let i = 0; i < MAX_OCCURRENCES_PER_EVENT && current <= until; i++) {
      const currentEnd = new Date(current.getTime() + durationMs);
      if (currentEnd > from && current < to) {
        result.push(toOccurrence(current, current.getTime() !== event.startsAt.getTime()));
      }
      current = addRecurrence(current, event.recurrence, event.recurrenceInterval ?? 1, anchorDay);
    }
    return result;
  }

  private nextOccurrenceStart(event: CalendarEvent, now: Date, horizon: Date): Date | null {
    if (!event.recurrence) {
      return event.startsAt >= now && event.startsAt <= horizon ? event.startsAt : null;
    }
    const until = event.recurrenceUntil ?? horizon;
    const anchorDay = event.startsAt.getDate();
    let current = new Date(event.startsAt);
    for (let i = 0; i < MAX_OCCURRENCES_PER_EVENT && current <= until && current <= horizon; i++) {
      if (current >= now) return current;
      current = addRecurrence(current, event.recurrence, event.recurrenceInterval ?? 1, anchorDay);
    }
    return null;
  }

  private async clearDefault(userId: string) {
    await this.prisma.calendar.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  private async assertCalendarWritable(userId: string, calendarId: string) {
    const calendar = await this.prisma.calendar.findFirst({
      where: { id: calendarId, userId },
      select: { id: true, readOnly: true },
    });
    if (!calendar) throw new NotFoundException('Kalender nicht gefunden');
    // readOnly ist bei bidirektional verbundenen Kalendern false – dort
    // sind Änderungen erlaubt und werden zusätzlich nach außen gespiegelt.
    if (calendar.readOnly) {
      throw new BadRequestException('Dieser Kalender ist schreibgeschützt (synchronisiert)');
    }
  }

  private async assertCalendarOwnership(userId: string, calendarId: string) {
    const calendar = await this.prisma.calendar.findFirst({
      where: { id: calendarId, userId },
      select: { id: true },
    });
    if (!calendar) throw new NotFoundException('Kalender nicht gefunden');
  }
}
