import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarProvider, SyncTokenExpiredError } from './google.provider';

describe('GoogleCalendarProvider', () => {
  let provider: GoogleCalendarProvider;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  beforeEach(() => {
    const config = {
      get: (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          FRONTEND_URL: 'https://orynthia.example',
        })[key],
    } as unknown as ConfigService;
    provider = new GoogleCalendarProvider(config);
  });

  describe('state (CSRF-Schutz)', () => {
    it('akzeptiert einen frisch erzeugten State nur für denselben User', () => {
      const state = provider.buildState('user-1');
      expect(() => provider.verifyState(state, 'user-1')).not.toThrow();
      expect(() => provider.verifyState(state, 'user-2')).toThrow(BadRequestException);
      expect(() => provider.verifyState('manipuliert', 'user-1')).toThrow(BadRequestException);
    });
  });

  describe('buildAuthUrl', () => {
    it('enthält readonly-Scope, offline-Access und Redirect auf /calendar', () => {
      const url = new URL(provider.buildAuthUrl('user-1'));
      expect(url.searchParams.get('scope')).toContain('calendar.readonly');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('redirect_uri')).toBe('https://orynthia.example/calendar');
      expect(url.searchParams.get('state')).toBeTruthy();
    });
  });

  describe('listEvents', () => {
    it('mappt Events, sammelt cancelled und liefert nextSyncToken', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'ev1',
                summary: 'Meeting',
                start: { dateTime: '2026-08-01T10:00:00Z' },
                end: { dateTime: '2026-08-01T11:00:00Z' },
                etag: '"e1"',
              },
              {
                id: 'ev2',
                summary: 'Ganztag',
                start: { date: '2026-08-02' },
                end: { date: '2026-08-03' }, // exklusiv
              },
              { id: 'ev3', status: 'cancelled' },
            ],
            nextSyncToken: 'sync-123',
          }),
      }) as unknown as typeof fetch;

      const page = await provider.listEvents('token', 'primary', {});
      expect(page.upserts).toHaveLength(2);
      expect(page.cancelledIds).toEqual(['ev3']);
      expect(page.nextSyncToken).toBe('sync-123');

      const allDay = page.upserts.find((e) => e.externalId === 'ev2')!;
      expect(allDay.isAllDay).toBe(true);
      // Exklusives Enddatum → Ende bleibt am 2.8., nicht 3.8.
      expect(allDay.endsAt.toISOString().slice(0, 10)).toBe('2026-08-02');
    });

    it('wirft SyncTokenExpiredError bei HTTP 410', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 410 }) as unknown as typeof fetch;
      await expect(provider.listEvents('token', 'primary', { syncToken: 'alt' })).rejects.toThrow(
        SyncTokenExpiredError,
      );
    });
  });
});
