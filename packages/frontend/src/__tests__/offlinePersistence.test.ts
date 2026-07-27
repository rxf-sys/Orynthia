import { describe, expect, it } from 'vitest';
import type { Query } from '@tanstack/react-query';
import { isPersistable } from '@/platform/offline/persistence';

/** Minimaler Query-Stub – `isPersistable` liest nur Key und Status. */
const query = (key: unknown[], status: 'success' | 'error' | 'pending' = 'success') =>
  ({ queryKey: key, state: { status } }) as unknown as Query;

describe('Offline-Cache: was persistiert werden darf', () => {
  it('behält Alltags-Module', () => {
    expect(isPersistable(query(['tasks']))).toBe(true);
    expect(isPersistable(query(['calendar-events', '2026-07']))).toBe(true);
    expect(isPersistable(query(['notes', '', null]))).toBe(true);
    expect(isPersistable(query(['habits', false]))).toBe(true);
  });

  it('persistiert keine Finanz- und Banking-Daten', () => {
    for (const key of [
      'transactions',
      'accounts',
      'accounts-balance',
      'bank-connections',
      'budgets',
      'dashboard',
      'investments',
      'contracts',
      'savings-goals',
      'institutions',
    ]) {
      expect(isPersistable(query([key])), `${key} darf nicht im localStorage landen`).toBe(false);
    }
  });

  it('persistiert weder Dokumente noch Suche oder Assistent', () => {
    expect(isPersistable(query(['documents']))).toBe(false);
    expect(isPersistable(query(['document-tags']))).toBe(false);
    expect(isPersistable(query(['global-search', 'miete']))).toBe(false);
    expect(isPersistable(query(['chat-status']))).toBe(false);
  });

  it('konserviert keine Fehlerzustände', () => {
    expect(isPersistable(query(['tasks'], 'error'))).toBe(false);
    expect(isPersistable(query(['tasks'], 'pending'))).toBe(false);
  });

  it('kommt mit nicht-textuellen Query-Keys klar', () => {
    expect(isPersistable(query([{ scope: 'tasks' }]))).toBe(false);
    expect(isPersistable(query([]))).toBe(false);
  });
});
