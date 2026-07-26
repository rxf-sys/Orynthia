import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateNotificationInput {
  userId: string;
  type: Prisma.NotificationCreateInput['type'];
  title: string;
  message: string;
  dedupeKey?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, opts: { unread?: boolean; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unread ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markAsRead(userId: string, id: string) {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Benachrichtigung nicht gefunden');
    if (found.isRead) return found;
    return this.prisma.notification.update({
      where: { id },
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

  async remove(userId: string, id: string) {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Benachrichtigung nicht gefunden');
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Benachrichtigung gelöscht' };
  }

  async create(input: CreateNotificationInput) {
    if (input.dedupeKey) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          data: { path: ['dedupeKey'], equals: input.dedupeKey },
        },
        select: { id: true },
      });
      if (existing) return null;
    }
    const data: Prisma.InputJsonValue = {
      ...(input.data ?? {}),
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    };
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data,
      },
    });
  }

  /**
   * Großbetrag-Erkennung beim Anlegen einer Transaktion.
   * Schwelle: > 2× Median der letzten 90 Tage (gleicher amount-Sign) und > 200 €.
   */
  async maybeNotifyLargeTransaction(params: {
    userId: string;
    transactionId: string;
    amount: number;
    counterpartName?: string | null;
    purpose?: string | null;
  }) {
    const abs = Math.abs(params.amount);
    if (abs < 200) return;

    const ninetyAgo = new Date();
    ninetyAgo.setDate(ninetyAgo.getDate() - 90);

    const peers = await this.prisma.transaction.findMany({
      where: {
        bankAccount: { userId: params.userId },
        date: { gte: ninetyAgo },
        amount: params.amount < 0 ? { lt: 0 } : { gt: 0 },
      },
      select: { amount: true },
      take: 500,
    });
    if (peers.length < 5) return;

    const sortedAbs = peers.map((p) => Math.abs(Number(p.amount))).sort((a, b) => a - b);
    const median = sortedAbs[Math.floor(sortedAbs.length / 2)];
    if (median <= 0 || abs <= median * 2) return;

    await this.create({
      userId: params.userId,
      type: 'LARGE_TRANSACTION',
      title: 'Ungewöhnlich hohe Buchung',
      message:
        `${abs.toFixed(2)} € ${params.amount < 0 ? 'an' : 'von'} ${params.counterpartName || params.purpose || 'unbekannt'} ` +
        `– mehr als das Doppelte deines üblichen Werts (Median ${median.toFixed(2)} €).`,
      dedupeKey: `tx-${params.transactionId}`,
      data: { transactionId: params.transactionId },
    });
  }

  /** Täglich 08:00: Budget-Status prüfen und ggf. Notifications anlegen. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runBudgetCheck() {
    this.logger.log('Budget-Check Cron läuft …');
    const budgets = await this.prisma.budget.findMany({
      where: { isActive: true },
      include: { category: { select: { name: true } } },
    });

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    for (const b of budgets) {
      const spentAgg = await this.prisma.transaction.aggregate({
        where: {
          bankAccount: { userId: b.userId },
          categoryId: b.categoryId,
          amount: { lt: 0 },
          date: { gte: startOfMonth, lt: endOfMonth },
        },
        _sum: { amount: true },
      });
      const spent = Math.abs(Number(spentAgg._sum.amount ?? 0));
      const limit = Number(b.amount);
      if (limit <= 0) continue;
      const pct = (spent / limit) * 100;

      if (pct >= 100) {
        await this.create({
          userId: b.userId,
          type: 'BUDGET_EXCEEDED',
          title: `Budget überschritten: ${b.category.name}`,
          message: `Du hast ${spent.toFixed(2)} € von ${limit.toFixed(2)} € (${pct.toFixed(0)} %) ausgegeben.`,
          dedupeKey: `budget-exceeded-${b.id}-${monthKey}`,
          data: { budgetId: b.id, categoryId: b.categoryId, spent, limit },
        });
      } else if (pct >= 80) {
        await this.create({
          userId: b.userId,
          type: 'BUDGET_WARNING',
          title: `Budget knapp: ${b.category.name}`,
          message: `Du hast bereits ${pct.toFixed(0)} % deines Budgets (${spent.toFixed(2)} € von ${limit.toFixed(2)} €) verbraucht.`,
          dedupeKey: `budget-warning-${b.id}-${monthKey}`,
          data: { budgetId: b.id, categoryId: b.categoryId, spent, limit },
        });
      }
    }
  }

  /** Täglich 08:00: anstehende wiederkehrende Zahlungen (nächste 3 Tage). */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runRecurringDueCheck() {
    this.logger.log('RecurringDue-Check Cron läuft …');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inThreeDays = new Date(today);
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    const due = await this.prisma.recurringPayment.findMany({
      where: {
        isActive: true,
        nextDueDate: { gte: today, lte: inThreeDays },
      },
    });

    for (const p of due) {
      const dueKey = p.nextDueDate!.toISOString().slice(0, 10);
      await this.create({
        userId: p.userId,
        type: 'RECURRING_DETECTED',
        title: `Bald fällig: ${p.name}`,
        message: `${Math.abs(Number(p.amount)).toFixed(2)} € am ${p.nextDueDate!.toLocaleDateString('de-DE')} (${p.counterpartName ?? p.name}).`,
        dedupeKey: `recurring-due-${p.id}-${dueKey}`,
        data: { recurringPaymentId: p.id, dueDate: dueKey },
      });
    }
  }
}
