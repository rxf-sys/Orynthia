import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { BudgetPeriod } from '@prisma/client';
import { fromCents, roundMoney, toCents } from '../../../platform/common/money';

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

    // Eine Aggregation pro Periodentyp statt pro Budget (vermeidet N+1-Queries)
    const periods = [...new Set(budgets.map((b) => b.period))];
    const spentByPeriodCategory = new Map<string, number>();

    await Promise.all(
      periods.map(async (period) => {
        const { start, end } = this.getPeriodRange(period, now);
        const grouped = await this.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            bankAccount: { userId },
            categoryId: { in: budgets.filter((b) => b.period === period).map((b) => b.categoryId) },
            amount: { lt: 0 },
            date: { gte: start, lt: end },
          },
          _sum: { amount: true },
        });
        for (const g of grouped) {
          if (g.categoryId) {
            spentByPeriodCategory.set(`${period}:${g.categoryId}`, Math.abs(roundMoney(Number(g._sum.amount || 0))));
          }
        }
      }),
    );

    return budgets.map((budget) => {
      const spentAmount = spentByPeriodCategory.get(`${budget.period}:${budget.categoryId}`) ?? 0;
      const budgetAmount = Number(budget.amount);

      return {
        ...budget,
        amount: budgetAmount,
        spent: spentAmount,
        remaining: fromCents(toCents(budgetAmount) - toCents(spentAmount)),
        percentage: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0,
      };
    });
  }

  async create(userId: string, data: { categoryId: string; amount: number; period?: BudgetPeriod }) {
    const category = await this.prisma.category.findFirst({
      where: { id: data.categoryId, OR: [{ userId }, { isSystem: true }] },
    });
    if (!category) throw new ForbiddenException('Kategorie nicht zugänglich');

    try {
      return await this.prisma.budget.create({
        data: {
          userId,
          categoryId: data.categoryId,
          amount: data.amount,
          period: data.period || 'MONTHLY',
          startDate: new Date(),
        },
        include: { category: { select: { name: true, icon: true, color: true } } },
      });
    } catch (err: unknown) {
      // Unique-Constraint (userId, categoryId, period) → sauberer 409 statt 500
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Für diese Kategorie existiert bereits ein Budget mit dieser Periode');
      }
      throw err;
    }
  }

  async update(userId: string, id: string, data: { amount?: number; period?: BudgetPeriod; isActive?: boolean }) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget nicht gefunden');
    try {
      return await this.prisma.budget.update({
        where: { id },
        data,
        include: { category: { select: { name: true, icon: true, color: true } } },
      });
    } catch (err: unknown) {
      // Perioden-Wechsel kann mit einem bestehenden Budget kollidieren
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Für diese Kategorie existiert bereits ein Budget mit dieser Periode');
      }
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget nicht gefunden');
    await this.prisma.budget.delete({ where: { id } });
    return { message: 'Budget gelöscht' };
  }

  /**
   * Liefert die aktuelle Budget-Periode als halboffenes Intervall [start, end):
   * `end` ist der Beginn der Folgeperiode und wird mit `lt` abgefragt. Ein
   * inklusives `lte` auf Mitternacht des letzten Tages würde Buchungen mit
   * Uhrzeit am letzten Periodentag verlieren.
   */
  private getPeriodRange(period: BudgetPeriod, now: Date): { start: Date; end: Date } {
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (period) {
      case 'WEEKLY': {
        const dayOfWeek = now.getDay();
        const monday = new Date(year, month, now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const nextMonday = new Date(monday);
        nextMonday.setDate(monday.getDate() + 7);
        return { start: monday, end: nextMonday };
      }
      case 'MONTHLY':
        return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
      case 'QUARTERLY': {
        const quarterStart = Math.floor(month / 3) * 3;
        return { start: new Date(year, quarterStart, 1), end: new Date(year, quarterStart + 3, 1) };
      }
      case 'YEARLY':
        return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
    }
  }
}
