import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: PrismaService;

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    prisma = module.get<PrismaService>(PrismaService);
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
