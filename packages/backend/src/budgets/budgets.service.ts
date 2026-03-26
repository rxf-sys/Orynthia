import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetPeriod } from '@prisma/client';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
      include: { category: { select: { name: true, icon: true, color: true } } },
      orderBy: { category: { name: 'asc' } },
    });

    if (budgets.length === 0) return [];

    const now = new Date();

    // Pro Budget die Ausgaben für die jeweilige Periode berechnen
    const results = await Promise.all(
      budgets.map(async (budget) => {
        const { start, end } = this.getPeriodRange(budget.period, now);
        const spent = await this.prisma.transaction.aggregate({
          where: {
            bankAccount: { userId },
            categoryId: budget.categoryId,
            amount: { lt: 0 },
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
        });

        const spentAmount = Math.abs(Number(spent._sum.amount || 0));
        const budgetAmount = Number(budget.amount);

        return {
          ...budget,
          amount: budgetAmount,
          spent: spentAmount,
          remaining: budgetAmount - spentAmount,
          percentage: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0,
        };
      }),
    );

    return results;
  }

  async create(userId: string, data: { categoryId: string; amount: number; period?: BudgetPeriod }) {
    return this.prisma.budget.create({
      data: {
        userId,
        categoryId: data.categoryId,
        amount: data.amount,
        period: data.period || 'MONTHLY',
        startDate: new Date(),
      },
      include: { category: { select: { name: true, icon: true, color: true } } },
    });
  }

  async update(userId: string, id: string, data: { amount?: number; period?: BudgetPeriod; isActive?: boolean }) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget nicht gefunden');
    return this.prisma.budget.update({
      where: { id },
      data,
      include: { category: { select: { name: true, icon: true, color: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget nicht gefunden');
    await this.prisma.budget.delete({ where: { id } });
    return { message: 'Budget gelöscht' };
  }

  private getPeriodRange(period: BudgetPeriod, now: Date): { start: Date; end: Date } {
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (period) {
      case 'WEEKLY':
        const dayOfWeek = now.getDay();
        const monday = new Date(year, month, now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { start: monday, end: sunday };
      case 'MONTHLY':
        return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
      case 'QUARTERLY':
        const quarterStart = Math.floor(month / 3) * 3;
        return { start: new Date(year, quarterStart, 1), end: new Date(year, quarterStart + 3, 0) };
      case 'YEARLY':
        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
    }
  }
}
