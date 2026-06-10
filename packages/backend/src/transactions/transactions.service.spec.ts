import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockPrisma = {
    bankAccount: { findFirst: jest.fn() },
    category: { findFirst: jest.fn() },
    transaction: { create: jest.fn() },
  };

  const mockNotifications = {
    maybeNotifyLargeTransaction: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
  });

  describe('create – authorization', () => {
    const dto = {
      bankAccountId: 'acc1',
      amount: -10,
      date: '2026-06-01',
      categoryId: 'cat1',
    };

    it('rejects a bank account that does not belong to the user', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

      await expect(service.create('attacker', dto)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('rejects a category that does not belong to the user (IDOR)', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: 'acc1', userId: 'attacker' });
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(service.create('attacker', dto)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('accepts own or system categories', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: 'acc1', userId: 'u1' });
      mockPrisma.category.findFirst.mockResolvedValue({ id: 'cat1', isSystem: true });
      mockPrisma.transaction.create.mockResolvedValue({ id: 't1', amount: -10 });

      const result = await service.create('u1', dto);

      expect(result).toEqual({ id: 't1', amount: -10 });
    });
  });
});
