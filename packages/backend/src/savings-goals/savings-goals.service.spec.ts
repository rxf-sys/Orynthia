import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SavingsGoalsService } from './savings-goals.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SavingsGoalsService', () => {
  let service: SavingsGoalsService;

  const mockPrisma = {
    savingsGoal: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SavingsGoalsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SavingsGoalsService>(SavingsGoalsService);
    jest.clearAllMocks();
  });

  describe('addAmount', () => {
    it('uses an atomic increment instead of read-modify-write', async () => {
      mockPrisma.savingsGoal.findFirst.mockResolvedValue({
        id: 'g1',
        currentAmount: 100,
        targetAmount: 1000,
        isCompleted: false,
      });
      mockPrisma.savingsGoal.update.mockResolvedValue({
        id: 'g1',
        currentAmount: 200,
        targetAmount: 1000,
        isCompleted: false,
      });

      await service.addAmount('u1', 'g1', 100);

      expect(mockPrisma.savingsGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentAmount: { increment: 100 } },
        }),
      );
    });

    it('marks the goal completed when the target is reached', async () => {
      mockPrisma.savingsGoal.findFirst.mockResolvedValue({
        id: 'g1',
        currentAmount: 900,
        targetAmount: 1000,
        isCompleted: false,
      });
      mockPrisma.savingsGoal.update
        .mockResolvedValueOnce({
          id: 'g1',
          currentAmount: 1000,
          targetAmount: 1000,
          isCompleted: false,
        })
        .mockResolvedValueOnce({
          id: 'g1',
          currentAmount: 1000,
          targetAmount: 1000,
          isCompleted: true,
        });

      const result = await service.addAmount('u1', 'g1', 100);

      expect(result.isCompleted).toBe(true);
    });

    it('rejects withdrawals below zero', async () => {
      mockPrisma.savingsGoal.findFirst.mockResolvedValue({
        id: 'g1',
        currentAmount: 50,
        targetAmount: 1000,
        isCompleted: false,
      });

      await expect(service.addAmount('u1', 'g1', -100)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.savingsGoal.update).not.toHaveBeenCalled();
    });
  });
});
