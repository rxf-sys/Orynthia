import { addMonthsClamped, addFrequency, frequencyToMonthly } from './dates';

describe('dates (Monats-Arithmetik ohne Drift)', () => {
  describe('addMonthsClamped', () => {
    it('klemmt den 31. Januar auf den 28. Februar statt in den März zu laufen', () => {
      // Naives setMonth(+1): 31. Jan → 3. März
      const naive = new Date(2026, 0, 31);
      naive.setMonth(naive.getMonth() + 1);
      expect(naive.getMonth()).toBe(2); // März — der Bug

      const clamped = addMonthsClamped(new Date(2026, 0, 31), 1);
      expect(clamped.getFullYear()).toBe(2026);
      expect(clamped.getMonth()).toBe(1); // Februar
      expect(clamped.getDate()).toBe(28);
    });

    it('kehrt mit anchorDay nach einem kurzen Monat zum Monatsletzten zurück', () => {
      // 31. Jan → 28. Feb → 31. Mär (nicht dauerhaft 28.)
      const feb = addMonthsClamped(new Date(2026, 0, 31), 1, 31);
      const mar = addMonthsClamped(feb, 1, 31);
      expect(feb.getDate()).toBe(28);
      expect(mar.getMonth()).toBe(2);
      expect(mar.getDate()).toBe(31);
    });

    it('behandelt Schaltjahre (31. Jan 2028 → 29. Feb 2028)', () => {
      const feb = addMonthsClamped(new Date(2028, 0, 31), 1, 31);
      expect(feb.getMonth()).toBe(1);
      expect(feb.getDate()).toBe(29);
    });

    it('unterstützt negative Monats-Schritte', () => {
      const d = addMonthsClamped(new Date(2026, 4, 31), -3, 31); // 31. Mai − 3M
      expect(d.getMonth()).toBe(1); // Februar
      expect(d.getDate()).toBe(28);
    });
  });

  describe('addFrequency', () => {
    it('MONTHLY am 31. driftet über ein Jahr nicht', () => {
      let d = new Date(2026, 0, 31);
      const days: number[] = [];
      for (let i = 0; i < 12; i++) {
        d = addFrequency(d, 'MONTHLY', 31);
        days.push(d.getDate());
      }
      // Feb 28, dann immer der Monatsletzte — nie ein Übersprung in den Folgemonat
      expect(days).toEqual([28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 31]);
      expect(d.getFullYear()).toBe(2027);
      expect(d.getMonth()).toBe(0); // wieder Januar
    });

    it('WEEKLY addiert exakt 7 Tage', () => {
      const d = addFrequency(new Date(2026, 5, 30), 'WEEKLY');
      expect(d.getDate()).toBe(7);
      expect(d.getMonth()).toBe(6);
    });

    it('YEARLY klemmt den 29. Februar auf den 28. im Folgejahr', () => {
      const d = addFrequency(new Date(2028, 1, 29), 'YEARLY', 29);
      expect(d.getFullYear()).toBe(2029);
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(28);
    });
  });

  describe('frequencyToMonthly', () => {
    it('nutzt die exakten Faktoren 52/12 und 26/12', () => {
      expect(frequencyToMonthly(12, 'WEEKLY')).toBe(52);
      expect(frequencyToMonthly(12, 'BIWEEKLY')).toBe(26);
      expect(frequencyToMonthly(120, 'YEARLY')).toBe(10);
      expect(frequencyToMonthly(30, 'QUARTERLY')).toBe(10);
      expect(frequencyToMonthly(60, 'BIANNUALLY')).toBe(10);
      expect(frequencyToMonthly(10, 'MONTHLY')).toBe(10);
    });
  });
});
