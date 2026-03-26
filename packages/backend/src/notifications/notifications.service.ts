import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string, filters?: { unreadOnly?: boolean }) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(filters?.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Benachrichtigung nicht gefunden');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, message, data: data ?? undefined },
    });
  }

  async delete(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Benachrichtigung nicht gefunden');

    await this.prisma.notification.delete({ where: { id: notificationId } });
    return { message: 'Benachrichtigung gelöscht' };
  }

  // --------------- Check-Methoden ---------------

  async checkBudgets(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
      include: { category: { select: { name: true } } },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    for (const budget of budgets) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          bankAccount: { userId },
          categoryId: budget.categoryId,
          amount: { lt: 0 },
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      });

      const spentAmount = Math.abs(Number(spent._sum.amount || 0));
      const budgetAmount = Number(budget.amount);
      const percentage = budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0;

      if (percentage >= 100) {
        await this.create(
          userId,
          NotificationType.BUDGET_EXCEEDED,
          `Budget überschritten: ${budget.category.name}`,
          `Du hast ${percentage}% deines Budgets für ${budget.category.name} ausgegeben (${spentAmount.toFixed(2)} € von ${budgetAmount.toFixed(2)} €).`,
          { budgetId: budget.id, categoryId: budget.categoryId, percentage, spent: spentAmount },
        );
      } else if (percentage >= 80) {
        await this.create(
          userId,
          NotificationType.BUDGET_WARNING,
          `Budget-Warnung: ${budget.category.name}`,
          `Du hast bereits ${percentage}% deines Budgets für ${budget.category.name} ausgegeben (${spentAmount.toFixed(2)} € von ${budgetAmount.toFixed(2)} €).`,
          { budgetId: budget.id, categoryId: budget.categoryId, percentage, spent: spentAmount },
        );
      }
    }
  }

  async checkLowBalance(userId: string, threshold: number) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId, isActive: true },
    });

    for (const account of accounts) {
      const balance = Number(account.balance);
      if (balance < threshold) {
        await this.create(
          userId,
          NotificationType.LOW_BALANCE,
          `Niedriger Kontostand: ${account.accountName}`,
          `Dein Konto "${account.accountName}" hat nur noch ${balance.toFixed(2)} € (unter ${threshold.toFixed(2)} €).`,
          { accountId: account.id, balance, threshold },
        );
      }
    }
  }

  async checkContractReminders(userId: string) {
    const now = new Date();
    const in30Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

    const contracts = await this.prisma.contract.findMany({
      where: {
        userId,
        isActive: true,
        endDate: {
          gte: now,
          lte: in30Days,
        },
      },
    });

    for (const contract of contracts) {
      const endDate = contract.endDate!;
      const daysLeft = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      await this.create(
        userId,
        NotificationType.CONTRACT_REMINDER,
        `Vertrag läuft aus: ${contract.name}`,
        `Dein Vertrag "${contract.name}" bei ${contract.provider} läuft in ${daysLeft} Tagen aus (${endDate.toLocaleDateString('de-DE')}).`,
        { contractId: contract.id, endDate: endDate.toISOString(), daysLeft },
      );
    }
  }

  async checkUnusualSpending(userId: string) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Letzte 3 Monate für den Durchschnitt
    const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Aktuelle Monatsausgaben nach Kategorie
    const currentSpending = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        bankAccount: { userId },
        amount: { lt: 0 },
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });

    // Durchschnittliche Ausgaben der letzten 3 Monate nach Kategorie
    const historicalSpending = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        bankAccount: { userId },
        amount: { lt: 0 },
        date: { gte: threeMonthsAgoStart, lte: lastMonthEnd },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });

    const historicalMap = new Map<string, number>();
    for (const entry of historicalSpending) {
      if (entry.categoryId) {
        historicalMap.set(entry.categoryId, Math.abs(Number(entry._sum.amount || 0)) / 3);
      }
    }

    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    for (const entry of currentSpending) {
      if (!entry.categoryId) continue;

      const currentAmount = Math.abs(Number(entry._sum.amount || 0));
      const avgAmount = historicalMap.get(entry.categoryId);

      if (avgAmount && avgAmount > 0) {
        const increasePercent = Math.round(((currentAmount - avgAmount) / avgAmount) * 100);

        if (increasePercent >= 50) {
          const categoryName = categoryMap.get(entry.categoryId) || 'Unbekannt';
          await this.create(
            userId,
            NotificationType.UNUSUAL_SPENDING,
            `Ungewöhnliche Ausgaben: ${categoryName}`,
            `Deine Ausgaben für ${categoryName} sind diesen Monat ${increasePercent}% höher als im Durchschnitt der letzten 3 Monate (${currentAmount.toFixed(2)} € vs. Ø ${avgAmount.toFixed(2)} €).`,
            {
              categoryId: entry.categoryId,
              currentAmount,
              averageAmount: avgAmount,
              increasePercent,
            },
          );
        }
      }
    }
  }
}
