import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_NOTIFICATION_SETTINGS = {
  budgetWarnings: true,
  newTransactions: true,
  weeklyReport: true,
  monthlyReport: true,
  unusualActivity: true,
  savingsGoals: false,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        twoFactorEnabled: true,
        isEmailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) throw new NotFoundException('Benutzer nicht gefunden');
    return user;
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new BadRequestException('Aktuelles Passwort ist falsch');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      // Refresh-Token mit invalidieren: ein kompromittierter Token darf den
      // Passwortwechsel nicht überleben (konsistent mit resetPassword).
      data: { passwordHash, refreshToken: null },
    });

    return { message: 'Passwort erfolgreich geändert' };
  }

  async getNotificationSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSettings: true },
    });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...((user.notificationSettings as object) ?? {}) };
  }

  async updateNotificationSettings(userId: string, settings: Record<string, boolean | undefined>) {
    const current = await this.getNotificationSettings(userId);
    const merged = { ...current, ...JSON.parse(JSON.stringify(settings)) };
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationSettings: merged },
    });
    return merged;
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new BadRequestException('Passwort ist falsch');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Konto erfolgreich gelöscht' };
  }
}
