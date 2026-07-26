import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';

describe('CalendarService', () => {
  let service: CalendarService;

  const mockPrisma = {
    calendar: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    calendarEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockNotifications = { create: jest.fn() };

  const baseEvent = {
    id: 'e1',
    calendarId: 'c1',
    title: 'Termin',
    description: null,
    location: null,
    isAllDay: false,
    reminderMinutes: null,
    recurrenceInterval: 1,
    recurrenceUntil: null,
    externalId: null,
    etag: null,
    calendar: { name: 'Privat', color: '#5b8def' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    jest.clearAllMocks();
  });

  describe('findEvents', () => {
    it('lehnt ungültige und zu große Zeiträume ab', async () => {
      await expect(service.findEvents('u1', 'kein-datum', '2026-01-01')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.findEvents('u1', '2026-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findEvents('u1', '2020-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      ).rejects.toThrow(BadRequestException);
    });

    it('expandiert wöchentliche Serien innerhalb des Zeitraums', async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        {
          ...baseEvent,
          startsAt: new Date('2026-07-01T10:00:00.000Z'),
          endsAt: new Date('2026-07-01T11:00:00.000Z'),
          recurrence: 'WEEKLY',
        },
      ]);

      const result = await service.findEvents(
        'u1',
        '2026-07-01T00:00:00.000Z',
        '2026-07-31T00:00:00.000Z',
      );

      // 1., 8., 15., 22., 29. Juli
      expect(result).toHaveLength(5);
      expect(result[0].isRecurringInstance).toBe(false);
      expect(result[1].isRecurringInstance).toBe(true);
      expect(result[1].startsAt).toBe('2026-07-08T10:00:00.000Z');
      // Dauer bleibt pro Instanz erhalten
      expect(new Date(result[4].endsAt).getTime() - new Date(result[4].startsAt).getTime()).toBe(
        3_600_000,
      );
    });

    it('respektiert recurrenceUntil als Serien-Ende', async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        {
          ...baseEvent,
          startsAt: new Date('2026-07-01T10:00:00.000Z'),
          endsAt: new Date('2026-07-01T11:00:00.000Z'),
          recurrence: 'WEEKLY',
          recurrenceUntil: new Date('2026-07-10T00:00:00.000Z'),
        },
      ]);

      const result = await service.findEvents(
        'u1',
        '2026-07-01T00:00:00.000Z',
        '2026-07-31T00:00:00.000Z',
      );
      expect(result).toHaveLength(2);
    });

    it('klemmt monatliche Serien vom 31. auf das Monatsende (kein Drift)', async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        {
          ...baseEvent,
          startsAt: new Date('2026-01-31T09:00:00.000Z'),
          endsAt: new Date('2026-01-31T10:00:00.000Z'),
          recurrence: 'MONTHLY',
        },
      ]);

      const result = await service.findEvents(
        'u1',
        '2026-01-01T00:00:00.000Z',
        '2026-04-15T00:00:00.000Z',
      );

      const days = result.map((o) => new Date(o.startsAt).getDate());
      // Jan 31 → Feb 28 → Mär 31
      expect(days).toEqual([31, 28, 31]);
    });
  });

  describe('createEvent', () => {
    it('lehnt Ende vor Beginn ab', async () => {
      await expect(
        service.createEvent('u1', {
          title: 'X',
          startsAt: '2026-08-01T10:00:00.000Z',
          endsAt: '2026-08-01T09:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('wirft NotFound bei fremdem Kalender (Ownership)', async () => {
      mockPrisma.calendar.findFirst.mockResolvedValue(null);
      await expect(
        service.createEvent('u1', {
          calendarId: 'fremd',
          title: 'X',
          startsAt: '2026-08-01T09:00:00.000Z',
          endsAt: '2026-08-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('read-only (synchronisierte Kalender)', () => {
    it('lehnt Termin-Erstellung in schreibgeschützten Kalendern ab', async () => {
      mockPrisma.calendar.findFirst.mockResolvedValue({ id: 'c-ics', readOnly: true });
      await expect(
        service.createEvent('u1', {
          calendarId: 'c-ics',
          title: 'X',
          startsAt: '2026-08-01T09:00:00.000Z',
          endsAt: '2026-08-01T10:00:00.000Z',
        }),
      ).rejects.toThrow('schreibgeschützt');
    });

    it('lehnt Bearbeiten und Löschen von Sync-Terminen ab', async () => {
      mockPrisma.calendarEvent.findFirst.mockResolvedValue({
        id: 'e1',
        startsAt: new Date(),
        endsAt: new Date(),
        calendar: { readOnly: true },
      });
      await expect(service.updateEvent('u1', 'e1', { title: 'Neu' })).rejects.toThrow(
        'schreibgeschützt',
      );
      await expect(service.removeEvent('u1', 'e1')).rejects.toThrow('schreibgeschützt');
      expect(mockPrisma.calendarEvent.update).not.toHaveBeenCalled();
      expect(mockPrisma.calendarEvent.delete).not.toHaveBeenCalled();
    });

    it('verhindert das direkte Löschen synchronisierter Kalender', async () => {
      mockPrisma.calendar.findFirst.mockResolvedValue({
        id: 'c-ics',
        integrationId: 'int1',
        isDefault: false,
      });
      await expect(service.removeCalendar('u1', 'c-ics')).rejects.toThrow('Integrationen');
    });

    it('wählt als Default-Ziel nie einen read-only Kalender', async () => {
      mockPrisma.calendar.findMany.mockResolvedValue([
        { id: 'c-ics', isDefault: false, readOnly: true },
        { id: 'c-local', isDefault: false, readOnly: false },
      ]);
      mockPrisma.calendarEvent.create.mockResolvedValue({});
      await service.createEvent('u1', {
        title: 'X',
        startsAt: '2026-08-01T09:00:00.000Z',
        endsAt: '2026-08-01T10:00:00.000Z',
      });
      expect(mockPrisma.calendarEvent.create.mock.calls[0][0].data.calendarId).toBe('c-local');
    });
  });

  describe('removeCalendar', () => {
    it('verweigert das Löschen des letzten Kalenders', async () => {
      mockPrisma.calendar.findFirst.mockResolvedValue({ id: 'c1', isDefault: true });
      mockPrisma.calendar.count.mockResolvedValue(1);
      await expect(service.removeCalendar('u1', 'c1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('notifyReminders', () => {
    it('meldet Termine im Erinnerungsfenster mit instanzgenauem dedupeKey', async () => {
      const soon = new Date(Date.now() + 10 * 60_000);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        {
          ...baseEvent,
          startsAt: soon,
          endsAt: new Date(soon.getTime() + 3_600_000),
          recurrence: null,
          reminderMinutes: 30,
          calendar: { userId: 'u1', name: 'Privat', color: null },
        },
      ]);
      mockNotifications.create.mockResolvedValue({});

      await service.notifyReminders();

      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      const arg = mockNotifications.create.mock.calls[0][0];
      expect(arg.type).toBe('EVENT_REMINDER');
      expect(arg.dedupeKey).toBe(`event-reminder:e1:${soon.toISOString()}`);
    });

    it('meldet nichts außerhalb des Erinnerungsfensters', async () => {
      const later = new Date(Date.now() + 2 * 3_600_000);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        {
          ...baseEvent,
          startsAt: later,
          endsAt: new Date(later.getTime() + 3_600_000),
          recurrence: null,
          reminderMinutes: 15,
          calendar: { userId: 'u1', name: 'Privat', color: null },
        },
      ]);

      await service.notifyReminders();
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });
  });
});
