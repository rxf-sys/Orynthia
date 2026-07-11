import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('AuthService (Multi-Device-Sessions)', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };
  const mockJwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const mockConfig = { get: jest.fn() };
  const mockMail = { send: jest.fn().mockResolvedValue(true) };

  const activeUser = {
    id: 'u1',
    email: 'test@example.com',
    passwordHash: '',
    isActive: true,
    twoFactorEnabled: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwt.signAsync.mockResolvedValue('signed-token');
    mockConfig.get.mockReturnValue(undefined);
    mockPrisma.userSession.findMany.mockResolvedValue([]); // Session-Limit: nichts zu kappen
  });

  describe('login', () => {
    it('legt pro Login eine neue Session an statt die bestehende zu überschreiben', async () => {
      const passwordHash = await bcrypt.hash('geheim123', 4);
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, passwordHash });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.userSession.create.mockResolvedValue({});

      await service.login({ email: 'test@example.com', password: 'geheim123' }, 'Firefox');
      await service.login({ email: 'test@example.com', password: 'geheim123' }, 'Safari');

      // Zwei Logins → zwei Sessions (Gerät B loggt Gerät A nicht mehr aus)
      expect(mockPrisma.userSession.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.userSession.update).not.toHaveBeenCalled();
      const [first, second] = mockPrisma.userSession.create.mock.calls.map((c) => c[0].data);
      expect(first.id).not.toBe(second.id);
      expect(first.userAgent).toBe('Firefox');
      // Refresh-Token liegt nur als Hash in der Session
      expect(first.tokenHash).not.toBe('signed-token');
      expect(await bcrypt.compare('signed-token', first.tokenHash)).toBe(true);
    });
  });

  describe('refreshTokens', () => {
    it('rotiert den Token innerhalb derselben Session', async () => {
      const tokenHash = await bcrypt.hash('alter-refresh', 4);
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.userSession.update.mockResolvedValue({});

      const result = await service.refreshTokens('u1', 's1', 'alter-refresh');

      expect(result.accessToken).toBe('signed-token');
      // Rotation: dieselbe Session wird aktualisiert, keine neue erzeugt
      expect(mockPrisma.userSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's1' } }),
      );
      expect(mockPrisma.userSession.create).not.toHaveBeenCalled();
      // sid bleibt im neuen Token erhalten
      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sid: 's1' }),
        expect.anything(),
      );
    });

    it('beendet die Session bei nicht passendem Token (Replay-Verdacht)', async () => {
      const tokenHash = await bcrypt.hash('richtiger-refresh', 4);
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      mockPrisma.userSession.delete.mockResolvedValue({});

      await expect(service.refreshTokens('u1', 's1', 'gestohlener-alter-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.userSession.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('weist abgelaufene Sessions ab', async () => {
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        tokenHash: 'x',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refreshTokens('u1', 's1', 'egal')).rejects.toThrow(UnauthorizedException);
    });

    it('weist Sessions eines anderen Users ab', async () => {
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'jemand-anderes',
        tokenHash: 'x',
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      await expect(service.refreshTokens('u1', 's1', 'egal')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('beendet nur die eigene Session — andere Geräte bleiben angemeldet', async () => {
      mockPrisma.userSession.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('u1', 's1');

      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1', userId: 'u1' },
      });
    });

    it('beendet ohne Session-ID alle Sessions (Legacy-Token)', async () => {
      mockPrisma.userSession.deleteMany.mockResolvedValue({ count: 3 });

      await service.logout('u1', null);

      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('refreshFromCookie', () => {
    it('lehnt Alt-Tokens ohne Session-ID ab', async () => {
      mockJwt.verifyAsync.mockResolvedValue({ sub: 'u1' }); // kein sid

      await expect(service.refreshFromCookie('legacy-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('listSessions', () => {
    it('markiert die aktuelle Session', async () => {
      mockPrisma.userSession.findMany.mockResolvedValue([
        { id: 's1', userAgent: 'Firefox', createdAt: new Date(), lastUsedAt: new Date() },
        { id: 's2', userAgent: 'Safari', createdAt: new Date(), lastUsedAt: new Date() },
      ]);

      const sessions = await service.listSessions('u1', 's2');

      expect(sessions.find((s) => s.id === 's2')!.current).toBe(true);
      expect(sessions.find((s) => s.id === 's1')!.current).toBe(false);
    });
  });
});
