import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringPaymentDto, UpdateRecurringPaymentDto } from './dto/recurring-payment.dto';

@Injectable()
export class RecurringPaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecurringPaymentDto) {
    return this.prisma.recurringPayment.create({
      data: {
        userId,
        name: dto.name,
        amount: dto.amount,
        frequency: dto.frequency as any || 'MONTHLY',
        counterpartName: dto.counterpartName,
        categoryId: dto.categoryId || null,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    });
  }

  async findAll(userId: string) {
    const payments = await this.prisma.recurringPayment.findMany({
      where: { userId },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
    });

    // Monatliche Gesamtkosten berechnen
    const monthlyTotal = payments
      .filter((p) => p.isActive)
      .reduce((sum, p) => {
        const amount = Math.abs(Number(p.amount));
        switch (p.frequency) {
          case 'WEEKLY': return sum + amount * 4.33;
          case 'BIWEEKLY': return sum + amount * 2.17;
          case 'MONTHLY': return sum + amount;
          case 'QUARTERLY': return sum + amount / 3;
          case 'BIANNUALLY': return sum + amount / 6;
          case 'YEARLY': return sum + amount / 12;
          default: return sum + amount;
        }
      }, 0);

    const yearlyTotal = monthlyTotal * 12;

    return { payments, monthlyTotal: Math.round(monthlyTotal * 100) / 100, yearlyTotal: Math.round(yearlyTotal * 100) / 100 };
  }

  async update(userId: string, id: string, dto: UpdateRecurringPaymentDto) {
    const payment = await this.prisma.recurringPayment.findFirst({
      where: { id, userId },
    });
    if (!payment) throw new NotFoundException('Wiederkehrende Zahlung nicht gefunden');

    return this.prisma.recurringPayment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency as any }),
        ...(dto.counterpartName !== undefined && { counterpartName: dto.counterpartName }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
        ...(dto.nextDueDate !== undefined && { nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const payment = await this.prisma.recurringPayment.findFirst({
      where: { id, userId },
    });
    if (!payment) throw new NotFoundException('Wiederkehrende Zahlung nicht gefunden');

    await this.prisma.recurringPayment.delete({ where: { id } });
    return { message: 'Wiederkehrende Zahlung gelöscht' };
  }
}
