import { BadRequestException } from '@nestjs/common';
import { IcsProvider } from './ics.provider';

const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//DE',
  'X-WR-CALNAME:Test-Feed',
  'BEGIN:VEVENT',
  'UID:single-1',
  'SUMMARY:Einzeltermin',
  'LOCATION:Berlin',
  'DTSTART:20260810T090000Z',
  'DTEND:20260810T100000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly-1',
  'SUMMARY:Wöchentlich',
  'DTSTART:20260803T120000Z',
  'DTEND:20260803T130000Z',
  'RRULE:FREQ=WEEKLY;COUNT=4',
  'EXDATE:20260817T120000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:old-1',
  'SUMMARY:Lange vorbei',
  'DTSTART:20200101T090000Z',
  'DTEND:20200101T100000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('IcsProvider', () => {
  const provider = new IcsProvider();
  const window = { from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-09-01T00:00:00Z') };

  const mockFetch = (body: string, ok = true, status = 200) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status,
      text: () => Promise.resolve(body),
    }) as unknown as typeof fetch;
  };

  describe('validateUrl', () => {
    it('akzeptiert https und wandelt webcal:// um', () => {
      expect(provider.validateUrl('webcal://example.com/feed.ics')).toBe(
        'https://example.com/feed.ics',
      );
    });

    it('lehnt ungültige URLs und fremde Protokolle ab', () => {
      expect(() => provider.validateUrl('kein url')).toThrow(BadRequestException);
      expect(() => provider.validateUrl('file:///etc/passwd')).toThrow(BadRequestException);
    });
  });

  describe('fetchInstances', () => {
    it('parst Einzeltermine und expandiert RRULE mit EXDATE im Fenster', async () => {
      mockFetch(FEED);
      const { name, instances } = await provider.fetchInstances('https://x.test/f.ics', window);

      expect(name).toBe('Test-Feed');
      const titles = instances.map((i) => i.title);
      expect(titles).toContain('Einzeltermin');
      // 4 wöchentliche Instanzen minus 1 EXDATE (17.08.) = 3
      expect(instances.filter((i) => i.title === 'Wöchentlich')).toHaveLength(3);
      // Termin außerhalb des Fensters wird nicht importiert
      expect(titles).not.toContain('Lange vorbei');

      const single = instances.find((i) => i.title === 'Einzeltermin')!;
      expect(single.externalId).toBe('single-1');
      expect(single.location).toBe('Berlin');
      expect(single.endsAt.getTime() - single.startsAt.getTime()).toBe(3_600_000);

      // Serien-Instanzen bekommen eindeutige externalIds
      const weeklyIds = instances.filter((i) => i.title === 'Wöchentlich').map((i) => i.externalId);
      expect(new Set(weeklyIds).size).toBe(3);
      weeklyIds.forEach((id) => expect(id.startsWith('weekly-1:')).toBe(true));
    });

    it('lehnt Nicht-ICS-Antworten ab', async () => {
      mockFetch('<html>nope</html>');
      await expect(provider.fetchInstances('https://x.test/f.ics', window)).rejects.toThrow(
        'kein iCalendar-Feed',
      );
    });

    it('lehnt HTTP-Fehler ab', async () => {
      mockFetch('', false, 404);
      await expect(provider.fetchInstances('https://x.test/f.ics', window)).rejects.toThrow(
        'HTTP 404',
      );
    });
  });
});
