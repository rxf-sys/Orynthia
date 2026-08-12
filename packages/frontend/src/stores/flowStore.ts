import { create } from 'zustand';

/**
 * Die modulübergreifende Kette Wochenplan → Einkaufsliste → Ausgabe.
 *
 * Der Fortschritt ist **Zustand**, kein Text: jeder Schritt trägt die
 * Daten, die der nächste braucht, und die Oberfläche zeigt daraus, wo man
 * gerade steht. Deshalb liegt das hier und nicht als Erfolgsmeldung in
 * einem Toast, der beim nächsten Klick verschwunden ist.
 *
 * Bewusst nicht persistiert: die Kette ist eine Handlung innerhalb einer
 * Sitzung. Ein Reload beendet sie – das ist ehrlicher, als einen
 * Fortschritt anzuzeigen, dessen Anlass niemand mehr erinnert.
 */
export type FlowStep = 0 | 1 | 2 | 3;

interface MealFlowState {
  /** 0 = nicht gestartet, 1 = Zutaten übernommen, 2 = Ausgabe gebucht */
  step: FlowStep;
  listId?: string;
  listName?: string;
  /** Wie viele Zutaten neu hinzukamen bzw. zusammengeführt wurden. */
  added?: number;
  merged?: number;
  meals?: number;
  /** Die gebuchte Ausgabe, damit die Transaktionsliste sie hervorheben kann. */
  transactionId?: string;
  amount?: number;

  startFromMealPlan: (data: {
    listId: string;
    listName: string;
    added: number;
    merged: number;
    meals: number;
  }) => void;
  bookedExpense: (data: { transactionId: string; amount: number }) => void;
  reset: () => void;
}

export const useMealFlow = create<MealFlowState>((set) => ({
  step: 0,

  startFromMealPlan: ({ listId, listName, added, merged, meals }) =>
    set({ step: 1, listId, listName, added, merged, meals, transactionId: undefined }),

  bookedExpense: ({ transactionId, amount }) => set({ step: 2, transactionId, amount }),

  reset: () => set({ step: 0, listId: undefined, listName: undefined, transactionId: undefined }),
}));
