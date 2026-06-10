import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('changePassword', () => {
    it('invalidates the stored refresh token together with the password change', async () => {
      const passwordHash = await bcrypt.hash('altesPasswort1', 4);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });
      mockPrisma.user.update.mockResolvedValue({});

      await service.changePassword('u1', 'altesPasswort1', 'neuesPasswort1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refreshToken: null }),
        }),
      );
    });

    it('rejects a wrong current password', async () => {
      const passwordHash = await bcrypt.hash('richtig123', 4);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });

      await expect(service.changePassword('u1', 'falsch123', 'neuesPasswort1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('requires the correct password before deleting', async () => {
      const passwordHash = await bcrypt.hash('geheim123', 4);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });

      await expect(service.deleteAccount('u1', 'falsches-passwort')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes the account with the correct password', async () => {
      const passwordHash = await bcrypt.hash('geheim123', 4);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.deleteAccount('u1', 'geheim123');

      expect(result).toEqual({ message: 'Konto erfolgreich gelöscht' });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });

  describe('notification settings', () => {
    it('merges stored settings over defaults', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        notificationSettings: { weeklyReport: false },
      });

      const settings = await service.getNotificationSettings('u1');

      expect(settings.weeklyReport).toBe(false);
      expect(settings.budgetWarnings).toBe(true);
    });
  });
});
