import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';

// Datums-Keys entstehen im Service über lokale Mitternacht + toISOString —
// feste Zeitzone, damit die Erwartungswerte auf jedem Runner gleich sind.
process.env.TZ = 'UTC';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {
    bankAccount: { findMany: jest.fn() },
    recurringPayment: { findMany: jest.fn() },
    contract: { findMany: jest.fn() },
    transaction: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    category: { findMany: jest.fn() },
    notification: { count: jest.fn() },
  };
  const mockContracts = { compareProviders: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ContractsService, useValue: mockContracts },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDashboardData — Monatsgrenzen', () => {
    it('zählt Buchungen am Monatsletzten mit (Intervall [Monatsanfang, Folgemonat))', async () => {
      // 15. Dez 2026 — der Dezember hat 31 Tage
      jest.useFakeTimers().setSystemTime(new Date(2026, 11, 15, 10, 0, 0));

      mockPrisma.bankAccount.findMany.mockResolvedValue([]);
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.getDashboardData('u1');

      // Aggregation des aktuellen Monats: gte 1. Dez, lt 1. Jan (exklusiv).
      // Ein `lte` auf den 31. Dez 00:00 würde eine Buchung am 31.12. 14:00
      // verlieren — genau der Bug, den dieser Test festnagelt.
      const monthlyWhere = mockPrisma.transaction.aggregate.mock.calls[0][0].where;
      expect(monthlyWhere.date.gte).toEqual(new Date(2026, 11, 1));
      expect(monthlyWhere.date.lt).toEqual(new Date(2027, 0, 1));
      expect(monthlyWhere.date.lte).toBeUndefined();

      // Vormonat: gte 1. Nov, lt 1. Dez
      const lastMonthWhere = mockPrisma.transaction.aggregate.mock.calls[2][0].where;
      expect(lastMonthWhere.date.gte).toEqual(new Date(2026, 10, 1));
      expect(lastMonthWhere.date.lt).toEqual(new Date(2026, 11, 1));
    });

    it('summiert Kontostände über Cents (kein Float-Drift)', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 11, 15));

      // 0.1 + 0.2 → als Float 0.30000000000000004
      mockPrisma.bankAccount.findMany.mockResolvedValue([{ balance: 0.1 }, { balance: 0.2 }]);
      mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.getDashboardData('u1');

      expect(result.overview.totalBalance).toBe(0.3);
    });
  });

  describe('getForecast — Monatsend-Termine', () => {
    it('hält eine monatliche Zahlung am 31. auf dem Monatsletzten (kein Drift)', async () => {
      jest.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 0, 15, 12)));

      mockPrisma.bankAccount.findMany.mockResolvedValue([{ balance: 5000 }]);
      mockPrisma.recurringPayment.findMany.mockResolvedValue([
        {
          name: 'Miete',
          amount: -1000,
          frequency: 'MONTHLY',
          nextDueDate: new Date(Date.UTC(2026, 0, 31)),
          counterpartName: null,
        },
      ]);
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const forecast = await service.getForecast('u1', 90);

      const scheduledDates = forecast.points
        .filter((p) => p.items.length > 0)
        .map((p) => p.date);

      // 31. Jan → 28. Feb (klemmt) → 31. Mär (kehrt zum Monatsletzten zurück).
      // Mit naivem setMonth wäre es 31. Jan → 3. Mär → 3. Apr gewesen.
      expect(scheduledDates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);

      // Projektion: 5000 − 3 × 1000, verlustfrei über Cents
      expect(forecast.endBalance).toBe(2000);
      expect(forecast.totalOut).toBe(3000);
    });
  });
});
