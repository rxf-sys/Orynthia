import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { addFrequency, addMonthsClamped, frequencyToMonthly } from '../../../platform/common/dates';
import { fromCents, roundMoney, sumMoney, toCents } from '../../../platform/common/money';

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
    // Obergrenzen exklusiv (lt) statt inklusiv (lte): `new Date(y, m+1, 0)` wäre
    // Mitternacht des letzten Tages — Buchungen mit Uhrzeit am Monatsletzten
    // fielen sonst aus allen Monats-Aggregationen heraus.
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
        where: { bankAccount: { userId }, date: { gte: monthStart, lt: nextMonthStart }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      // Monatliche Ausgaben
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: monthStart, lt: nextMonthStart }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      // Letzter Monat zum Vergleich
      this.prisma.transaction.aggregate({
        where: { bankAccount: { userId }, date: { gte: lastMonthStart, lt: monthStart }, amount: { lt: 0 } },
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
        where: { bankAccount: { userId }, amount: { lt: 0 }, date: { gte: monthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      // Ungelesene Benachrichtigungen
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const totalBalance = sumMoney(accounts, (acc) => acc.balance);
    const incomeAmount = roundMoney(Number(monthlyIncome._sum.amount || 0));
    const expenseAmount = Math.abs(roundMoney(Number(monthlyExpenses._sum.amount || 0)));

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
        lastMonthExpenses: Math.abs(roundMoney(Number(lastMonthExpenses._sum.amount || 0))),
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

    const startBalance = sumMoney(accounts, (a) => a.balance);

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
      // Ziel-Tag der ersten Fälligkeit merken: eine Zahlung am 31. bleibt
      // am Monatsletzten, statt nach dem Februar dauerhaft auf den 28. zu
      // rutschen oder per setMonth-Überlauf in den Folgemonat zu driften.
      const anchorDay = next.getDate();
      while (next <= endDate) {
        if (next >= today) {
          addItem(next, { name: r.name, amount: roundMoney(r.amount), source: 'recurring' });
        }
        next = addFrequency(next, r.frequency, anchorDay);
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
      const anchorDay = anchor.getDate();
      while (anchor < today) {
        anchor = addMonthsClamped(anchor, billingMonths, anchorDay);
      }
      while (anchor <= endDate) {
        addItem(anchor, { name: c.name, amount: -roundMoney(cycleAmount), source: 'contract' });
        anchor = addMonthsClamped(anchor, billingMonths, anchorDay);
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
      variableDaily.set(key, (variableDaily.get(key) ?? 0) + Math.abs(toCents(tx.amount)));
    }
    const dailyTotals = [...variableDaily.values()].sort((a, b) => a - b);
    const medianDailySpendCents = dailyTotals.length > 0 ? dailyTotals[Math.floor(dailyTotals.length / 2)] : 0;

    // 3) Projektion Tag für Tag
    const points: Array<{
      date: string;
      projectedBalance: number;
      scheduledIn: number;
      scheduledOut: number;
      estimatedVariableSpend: number;
      items: ScheduledItem[];
    }> = [];
    let runningCents = toCents(startBalance);
    let lowestCents = runningCents;
    let lowestDate = today.toISOString().slice(0, 10);
    let totalInCents = 0;
    let totalOutCents = 0;

    for (let i = 0; i <= horizon; i++) {
      const day = new Date(today);
      day.setDate(day.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      const items = schedule.get(key) ?? [];
      let scheduledInCents = 0;
      let scheduledOutCents = 0;
      for (const it of items) {
        if (it.amount >= 0) scheduledInCents += toCents(it.amount);
        else scheduledOutCents += Math.abs(toCents(it.amount));
      }
      const variableCents = i === 0 ? 0 : medianDailySpendCents;
      runningCents += scheduledInCents - scheduledOutCents - variableCents;
      totalInCents += scheduledInCents;
      totalOutCents += scheduledOutCents + variableCents;
      if (runningCents < lowestCents) {
        lowestCents = runningCents;
        lowestDate = key;
      }
      points.push({
        date: key,
        projectedBalance: fromCents(runningCents),
        scheduledIn: fromCents(scheduledInCents),
        scheduledOut: fromCents(scheduledOutCents),
        estimatedVariableSpend: fromCents(variableCents),
        items,
      });
    }

    return {
      horizonDays: horizon,
      startBalance: roundMoney(startBalance),
      endBalance: fromCents(runningCents),
      lowestBalance: fromCents(lowestCents),
      lowestDate,
      totalIn: fromCents(totalInCents),
      totalOut: fromCents(totalOutCents),
      medianDailySpend: fromCents(medianDailySpendCents),
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

    const recurringMonthly = sumMoney(activeRecurring, (r) =>
      frequencyToMonthly(Math.abs(Number(r.amount)), r.frequency),
    );
    const contractMonthly = sumMoney(activeContracts, (c) => c.monthlyCost ?? 0);
    const totalFixedMonthly = fromCents(toCents(recurringMonthly) + toCents(contractMonthly));

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
    const subscriptionTotal = sumMoney(subscriptions, (x) => x.monthlyCost);

    // Kategorien-Median (letzte 5 abgeschlossene Monate) vs. aktueller Monat
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySumByCat = new Map<string, Map<string, number>>(); // monthKey -> categoryId -> Cents
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
      .map(([cid, medianCents]) => ({
        category: catMap.get(cid),
        median: fromCents(medianCents),
        currentMonth: fromCents(currentMonthSums.get(cid) ?? 0),
      }))
      .filter((row) => row.category && row.median > 0 && row.currentMonth > row.median * 1.2)
      .map((row) => ({
        ...row,
        overBy: fromCents(toCents(row.currentMonth) - toCents(row.median)),
        overByPercent: Math.round(((row.currentMonth - row.median) / row.median) * 100),
      }))
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 8);

    const totalSavingsMonthly = comparison.totalSavingsMonthly;
    const totalSavingsYearly = comparison.totalSavingsYearly;

    void currentMonthStart; // keep tree-shake happy
    return {
      totalFixedMonthly: roundMoney(totalFixedMonthly),
      totalFixedYearly: roundMoney(totalFixedMonthly * 12),
      breakdown: {
        recurringMonthly: roundMoney(recurringMonthly),
        contractMonthly: roundMoney(contractMonthly),
      },
      subscriptions: {
        total: roundMoney(subscriptionTotal),
        count: subscriptions.length,
        items: subscriptions.map((s) => ({
          ...s,
          monthlyCost: roundMoney(s.monthlyCost),
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
  return addMonthsClamped(new Date(), -months);
}
