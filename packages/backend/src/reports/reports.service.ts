import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getMonthlyReport(userId: string, year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(year, month - 2, 1);
    const prevMonthEnd = new Date(year, month - 1, 0, 23, 59, 59, 999);

    // Parallele Abfragen fuer den aktuellen Monat
    const [
      incomeAgg,
      expenseAgg,
      incomeByCategory,
      expenseByCategory,
      topExpenses,
      prevIncome,
      prevExpenses,
      budgets,
      dailyTransactions,
    ] = await Promise.all([
      // Gesamteinnahmen
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Gesamtausgaben
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Einnahmen nach Kategorie
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Ausgaben nach Kategorie
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Top 10 Ausgaben-Empfaenger
      this.prisma.transaction.groupBy({
        by: ['counterpartName'],
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 }, counterpartName: { not: null } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'asc' } },
        take: 10,
      }),
      // Vormonat Einnahmen
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: prevMonthStart, lte: prevMonthEnd }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Vormonat Ausgaben
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: prevMonthStart, lte: prevMonthEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Budgets
      this.prisma.budget.findMany({
        where: { userId, isActive: true, period: 'MONTHLY' },
        include: { category: { select: { name: true, icon: true, color: true } } },
      }),
      // Alle Transaktionen im Monat fuer daily spending
      this.prisma.transaction.findMany({
        where: { bankAccount: { userId }, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 } },
        select: { date: true, amount: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const incomeTotal = Number(incomeAgg._sum.amount || 0);
    const expenseTotal = Math.abs(Number(expenseAgg._sum.amount || 0));
    const balance = incomeTotal - expenseTotal;
    const savingsRate = incomeTotal > 0 ? Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 100) : 0;

    // Kategorien laden
    const allCategoryIds = [
      ...incomeByCategory.map(e => e.categoryId),
      ...expenseByCategory.map(e => e.categoryId),
    ].filter(Boolean) as string[];

    const categories = allCategoryIds.length > 0
      ? await this.prisma.category.findMany({ where: { id: { in: allCategoryIds } } })
      : [];
    const catMap = new Map(categories.map(c => [c.id, c]));

    const getCategoryName = (id: string | null) =>
      id && catMap.has(id) ? catMap.get(id)!.name : 'Unkategorisiert';

    // Einnahmen nach Kategorie
    const incomeByCat = incomeByCategory.map(e => ({
      category: getCategoryName(e.categoryId),
      amount: Number(e._sum.amount || 0),
    })).sort((a, b) => b.amount - a.amount);

    // Ausgaben nach Kategorie mit Prozent
    const expenseByCat = expenseByCategory.map(e => {
      const amount = Math.abs(Number(e._sum.amount || 0));
      return {
        category: getCategoryName(e.categoryId),
        amount,
        percentage: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
      };
    }).sort((a, b) => b.amount - a.amount);

    // Top Ausgaben-Empfaenger
    const topExp = topExpenses.map(e => ({
      counterpartName: e.counterpartName!,
      total: Math.abs(Number(e._sum.amount || 0)),
      count: e._count.id,
    }));

    // Vormonatsvergleich
    const prevIncomeTotal = Number(prevIncome._sum.amount || 0);
    const prevExpenseTotal = Math.abs(Number(prevExpenses._sum.amount || 0));
    const comparison = {
      prevMonth: { income: prevIncomeTotal, expenses: prevExpenseTotal },
      change: {
        incomePercent: prevIncomeTotal > 0
          ? Math.round(((incomeTotal - prevIncomeTotal) / prevIncomeTotal) * 100)
          : 0,
        expensesPercent: prevExpenseTotal > 0
          ? Math.round(((expenseTotal - prevExpenseTotal) / prevExpenseTotal) * 100)
          : 0,
      },
    };

    // Budget-Status
    const budgetStatus = await Promise.all(
      budgets.map(async (budget) => {
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
        return {
          budget: { id: budget.id, category: budget.category, amount: budgetAmount },
          spent: spentAmount,
          remaining: budgetAmount - spentAmount,
          percentage: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0,
        };
      }),
    );

    // Taegliche Ausgaben
    const dailyMap = new Map<string, number>();
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dailyMap.set(dateStr, 0);
    }
    for (const tx of dailyTransactions) {
      const dateStr = tx.date.toISOString().slice(0, 10);
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + Math.abs(Number(tx.amount)));
    }
    const dailySpending = Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }));

    return {
      period: { year, month, label: `${GERMAN_MONTHS[month - 1]} ${year}` },
      income: { total: incomeTotal, byCategory: incomeByCat },
      expenses: { total: expenseTotal, byCategory: expenseByCat },
      balance,
      savingsRate,
      topExpenses: topExp,
      comparison,
      budgetStatus,
      dailySpending,
    };
  }

  async getYearlyReport(userId: string, year: number) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const [
      incomeAgg,
      expenseAgg,
      incomeByCategory,
      expenseByCategory,
      incomeByMonth,
      expenseByMonth,
      startBalance,
      endBalance,
    ] = await Promise.all([
      // Gesamteinnahmen
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: yearStart, lte: yearEnd }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Gesamtausgaben
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: yearStart, lte: yearEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Einnahmen nach Kategorie
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { bankAccount: { userId }, date: { gte: yearStart, lte: yearEnd }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Ausgaben nach Kategorie
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { bankAccount: { userId }, date: { gte: yearStart, lte: yearEnd }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Einnahmen monatlich (alle Transaktionen fuer manuelle Gruppierung)
      this.prisma.transaction.findMany({
        where: { bankAccount: { userId }, date: { gte: yearStart, lte: yearEnd }, amount: { gt: 0 } },
        select: { date: true, amount: true },
      }),
      // Ausgaben monatlich
      this.prisma.transaction.findMany({
        where: { bankAccount: { userId }, date: { gte: yearStart, lte: yearEnd }, amount: { lt: 0 } },
        select: { date: true, amount: true },
      }),
      // Kontostand zu Jahresanfang (Summe aller Transaktionen bis Jahresanfang)
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { lt: yearStart } },
        _sum: { amount: true },
      }),
      // Kontostand zu Jahresende
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { lte: yearEnd } },
        _sum: { amount: true },
      }),
    ]);

    const incomeTotal = Number(incomeAgg._sum.amount || 0);
    const expenseTotal = Math.abs(Number(expenseAgg._sum.amount || 0));
    const balance = incomeTotal - expenseTotal;
    const savingsRate = incomeTotal > 0 ? Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 100) : 0;

    // Kategorien laden
    const allCategoryIds = [
      ...incomeByCategory.map(e => e.categoryId),
      ...expenseByCategory.map(e => e.categoryId),
    ].filter(Boolean) as string[];

    const categories = allCategoryIds.length > 0
      ? await this.prisma.category.findMany({ where: { id: { in: allCategoryIds } } })
      : [];
    const catMap = new Map(categories.map(c => [c.id, c]));

    const getCategoryName = (id: string | null) =>
      id && catMap.has(id) ? catMap.get(id)!.name : 'Unkategorisiert';

    // Einnahmen nach Kategorie
    const incomeByCat = incomeByCategory.map(e => ({
      category: getCategoryName(e.categoryId),
      amount: Number(e._sum.amount || 0),
    })).sort((a, b) => b.amount - a.amount);

    // Ausgaben nach Kategorie mit Prozent
    const expenseByCat = expenseByCategory.map(e => {
      const amount = Math.abs(Number(e._sum.amount || 0));
      return {
        category: getCategoryName(e.categoryId),
        amount,
        percentage: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
      };
    }).sort((a, b) => b.amount - a.amount);

    // Monatliche Aufteilung
    const incomeMonthMap = new Map<number, number>();
    const expenseMonthMap = new Map<number, number>();
    for (let m = 1; m <= 12; m++) {
      incomeMonthMap.set(m, 0);
      expenseMonthMap.set(m, 0);
    }
    for (const tx of incomeByMonth) {
      const m = tx.date.getMonth() + 1;
      incomeMonthMap.set(m, (incomeMonthMap.get(m) || 0) + Number(tx.amount));
    }
    for (const tx of expenseByMonth) {
      const m = tx.date.getMonth() + 1;
      expenseMonthMap.set(m, (expenseMonthMap.get(m) || 0) + Math.abs(Number(tx.amount)));
    }

    const incomeByMonthArr = Array.from(incomeMonthMap.entries()).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));
    const expenseByMonthArr = Array.from(expenseMonthMap.entries()).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));

    const startBal = Number(startBalance._sum.amount || 0);
    const endBal = Number(endBalance._sum.amount || 0);

    return {
      period: { year, label: `${year}` },
      income: { total: incomeTotal, byMonth: incomeByMonthArr, byCategory: incomeByCat },
      expenses: { total: expenseTotal, byMonth: expenseByMonthArr, byCategory: expenseByCat },
      balance,
      savingsRate,
      monthlyAvg: {
        income: Math.round((incomeTotal / 12) * 100) / 100,
        expenses: Math.round((expenseTotal / 12) * 100) / 100,
      },
      netWorthChange: Math.round((endBal - startBal) * 100) / 100,
    };
  }

  async generateReportCsv(userId: string, year: number, month?: number): Promise<string> {
    const BOM = '\uFEFF';
    const lines: string[] = [];

    const formatNumber = (n: number): string =>
      n.toFixed(2).replace('.', ',');

    if (month) {
      const report = await this.getMonthlyReport(userId, year, month);

      lines.push(`Monatsbericht;${report.period.label}`);
      lines.push('');

      // Uebersicht
      lines.push('Uebersicht');
      lines.push(`Einnahmen;${formatNumber(report.income.total)}`);
      lines.push(`Ausgaben;${formatNumber(report.expenses.total)}`);
      lines.push(`Bilanz;${formatNumber(report.balance)}`);
      lines.push(`Sparquote;${report.savingsRate}%`);
      lines.push('');

      // Einnahmen nach Kategorie
      lines.push('Einnahmen nach Kategorie');
      lines.push('Kategorie;Betrag');
      for (const item of report.income.byCategory) {
        lines.push(`${item.category};${formatNumber(item.amount)}`);
      }
      lines.push('');

      // Ausgaben nach Kategorie
      lines.push('Ausgaben nach Kategorie');
      lines.push('Kategorie;Betrag;Anteil');
      for (const item of report.expenses.byCategory) {
        lines.push(`${item.category};${formatNumber(item.amount)};${item.percentage}%`);
      }
      lines.push('');

      // Top Ausgaben
      lines.push('Top Ausgaben-Empfaenger');
      lines.push('Empfaenger;Betrag;Anzahl');
      for (const item of report.topExpenses) {
        lines.push(`${item.counterpartName};${formatNumber(item.total)};${item.count}`);
      }
      lines.push('');

      // Budget-Status
      if (report.budgetStatus.length > 0) {
        lines.push('Budget-Status');
        lines.push('Kategorie;Budget;Ausgegeben;Verbleibend;Auslastung');
        for (const item of report.budgetStatus) {
          lines.push(
            `${item.budget.category.name};${formatNumber(item.budget.amount)};${formatNumber(item.spent)};${formatNumber(item.remaining)};${item.percentage}%`,
          );
        }
        lines.push('');
      }

      // Taegliche Ausgaben
      lines.push('Taegliche Ausgaben');
      lines.push('Datum;Betrag');
      for (const item of report.dailySpending) {
        lines.push(`${item.date};${formatNumber(item.amount)}`);
      }
    } else {
      const report = await this.getYearlyReport(userId, year);

      lines.push(`Jahresbericht;${report.period.label}`);
      lines.push('');

      // Uebersicht
      lines.push('Uebersicht');
      lines.push(`Einnahmen;${formatNumber(report.income.total)}`);
      lines.push(`Ausgaben;${formatNumber(report.expenses.total)}`);
      lines.push(`Bilanz;${formatNumber(report.balance)}`);
      lines.push(`Sparquote;${report.savingsRate}%`);
      lines.push(`Durchschnitt Einnahmen/Monat;${formatNumber(report.monthlyAvg.income)}`);
      lines.push(`Durchschnitt Ausgaben/Monat;${formatNumber(report.monthlyAvg.expenses)}`);
      lines.push(`Vermoegensentwicklung;${formatNumber(report.netWorthChange)}`);
      lines.push('');

      // Monatliche Einnahmen
      lines.push('Monatliche Einnahmen');
      lines.push('Monat;Betrag');
      for (const item of report.income.byMonth) {
        lines.push(`${GERMAN_MONTHS[item.month - 1]};${formatNumber(item.amount)}`);
      }
      lines.push('');

      // Monatliche Ausgaben
      lines.push('Monatliche Ausgaben');
      lines.push('Monat;Betrag');
      for (const item of report.expenses.byMonth) {
        lines.push(`${GERMAN_MONTHS[item.month - 1]};${formatNumber(item.amount)}`);
      }
      lines.push('');

      // Einnahmen nach Kategorie
      lines.push('Einnahmen nach Kategorie');
      lines.push('Kategorie;Betrag');
      for (const item of report.income.byCategory) {
        lines.push(`${item.category};${formatNumber(item.amount)}`);
      }
      lines.push('');

      // Ausgaben nach Kategorie
      lines.push('Ausgaben nach Kategorie');
      lines.push('Kategorie;Betrag;Anteil');
      for (const item of report.expenses.byCategory) {
        lines.push(`${item.category};${formatNumber(item.amount)};${item.percentage}%`);
      }
    }

    return BOM + lines.join('\r\n');
  }
}
