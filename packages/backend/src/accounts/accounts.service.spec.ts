import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;

  const mockPrisma = {
    bankAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return active accounts for a user', async () => {
      const mockAccounts = [
        { id: '1', bankName: 'Sparkasse', accountName: 'Girokonto', balance: 1000 },
      ];
      mockPrisma.bankAccount.findMany.mockResolvedValue(mockAccounts);

      const result = await service.findAll('user1');

      expect(result).toEqual(mockAccounts);
      expect(mockPrisma.bankAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user1', isActive: true },
        }),
      );
    });
  });

  describe('getTotalBalance', () => {
    it('should calculate total balance across accounts', async () => {
      mockPrisma.bankAccount.findMany.mockResolvedValue([
        { id: '1', balance: 1000 },
        { id: '2', balance: 2500.50 },
      ]);

      const result = await service.getTotalBalance('user1');

      expect(result.totalBalance).toBe(3500.50);
      expect(result.accountCount).toBe(2);
      expect(result.currency).toBe('EUR');
    });
  });

  describe('create', () => {
    it('should create a new account with defaults', async () => {
      const dto = { bankName: 'Sparkasse', accountName: 'Girokonto' };
      mockPrisma.bankAccount.create.mockResolvedValue({ id: '1', ...dto });

      const result = await service.create('user1', dto);

      expect(result).toBeDefined();
      expect(mockPrisma.bankAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          bankName: 'Sparkasse',
          accountName: 'Girokonto',
          accountType: 'CHECKING',
          balance: 0,
        }),
      });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException for non-existing account', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user1', 'nonexistent', { bankName: 'Neue Bank' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update account when found', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.bankAccount.update.mockResolvedValue({ id: '1', bankName: 'Neue Bank' });

      const result = await service.update('user1', '1', { bankName: 'Neue Bank' });

      expect(result.bankName).toBe('Neue Bank');
    });
  });

  describe('remove', () => {
    it('should soft-delete account by setting isActive to false', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.bankAccount.update.mockResolvedValue({ id: '1', isActive: false });

      const result = await service.remove('user1', '1');

      expect(result.message).toBe('Konto deaktiviert');
      expect(mockPrisma.bankAccount.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });
    });
  });
});
