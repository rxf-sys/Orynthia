import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvestmentDto, UpdateInvestmentDto, UpdatePriceDto } from './dto/investment.dto';

@Injectable()
export class InvestmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const positions = await this.prisma.investmentPosition.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: { bankAccount: { select: { id: true, accountName: true, bankName: true } } },
    });

    let totalValue = 0;
    let totalInvested = 0;
    const items = positions.map((p) => {
      const q = Number(p.quantity);
      const avg = Number(p.averagePrice);
      const cur = p.currentPrice !== null ? Number(p.currentPrice) : null;
      const invested = q * avg;
      const value = cur !== null ? q * cur : invested;
      const gainLoss = cur !== null ? value - invested : 0;
      const gainLossPercent = invested > 0 && cur !== null ? (gainLoss / invested) * 100 : 0;
      totalInvested += invested;
      totalValue += value;
      return {
        ...p,
        quantity: q,
        averagePrice: avg,
        currentPrice: cur,
        invested: round2(invested),
        currentValue: round2(value),
        gainLoss: round2(gainLoss),
        gainLossPercent: Math.round(gainLossPercent * 100) / 100,
      };
    });

    const totalGainLoss = totalValue - totalInvested;
    const totalGainLossPercent =
      totalInvested > 0 ? Math.round(((totalGainLoss / totalInvested) * 100) * 100) / 100 : 0;

    // Allocation nach Typ
    const byTypeMap = new Map<string, { value: number; count: number }>();
    for (const i of items) {
      const entry = byTypeMap.get(i.type) ?? { value: 0, count: 0 };
      entry.value += i.currentValue;
      entry.count += 1;
      byTypeMap.set(i.type, entry);
    }
    const allocation = [...byTypeMap.entries()]
      .map(([type, { value, count }]) => ({
        type,
        value: round2(value),
        count,
        percent: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      positions: items,
      summary: {
        totalInvested: round2(totalInvested),
        totalValue: round2(totalValue),
        totalGainLoss: round2(totalGainLoss),
        totalGainLossPercent,
        positionCount: items.length,
      },
      allocation,
    };
  }

  async create(userId: string, dto: CreateInvestmentDto) {
    if (dto.bankAccountId) await this.verifyAccount(userId, dto.bankAccountId);
    return this.prisma.investmentPosition.create({
      data: {
        userId,
        symbol: dto.symbol.trim(),
        name: dto.name.trim(),
        type: dto.type ?? 'STOCK',
        quantity: dto.quantity,
        averagePrice: dto.averagePrice,
        currentPrice: dto.currentPrice ?? null,
        currency: dto.currency ?? 'EUR',
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        lastPriceUpdate: dto.currentPrice !== undefined ? new Date() : null,
        bankAccountId: dto.bankAccountId ?? null,
        notes: dto.notes,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateInvestmentDto) {
    const found = await this.prisma.investmentPosition.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Position nicht gefunden');
    if (dto.bankAccountId) await this.verifyAccount(userId, dto.bankAccountId);

    const { purchaseDate, currentPrice, ...rest } = dto;
    const data: Prisma.InvestmentPositionUpdateInput = {
      ...rest,
      ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
      ...(currentPrice !== undefined && {
        currentPrice,
        lastPriceUpdate: new Date(),
      }),
    };
    return this.prisma.investmentPosition.update({ where: { id }, data });
  }

  async updatePrice(userId: string, id: string, dto: UpdatePriceDto) {
    const found = await this.prisma.investmentPosition.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Position nicht gefunden');
    return this.prisma.investmentPosition.update({
      where: { id },
      data: { currentPrice: dto.currentPrice, lastPriceUpdate: new Date() },
    });
  }

  async remove(userId: string, id: string) {
    const found = await this.prisma.investmentPosition.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Position nicht gefunden');
    await this.prisma.investmentPosition.delete({ where: { id } });
    return { message: 'Position gelöscht' };
  }

  private async verifyAccount(userId: string, accountId: string) {
    const account = await this.prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('Konto gehört nicht zu diesem User');
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
