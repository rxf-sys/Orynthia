import { beforeEach, describe, expect, it } from 'vitest';
import { useMealFlow } from '@/stores/flowStore';

describe('Kette Wochenplan → Liste → Ausgabe', () => {
  beforeEach(() => useMealFlow.getState().reset());

  it('startet mit Schritt 0 und ohne Daten', () => {
    const s = useMealFlow.getState();
    expect(s.step).toBe(0);
    expect(s.listId).toBeUndefined();
  });

  it('trägt die Übernahme-Daten in den nächsten Schritt', () => {
    useMealFlow.getState().startFromMealPlan({
      listId: 'l1',
      listName: 'Wocheneinkauf',
      added: 9,
      merged: 3,
      meals: 7,
    });
    const s = useMealFlow.getState();
    expect(s.step).toBe(1);
    expect(s.listId).toBe('l1');
    expect(s.added).toBe(9);
    expect(s.merged).toBe(3);
    expect(s.meals).toBe(7);
  });

  it('schließt mit der gebuchten Ausgabe ab', () => {
    useMealFlow
      .getState()
      .startFromMealPlan({ listId: 'l1', listName: 'W', added: 9, merged: 0, meals: 7 });
    useMealFlow.getState().bookedExpense({ transactionId: 't1', amount: 47.83 });
    const s = useMealFlow.getState();
    expect(s.step).toBe(2);
    expect(s.transactionId).toBe('t1');
    // Die Listendaten bleiben erhalten – die Fluss-Karte zeigt alle Schritte.
    expect(s.listId).toBe('l1');
    expect(s.meals).toBe(7);
  });

  it('vergisst eine alte Buchung, wenn die Kette neu startet', () => {
    useMealFlow
      .getState()
      .startFromMealPlan({ listId: 'l1', listName: 'W', added: 9, merged: 0, meals: 7 });
    useMealFlow.getState().bookedExpense({ transactionId: 't1', amount: 47.83 });
    useMealFlow
      .getState()
      .startFromMealPlan({ listId: 'l2', listName: 'X', added: 4, merged: 1, meals: 3 });

    const s = useMealFlow.getState();
    expect(s.step).toBe(1);
    // Sonst würde die Transaktionsliste weiter die Buchung des letzten
    // Durchlaufs markieren.
    expect(s.transactionId).toBeUndefined();
  });
});
