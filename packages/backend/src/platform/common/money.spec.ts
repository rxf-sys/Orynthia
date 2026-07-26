import { toCents, fromCents, roundMoney, sumMoney } from './money';

describe('money (Cent-Arithmetik)', () => {
  it('konvertiert Beträge verlustfrei in Cents und zurück', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents('12.34')).toBe(1234);
    expect(toCents({ toNumber: () => 12.34 })).toBe(1234); // Prisma.Decimal-Shape
    expect(fromCents(1234)).toBe(12.34);
  });

  it('vermeidet den klassischen Float-Drift (0.1 + 0.2)', () => {
    // Float-Addition: 0.1 + 0.2 = 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe(0.3);
  });

  it('summiert viele kleine Beträge ohne Drift', () => {
    // 100 × 0.07 € = 7.00 € — als Float 7.000000000000001
    const items = Array.from({ length: 100 }, () => ({ amount: 0.07 }));
    const floatSum = items.reduce((s, i) => s + i.amount, 0);
    expect(floatSum).not.toBe(7);
    expect(sumMoney(items, (i) => i.amount)).toBe(7);
  });

  it('rundet kaufmännisch auf 2 Nachkommastellen', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(129.999999)).toBe(130);
    expect(roundMoney(-3.335)).toBe(-3.33); // Math.round bei negativen Werten
  });

  it('behandelt ungültige Eingaben als 0', () => {
    expect(toCents(NaN)).toBe(0);
    expect(toCents('kein-betrag')).toBe(0);
    expect(toCents(Infinity)).toBe(0);
  });
});
