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
      currentMonthTransactions,
      lastMonthTransactions,
      recentTransactions,
      budgets,
      savingsGoals,
      unreadNotifications,
    ] = await Promise.all([
      // Konten & Gesamtsaldo
      this.prisma.bankAccount.findMany({
        where: { userId, isActive: true },
        select: { id: true, bankName: true, accountName: true, balance: true, currency: true, accountType: true },
      }),
      // Aktuelle Monatsausgaben
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd } },
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
      // Budget Status
      this.prisma.budget.findMany({
        where: { userId, isActive: true },
        include: { category: { select: { name: true, icon: true, color: true } } },
      }),
      // Sparziele
      this.prisma.savingsGoal.findMany({
        where: { userId, isCompleted: false },
        orderBy: { createdAt: 'desc' },
      }),
      // Ungelesene Benachrichtigungen
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    // Berechnungen
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // Monatliche Einnahmen/Ausgaben berechnen
    const monthlyIncome = await this.prisma.transaction.aggregate({
      where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    const monthlyExpenses = await this.prisma.transaction.aggregate({
      where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    // Ausgaben nach Kategorie (aktueller Monat)
    const expensesByCategory = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { bankAccount: { userId }, amount: { lt: 0 }, date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    const categoryIds = expensesByCategory.map(e => e.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const catMap = new Map(categories.map(c => [c.id, c]));

    return {
      overview: {
        totalBalance,
        monthlyIncome: Number(monthlyIncome._sum.amount || 0),
        monthlyExpenses: Math.abs(Number(monthlyExpenses._sum.amount || 0)),
        lastMonthExpenses: Math.abs(Number(lastMonthTransactions._sum.amount || 0)),
        savingsRate: Number(monthlyIncome._sum.amount || 0) > 0
          ? Math.round(((Number(monthlyIncome._sum.amount || 0) + Number(monthlyExpenses._sum.amount || 0)) / Number(monthlyIncome._sum.amount || 1)) * 100)
          : 0,
      },
      accounts,
      recentTransactions,
      expensesByCategory: expensesByCategory.map(e => ({
        category: e.categoryId ? catMap.get(e.categoryId) : { name: 'Unkategorisiert', icon: '❓', color: '#94a3b8' },
        amount: Math.abs(Number(e._sum.amount)),
      })).sort((a, b) => b.amount - a.amount),
      savingsGoals: savingsGoals.map(g => ({
        ...g,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        percentage: Number(g.targetAmount) > 0 ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0,
      })),
      unreadNotifications,
    };
  }
}
