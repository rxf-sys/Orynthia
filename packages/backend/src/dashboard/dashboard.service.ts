import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';

const SUBSCRIPTION_TYPES = new Set(['STREAMING', 'GYM', 'SUBSCRIPTION']);

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private contracts: ContractsService,
  ) {}

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

  /**
   * Liquiditätsvorschau für die nächsten `days` Tage.
   * Basis: aktueller Gesamtsaldo + erwartete wiederkehrende Zahlungen +
   * Vertragsraten (cyclisch) + tägliche Durchschnitts-Ausgaben (Median der
   * letzten 90 Tage, gefiltert nach variablen Ausgaben).
   */
  async getForecast(userId: string, days: number) {
    const horizon = Math.min(Math.max(days, 7), 180);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + horizon);

    const [accounts, recurring, contracts, txHistory] = await Promise.all([
      this.prisma.bankAccount.findMany({
        where: { userId, isActive: true, accountType: { not: 'LOAN' } },
        select: { balance: true },
      }),
      this.prisma.recurringPayment.findMany({
        where: { userId, isActive: true, nextDueDate: { not: null } },
      }),
      this.prisma.contract.findMany({
        where: { userId, isActive: true, monthlyCost: { not: null } },
      }),
      this.prisma.transaction.findMany({
        where: {
          bankAccount: { userId },
          amount: { lt: 0 },
          date: { gte: new Date(today.getTime() - 90 * 86_400_000) },
        },
        select: { amount: true, date: true, counterpartName: true, purpose: true },
      }),
    ]);

    const startBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    // 1) Geplante Buchungen pro Tag sammeln
    type ScheduledItem = { name: string; amount: number; source: 'recurring' | 'contract' };
    const schedule = new Map<string, ScheduledItem[]>();
    const addItem = (date: Date, item: ScheduledItem) => {
      if (date < today || date > endDate) return;
      const key = date.toISOString().slice(0, 10);
      if (!schedule.has(key)) schedule.set(key, []);
      schedule.get(key)!.push(item);
    };

    for (const r of recurring) {
      if (!r.nextDueDate) continue;
      let next = new Date(r.nextDueDate);
      next.setHours(0, 0, 0, 0);
      while (next <= endDate) {
        if (next >= today) {
          addItem(next, { name: r.name, amount: Number(r.amount), source: 'recurring' });
        }
        next = addFrequency(next, r.frequency);
        if (!next) break;
      }
    }

    for (const c of contracts) {
      // Aus monthlyCost + billingCycle einen rollenden Zahlungstermin erzeugen.
      // Anker: heute + 1, dann nach Cycle wiederholen.
      const monthlyAmount = Number(c.monthlyCost ?? 0);
      if (monthlyAmount <= 0) continue;
      const billingMonths =
        c.billingCycle === 'MONTHLY' ? 1
        : c.billingCycle === 'QUARTERLY' ? 3
        : c.billingCycle === 'BIANNUALLY' ? 6
        : 12;
      const cycleAmount = monthlyAmount * billingMonths;

      let anchor = c.startDate ? new Date(c.startDate) : new Date(today);
      anchor.setHours(0, 0, 0, 0);
      while (anchor < today) {
        anchor = new Date(anchor);
        anchor.setMonth(anchor.getMonth() + billingMonths);
      }
      while (anchor <= endDate) {
        addItem(anchor, { name: c.name, amount: -cycleAmount, source: 'contract' });
        const next = new Date(anchor);
        next.setMonth(next.getMonth() + billingMonths);
        anchor = next;
      }
    }

    // 2) Tägliche Median-Ausgabe für variable Buchungen
    const fixedKeywords = new Set<string>();
    for (const r of recurring) {
      const k = (r.counterpartName ?? r.name).toLowerCase().trim();
      if (k) fixedKeywords.add(k);
    }
    for (const c of contracts) {
      const k = (c.counterpartName ?? c.provider).toLowerCase().trim();
      if (k) fixedKeywords.add(k);
    }
    const variableDaily = new Map<string, number>();
    for (const tx of txHistory) {
      const cp = (tx.counterpartName ?? '').toLowerCase().trim();
      const isFixed = cp && [...fixedKeywords].some((k) => cp.includes(k) || k.includes(cp));
      if (isFixed) continue;
      const key = tx.date.toISOString().slice(0, 10);
      variableDaily.set(key, (variableDaily.get(key) ?? 0) + Math.abs(Number(tx.amount)));
    }
    const dailyTotals = [...variableDaily.values()].sort((a, b) => a - b);
    const medianDailySpend = dailyTotals.length > 0 ? dailyTotals[Math.floor(dailyTotals.length / 2)] : 0;

    // 3) Projektion Tag für Tag
    const points: Array<{
      date: string;
      projectedBalance: number;
      scheduledIn: number;
      scheduledOut: number;
      estimatedVariableSpend: number;
      items: ScheduledItem[];
    }> = [];
    let running = startBalance;
    let lowestBalance = startBalance;
    let lowestDate = today.toISOString().slice(0, 10);
    let totalIn = 0;
    let totalOut = 0;

    for (let i = 0; i <= horizon; i++) {
      const day = new Date(today);
      day.setDate(day.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      const items = schedule.get(key) ?? [];
      let scheduledIn = 0;
      let scheduledOut = 0;
      for (const it of items) {
        if (it.amount >= 0) scheduledIn += it.amount;
        else scheduledOut += Math.abs(it.amount);
      }
      const variable = i === 0 ? 0 : medianDailySpend;
      running += scheduledIn - scheduledOut - variable;
      totalIn += scheduledIn;
      totalOut += scheduledOut + variable;
      if (running < lowestBalance) {
        lowestBalance = running;
        lowestDate = key;
      }
      points.push({
        date: key,
        projectedBalance: Math.round(running * 100) / 100,
        scheduledIn: Math.round(scheduledIn * 100) / 100,
        scheduledOut: Math.round(scheduledOut * 100) / 100,
        estimatedVariableSpend: Math.round(variable * 100) / 100,
        items,
      });
    }

    return {
      horizonDays: horizon,
      startBalance: Math.round(startBalance * 100) / 100,
      endBalance: Math.round(running * 100) / 100,
      lowestBalance: Math.round(lowestBalance * 100) / 100,
      lowestDate,
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      medianDailySpend: Math.round(medianDailySpend * 100) / 100,
      points,
    };
  }

  /**
   * Sparpotenzial-Analyse: Aggregierte Sicht aller wiederkehrenden
   * Posten + Anbietervergleich + Kategorien über Schnitt.
   */
  async getSavingsPotential(userId: string) {
    const [activeRecurring, activeContracts, comparison, txLastSixMonths] = await Promise.all([
      this.prisma.recurringPayment.findMany({
        where: { userId, isActive: true },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      }),
      this.prisma.contract.findMany({ where: { userId, isActive: true } }),
      this.contracts.compareProviders(userId),
      this.prisma.transaction.findMany({
        where: {
          bankAccount: { userId },
          amount: { lt: 0 },
          date: { gte: monthsAgo(6) },
        },
        select: { amount: true, date: true, categoryId: true },
      }),
    ]);

    const recurringMonthly = activeRecurring.reduce((sum, r) => {
      return sum + frequencyToMonthly(Math.abs(Number(r.amount)), r.frequency);
    }, 0);
    const contractMonthly = activeContracts.reduce(
      (sum, c) => sum + Number(c.monthlyCost ?? 0),
      0,
    );
    const totalFixedMonthly = recurringMonthly + contractMonthly;

    // Abo-Übersicht (Streaming / Gym / Subscription + Verträge mit niedrigem monatlichen Cost)
    const subscriptionContracts = activeContracts
      .filter((c) => SUBSCRIPTION_TYPES.has(c.contractType))
      .map((c) => ({
        id: c.id,
        kind: 'contract' as const,
        name: c.name,
        provider: c.provider,
        contractType: c.contractType,
        monthlyCost: Number(c.monthlyCost ?? 0),
        lastChargeDate: c.lastChargeDate,
      }));
    const subscriptionRecurring = activeRecurring
      .filter((r) =>
        r.category?.name === 'Abonnements' || r.category?.name === 'Freizeit & Unterhaltung',
      )
      .map((r) => ({
        id: r.id,
        kind: 'recurring' as const,
        name: r.name,
        provider: r.counterpartName ?? r.name,
        contractType: 'SUBSCRIPTION',
        monthlyCost: frequencyToMonthly(Math.abs(Number(r.amount)), r.frequency),
        lastChargeDate: r.lastChargeDate,
      }));
    const subscriptions = [...subscriptionContracts, ...subscriptionRecurring].sort(
      (a, b) => b.monthlyCost - a.monthlyCost,
    );
    const subscriptionTotal = subscriptions.reduce((s, x) => s + x.monthlyCost, 0);

    // Kategorien-Median (letzte 5 abgeschlossene Monate) vs. aktueller Monat
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySumByCat = new Map<string, Map<string, number>>(); // monthKey -> categoryId -> sum
    for (const tx of txLastSixMonths) {
      if (!tx.categoryId) continue;
      const d = tx.date;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlySumByCat.has(monthKey)) monthlySumByCat.set(monthKey, new Map());
      const inner = monthlySumByCat.get(monthKey)!;
      inner.set(tx.categoryId, (inner.get(tx.categoryId) ?? 0) + Math.abs(Number(tx.amount)));
    }
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthSums = monthlySumByCat.get(currentMonthKey) ?? new Map();

    const categoryMedians = new Map<string, number>();
    const allCategoryIds = new Set<string>();
    for (const [, inner] of monthlySumByCat) for (const cid of inner.keys()) allCategoryIds.add(cid);
    for (const cid of allCategoryIds) {
      const values: number[] = [];
      for (const [mk, inner] of monthlySumByCat) {
        if (mk === currentMonthKey) continue;
        values.push(inner.get(cid) ?? 0);
      }
      if (values.length === 0) continue;
      values.sort((a, b) => a - b);
      categoryMedians.set(cid, values[Math.floor(values.length / 2)]);
    }

    const categoryDetails = await this.prisma.category.findMany({
      where: { id: { in: [...allCategoryIds] } },
      select: { id: true, name: true, icon: true, color: true },
    });
    const catMap = new Map(categoryDetails.map((c) => [c.id, c]));

    const overspendingCategories = [...categoryMedians.entries()]
      .map(([cid, median]) => ({
        category: catMap.get(cid),
        median: Math.round(median * 100) / 100,
        currentMonth: Math.round((currentMonthSums.get(cid) ?? 0) * 100) / 100,
      }))
      .filter((row) => row.category && row.median > 0 && row.currentMonth > row.median * 1.2)
      .map((row) => ({
        ...row,
        overBy: Math.round((row.currentMonth - row.median) * 100) / 100,
        overByPercent: Math.round(((row.currentMonth - row.median) / row.median) * 100),
      }))
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 8);

    const totalSavingsMonthly = comparison.totalSavingsMonthly;
    const totalSavingsYearly = comparison.totalSavingsYearly;

    void currentMonthStart; // keep tree-shake happy
    return {
      totalFixedMonthly: Math.round(totalFixedMonthly * 100) / 100,
      totalFixedYearly: Math.round(totalFixedMonthly * 12 * 100) / 100,
      breakdown: {
        recurringMonthly: Math.round(recurringMonthly * 100) / 100,
        contractMonthly: Math.round(contractMonthly * 100) / 100,
      },
      subscriptions: {
        total: Math.round(subscriptionTotal * 100) / 100,
        count: subscriptions.length,
        items: subscriptions.map((s) => ({
          ...s,
          monthlyCost: Math.round(s.monthlyCost * 100) / 100,
        })),
      },
      providerSavings: {
        totalMonthly: totalSavingsMonthly,
        totalYearly: totalSavingsYearly,
        topCandidates: comparison.comparisons
          .filter((c) => c.savingsPotentialYearly > 0)
          .slice(0, 5),
      },
      overspendingCategories,
    };
  }
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function frequencyToMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'WEEKLY': return amount * (52 / 12);
    case 'BIWEEKLY': return amount * (26 / 12);
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'BIANNUALLY': return amount / 6;
    case 'YEARLY': return amount / 12;
    default: return amount;
  }
}

function addFrequency(d: Date, freq: string): Date {
  const next = new Date(d);
  switch (freq) {
    case 'WEEKLY': next.setDate(next.getDate() + 7); break;
    case 'BIWEEKLY': next.setDate(next.getDate() + 14); break;
    case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
    case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
    case 'BIANNUALLY': next.setMonth(next.getMonth() + 6); break;
    case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
    default: next.setMonth(next.getMonth() + 1);
  }
  return next;
}
