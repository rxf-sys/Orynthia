import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallelisierte Abfragen
    const [
      accounts,
      monthlyIncome,
      monthlyExpenses,
      lastMonthExpenses,
      recentTransactions,
      expensesByCategory,
      unreadNotifications,
    ] = await Promise.all([
      // Konten
      this.prisma.bankAccount.findMany({
        where: { userId, isActive: true },
        select: { id: true, bankName: true, accountName: true, balance: true, currency: true, accountType: true },
      }),
      // Monatliche Einnahmen
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Monatliche Ausgaben
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Letzter Monat zum Vergleich
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: lastMonthStart, lte: lastMonthEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Letzte 10 Transaktionen
      this.prisma.transaction.findMany({
        where: { bankAccount: { userId } },
        include: { category: { select: { name: true, icon: true, color: true } }, bankAccount: { select: { accountName: true } } },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      // Ausgaben nach Kategorie (aktueller Monat)
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { bankAccount: { userId }, amount: { lt: 0 }, date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      // Ungelesene Benachrichtigungen
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const incomeAmount = Number(monthlyIncome._sum.amount || 0);
    const expenseAmount = Math.abs(Number(monthlyExpenses._sum.amount || 0));

    // Kategorien für Ausgaben laden
    const categoryIds = expensesByCategory.map(e => e.categoryId).filter(Boolean) as string[];
    const categories = categoryIds.length > 0
      ? await this.prisma.category.findMany({ where: { id: { in: categoryIds } } })
      : [];
    const catMap = new Map(categories.map(c => [c.id, c]));

    return {
      overview: {
        totalBalance,
        monthlyIncome: incomeAmount,
        monthlyExpenses: expenseAmount,
        lastMonthExpenses: Math.abs(Number(lastMonthExpenses._sum.amount || 0)),
        savingsRate: incomeAmount > 0
          ? Math.round(((incomeAmount - expenseAmount) / incomeAmount) * 100)
          : 0,
      },
      accounts,
      recentTransactions,
      expensesByCategory: expensesByCategory.map(e => ({
        categoryId: e.categoryId,
        category: e.categoryId ? catMap.get(e.categoryId) : { name: 'Unkategorisiert', icon: '❓', color: '#94a3b8' },
        amount: Math.abs(Number(e._sum.amount)),
      })).sort((a, b) => b.amount - a.amount),
      unreadNotifications,
    };
  }
}
