import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashflowService {
  constructor(private prisma: PrismaService) {}

  async getForecast(userId: string, months = 3) {
    // Get current total balance
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId, isActive: true },
    });
    const currentBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    // Get recurring payments
    const recurringPayments = await this.prisma.recurringPayment.findMany({
      where: { userId, isActive: true },
    });

    // Calculate monthly recurring income and expenses
    const frequencyMultiplier: Record<string, number> = {
      WEEKLY: 4.33, BIWEEKLY: 2.17, MONTHLY: 1,
      QUARTERLY: 1 / 3, BIANNUALLY: 1 / 6, YEARLY: 1 / 12,
    };

    let monthlyRecurringIncome = 0;
    let monthlyRecurringExpenses = 0;

    for (const rp of recurringPayments) {
      const amount = Number(rp.amount);
      const multiplier = frequencyMultiplier[rp.frequency] || 1;
      const monthlyAmount = amount * multiplier;
      if (amount > 0) {
        monthlyRecurringIncome += monthlyAmount;
      } else {
        monthlyRecurringExpenses += Math.abs(monthlyAmount);
      }
    }

    // Get average non-recurring spending from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [avgIncome, avgExpenses] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          bankAccount: { userId },
          date: { gte: threeMonthsAgo },
          amount: { gt: 0 },
          isRecurring: false,
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          bankAccount: { userId },
          date: { gte: threeMonthsAgo },
          amount: { lt: 0 },
          isRecurring: false,
        },
        _sum: { amount: true },
      }),
    ]);

    const avgMonthlyVariableIncome = Number(avgIncome._sum.amount || 0) / 3;
    const avgMonthlyVariableExpenses = Math.abs(Number(avgExpenses._sum.amount || 0)) / 3;

    const totalMonthlyIncome = monthlyRecurringIncome + avgMonthlyVariableIncome;
    const totalMonthlyExpenses = monthlyRecurringExpenses + avgMonthlyVariableExpenses;
    const monthlyNet = totalMonthlyIncome - totalMonthlyExpenses;

    // Build forecast
    const forecast: {
      month: string;
      label: string;
      projectedBalance: number;
      income: number;
      expenses: number;
      net: number;
    }[] = [];

    const germanMonths = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
    ];

    let runningBalance = currentBalance;
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      runningBalance += monthlyNet;

      forecast.push({
        month: `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`,
        label: `${germanMonths[futureDate.getMonth()]} ${futureDate.getFullYear()}`,
        projectedBalance: Math.round(runningBalance * 100) / 100,
        income: Math.round(totalMonthlyIncome * 100) / 100,
        expenses: Math.round(totalMonthlyExpenses * 100) / 100,
        net: Math.round(monthlyNet * 100) / 100,
      });
    }

    // Check for potential issues
    const warnings: string[] = [];
    const firstNegative = forecast.find((f) => f.projectedBalance < 0);
    if (firstNegative) {
      warnings.push(`Kontostand wird voraussichtlich im ${firstNegative.label} negativ.`);
    }
    if (monthlyNet < 0) {
      warnings.push(`Du gibst monatlich ca. ${Math.abs(monthlyNet).toFixed(2)} EUR mehr aus als du einnimmst.`);
    }

    // End of month estimate
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - today;
    const dailyExpenseRate = totalMonthlyExpenses / daysInMonth;
    const estimatedRemainingExpenses = dailyExpenseRate * remainingDays;
    const endOfMonthEstimate = currentBalance - estimatedRemainingExpenses;

    return {
      currentBalance: Math.round(currentBalance * 100) / 100,
      endOfMonthEstimate: Math.round(endOfMonthEstimate * 100) / 100,
      monthlyIncome: Math.round(totalMonthlyIncome * 100) / 100,
      monthlyExpenses: Math.round(totalMonthlyExpenses * 100) / 100,
      monthlyNet: Math.round(monthlyNet * 100) / 100,
      recurring: {
        income: Math.round(monthlyRecurringIncome * 100) / 100,
        expenses: Math.round(monthlyRecurringExpenses * 100) / 100,
      },
      variable: {
        income: Math.round(avgMonthlyVariableIncome * 100) / 100,
        expenses: Math.round(avgMonthlyVariableExpenses * 100) / 100,
      },
      forecast,
      warnings,
    };
  }
}
