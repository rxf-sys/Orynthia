import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';

describe('BudgetsService', () => {
  let service: BudgetsService;

  const mockPrisma = {
    budget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      groupBy: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return budgets with spent calculations', async () => {
      const mockBudgets = [
        {
          id: '1',
          userId: 'user1',
          categoryId: 'cat1',
          amount: 500,
          period: 'MONTHLY',
          isActive: true,
          category: { name: 'Lebensmittel', icon: '🛒', color: '#f59e0b' },
        },
      ];

      mockPrisma.budget.findMany.mockResolvedValue(mockBudgets);
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { categoryId: 'cat1', _sum: { amount: -300 } },
      ]);

      const result = await service.findAll('user1');

      expect(result).toHaveLength(1);
      expect(result[0].spent).toBe(300);
      expect(result[0].remaining).toBe(200);
      expect(result[0].percentage).toBe(60);
    });

    it('should return empty array when no budgets exist', async () => {
      mockPrisma.budget.findMany.mockResolvedValue([]);

      const result = await service.findAll('user1');

      expect(result).toEqual([]);
    });

    it('fragt die Monats-Periode als halboffenes Intervall ab (31.12. 14:00 zählt mit)', async () => {
      // 15. Dez 2026 — Monat mit 31 Tagen
      jest.useFakeTimers().setSystemTime(new Date(2026, 11, 15, 9, 0, 0));

      mockPrisma.budget.findMany.mockResolvedValue([
        {
          id: '1',
          userId: 'user1',
          categoryId: 'cat1',
          amount: 500,
          period: 'MONTHLY',
          isActive: true,
          category: { name: 'Lebensmittel', icon: '🛒', color: '#f59e0b' },
        },
      ]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      await service.findAll('user1');

      const where = mockPrisma.transaction.groupBy.mock.calls[0][0].where;
      // gte 1. Dez 00:00, lt 1. Jan 00:00 — eine Buchung am 31.12. 14:00 liegt
      // im Intervall. Mit dem alten `lte` auf 31.12. 00:00 fiel sie heraus.
      expect(where.date.gte).toEqual(new Date(2026, 11, 1));
      expect(where.date.lt).toEqual(new Date(2027, 0, 1));
      expect(where.date.lte).toBeUndefined();
      const lastDayAfternoon = new Date(2026, 11, 31, 14, 0, 0);
      expect(lastDayAfternoon >= where.date.gte && lastDayAfternoon < where.date.lt).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('create', () => {
    it('should create a budget', async () => {
      const mockBudget = {
        id: '1',
        userId: 'user1',
        categoryId: 'cat1',
        amount: 500,
        period: 'MONTHLY',
      };

      mockPrisma.category.findFirst.mockResolvedValue({ id: 'cat1', userId: 'user1' });
      mockPrisma.budget.create.mockResolvedValue(mockBudget);

      const result = await service.create('user1', {
        categoryId: 'cat1',
        amount: 500,
      });

      expect(result).toEqual(mockBudget);
      expect(mockPrisma.budget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            categoryId: 'cat1',
            amount: 500,
          }),
        }),
      );
    });

    it('should reject a category that does not belong to the user', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user1', { categoryId: 'foreign-cat', amount: 500 }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.budget.create).not.toHaveBeenCalled();
    });

    it('meldet ein Duplikat (Kategorie + Periode) als 409 Conflict statt 500', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: 'cat1', userId: 'user1' });
      mockPrisma.budget.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        service.create('user1', { categoryId: 'cat1', amount: 500 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when budget not found', async () => {
      mockPrisma.budget.findFirst.mockResolvedValue(null);

      await expect(service.remove('user1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete budget when found', async () => {
      mockPrisma.budget.findFirst.mockResolvedValue({ id: '1', userId: 'user1' });
      mockPrisma.budget.delete.mockResolvedValue({});

      const result = await service.remove('user1', '1');

      expect(result).toEqual({ message: 'Budget gelöscht' });
      expect(mockPrisma.budget.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
