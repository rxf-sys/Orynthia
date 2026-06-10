import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockPrisma = {
    category: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      updateMany: jest.fn(),
    },
    budget: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  describe('remove', () => {
    it('rejects system categories and foreign categories', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 'sys-cat')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('removes category, detaches transactions and deletes budgets atomically', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1', isSystem: false });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.remove('u1', 'c1');

      expect(result).toEqual({ message: 'Kategorie gelöscht' });
      // Alle drei Schritte laufen in EINER Transaktion (kein halb bereinigter Zustand)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { categoryId: 'c1' },
        data: { categoryId: null },
      });
      expect(mockPrisma.budget.deleteMany).toHaveBeenCalledWith({ where: { categoryId: 'c1' } });
      expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });
});
