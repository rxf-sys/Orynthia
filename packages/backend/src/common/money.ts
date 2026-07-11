/**
 * Cent-basierte Geldarithmetik.
 *
 * Postgres speichert Beträge korrekt als Decimal(12,2), aber sobald sie in
 * JS landen, wird mit IEEE-754-Floats gerechnet — Summen wie 0.1 + 0.2
 * driften (0.30000000000000004). Alle Aggregationen im Service-Layer laufen
 * deshalb über Integer-Cents: erst nach Cents konvertieren, dort addieren,
 * am Ende zurück in Euro.
 */

/** Akzeptiert number, numerische Strings und Prisma.Decimal (via toNumber). */
export type MoneyInput = number | string | { toNumber(): number };

export function toCents(value: MoneyInput): number {
  const num =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : value.toNumber();
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Rundet einen Betrag kaufmännisch auf 2 Nachkommastellen (über Cents). */
export function roundMoney(value: MoneyInput): number {
  return fromCents(toCents(value));
}

/** Summiert Beträge verlustfrei über Integer-Cents. */
export function sumMoney<T>(items: Iterable<T>, pick: (item: T) => MoneyInput): number {
  let cents = 0;
  for (const item of items) cents += toCents(pick(item));
  return fromCents(cents);
}
