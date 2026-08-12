import { describe, expect, it } from 'vitest';
import {
  FORECAST_BUFFER,
  budgetStatus,
  dueStatus,
  forecastStatus,
  monthStatus,
  pace,
  paceHint,
  positionStatus,
  STATUS_STYLE,
  taskStatus,
} from '@/lib/status';
import { CATEGORY_PALETTE } from '@/lib/categoryColors';

describe('Statusableitung', () => {
  it('Budget: über 100 % kritisch, über 80 % knapp', () => {
    expect(budgetStatus(43)).toBe('ok');
    expect(budgetStatus(80)).toBe('ok');
    expect(budgetStatus(80.1)).toBe('warn');
    expect(budgetStatus(100)).toBe('warn');
    expect(budgetStatus(100.1)).toBe('crit');
  });

  it('Prognose misst gegen den Puffer, nicht gegen Null', () => {
    expect(forecastStatus(2000)).toBe('ok');
    expect(forecastStatus(FORECAST_BUFFER)).toBe('ok');
    // Das ist der Punkt der Regel: knapp über Null ist bereits ein Warnfall.
    expect(forecastStatus(FORECAST_BUFFER - 1)).toBe('warn');
    expect(forecastStatus(1)).toBe('warn');
    expect(forecastStatus(-0.01)).toBe('crit');
  });

  it('Depot: Status je Position aus deren Ergebnis', () => {
    expect(positionStatus(292.8)).toBe('ok');
    expect(positionStatus(0)).toBe('ok');
    expect(positionStatus(-217.5)).toBe('crit');
  });

  it('Cashflow: Status aus dem Monatssaldo', () => {
    expect(monthStatus(1298)).toBe('ok');
    expect(monthStatus(-42)).toBe('crit');
  });

  it('Fristen: ab 5 Tagen warnend, bis 60 Tage Info', () => {
    expect(dueStatus(3)).toBe('warn');
    expect(dueStatus(5)).toBe('warn');
    expect(dueStatus(6)).toBe('info');
    expect(dueStatus(60)).toBe('info');
    expect(dueStatus(61)).toBe('ok');
  });

  it('Aufgaben: überfällig, heute, später', () => {
    const now = new Date('2026-08-11T12:00:00');
    expect(taskStatus(new Date('2026-08-06T09:00:00'), now)).toBe('crit');
    expect(taskStatus(new Date('2026-08-11T18:00:00'), now)).toBe('info');
    expect(taskStatus(new Date('2026-08-20T09:00:00'), now)).toBe('idle');
    expect(taskStatus(null, now)).toBe('idle');
  });
});

describe('Erwarteter Monatsverlauf', () => {
  it('rechnet den Monatsfortschritt in Prozent', () => {
    expect(pace(new Date(2026, 7, 11))).toBe(35); // 11. von 31 Tagen
    expect(pace(new Date(2026, 7, 31))).toBe(100);
    expect(pace(new Date(2026, 1, 14))).toBe(50); // Februar 2026: 28 Tage
  });

  it('ordnet den Verbrauch gegen den Monatsverlauf ein', () => {
    expect(paceHint(87, 35)).toBe('schneller als der Monat');
    expect(paceHint(10, 35)).toBe('langsamer als der Monat');
    expect(paceHint(38, 35)).toBe('im Takt des Monats');
  });
});

describe('Farbachsen bleiben getrennt', () => {
  it('die kategoriale Skala enthält kein Grün und kein Rot', () => {
    // Sonst läse man in einem Kategorie-Donut eine Bewertung mit.
    const forbidden = ['#1f8a5b', '#e76b8d', '#12855c', '#c01a2f', '#22c58a', '#f2596b'];
    for (const hex of CATEGORY_PALETTE) {
      expect(forbidden).not.toContain(hex.toLowerCase());
    }
  });

  it('jeder Status trägt Farbe, Icon und Label – nie Farbe allein', () => {
    for (const kind of ['ok', 'warn', 'crit', 'info', 'idle'] as const) {
      const style = STATUS_STYLE[kind];
      expect(style.color).toMatch(/^var\(--/);
      // lucide-Icons sind forwardRef-Objekte, keine nackten Funktionen
      expect(style.icon).toBeTruthy();
      expect(style.label.length).toBeGreaterThan(0);
    }
  });
});
