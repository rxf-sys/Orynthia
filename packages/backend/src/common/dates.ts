/**
 * Monats-Arithmetik ohne Drift.
 *
 * Naives `setMonth(+1)` auf einem 31. läuft in den Folgemonat über
 * (31. Jan → 3. März), wodurch Zahlungstermine am Monatsende in Projektionen
 * wandern. `addMonthsClamped` merkt sich den gewünschten Ziel-Tag (anchorDay)
 * und klemmt ihn auf den letzten Tag des Zielmonats — 31. Jan → 28. Feb →
 * (mit anchorDay 31) wieder 31. März.
 */

export function addMonthsClamped(date: Date, months: number, anchorDay?: number): Date {
  const day = anchorDay ?? date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

/**
 * Nächster Fälligkeitstermin für eine Zahlungsfrequenz. `anchorDay` ist der
 * ursprüngliche Monatstag der Zahlung (z. B. 31), damit Monatsend-Termine
 * nach einem kurzen Monat nicht dauerhaft auf dem 28. hängen bleiben.
 */
export function addFrequency(date: Date, freq: string, anchorDay?: number): Date {
  const next = new Date(date);
  switch (freq) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      return next;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      return next;
    case 'QUARTERLY':
      return addMonthsClamped(date, 3, anchorDay);
    case 'BIANNUALLY':
      return addMonthsClamped(date, 6, anchorDay);
    case 'YEARLY':
      return addMonthsClamped(date, 12, anchorDay);
    case 'MONTHLY':
    default:
      return addMonthsClamped(date, 1, anchorDay);
  }
}

/** Frequenz → monatlicher Faktor (52/12 bzw. 26/12, konsistent app-weit). */
export function frequencyToMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'WEEKLY':
      return amount * (52 / 12);
    case 'BIWEEKLY':
      return amount * (26 / 12);
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'BIANNUALLY':
      return amount / 6;
    case 'YEARLY':
      return amount / 12;
    default:
      return amount;
  }
}
