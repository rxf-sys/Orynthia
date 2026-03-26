import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHoldingDto, UpdateHoldingDto } from './dto/portfolio.dto';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string) {
    const holdings = await this.prisma.portfolioHolding.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return holdings.map((h) => {
      const quantity = Number(h.quantity);
      const avgBuyPrice = Number(h.avgBuyPrice);
      const currentPrice = Number(h.currentPrice);
      const totalInvested = quantity * avgBuyPrice;
      const currentValue = quantity * currentPrice;
      const profitLoss = currentValue - totalInvested;
      const profitLossPercent = totalInvested > 0
        ? Math.round((profitLoss / totalInvested) * 10000) / 100
        : 0;

      return {
        ...h,
        quantity,
        avgBuyPrice,
        currentPrice,
        totalInvested: Math.round(totalInvested * 100) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        profitLoss: Math.round(profitLoss * 100) / 100,
        profitLossPercent,
      };
    });
  }

  async getSummary(userId: string) {
    const holdings = await this.getAll(userId);

    const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0);
    const totalCurrentValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const totalProfitLoss = totalCurrentValue - totalInvested;
    const totalProfitLossPercent = totalInvested > 0
      ? Math.round((totalProfitLoss / totalInvested) * 10000) / 100
      : 0;

    // Group by type
    const byType = new Map<string, { type: string; value: number; invested: number; items: number }>();
    for (const h of holdings) {
      const type = h.holdingType;
      if (!byType.has(type)) {
        byType.set(type, { type, value: 0, invested: 0, items: 0 });
      }
      const group = byType.get(type)!;
      group.value += h.currentValue;
      group.invested += h.totalInvested;
      group.items += 1;
    }

    return {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
      totalProfitLossPercent,
      holdingsCount: holdings.length,
      byType: Array.from(byType.values()),
      holdings,
    };
  }

  async create(userId: string, dto: CreateHoldingDto) {
    const holding = await this.prisma.portfolioHolding.create({
      data: {
        userId,
        symbol: dto.symbol.toUpperCase(),
        name: dto.name,
        holdingType: dto.holdingType as any,
        quantity: dto.quantity,
        avgBuyPrice: dto.avgBuyPrice,
        currentPrice: dto.currentPrice,
        currency: dto.currency || 'EUR',
        exchange: dto.exchange,
        isin: dto.isin,
      },
    });

    return {
      ...holding,
      quantity: Number(holding.quantity),
      avgBuyPrice: Number(holding.avgBuyPrice),
      currentPrice: Number(holding.currentPrice),
    };
  }

  async update(userId: string, id: string, dto: UpdateHoldingDto) {
    const holding = await this.prisma.portfolioHolding.findFirst({
      where: { id, userId },
    });
    if (!holding) throw new NotFoundException('Position nicht gefunden');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.avgBuyPrice !== undefined) data.avgBuyPrice = dto.avgBuyPrice;
    if (dto.currentPrice !== undefined) data.currentPrice = dto.currentPrice;
    if (dto.exchange !== undefined) data.exchange = dto.exchange;
    if (dto.isin !== undefined) data.isin = dto.isin;

    const updated = await this.prisma.portfolioHolding.update({
      where: { id },
      data,
    });

    return {
      ...updated,
      quantity: Number(updated.quantity),
      avgBuyPrice: Number(updated.avgBuyPrice),
      currentPrice: Number(updated.currentPrice),
    };
  }

  async remove(userId: string, id: string) {
    const holding = await this.prisma.portfolioHolding.findFirst({
      where: { id, userId },
    });
    if (!holding) throw new NotFoundException('Position nicht gefunden');

    await this.prisma.portfolioHolding.delete({ where: { id } });
    return { message: 'Position geloescht' };
  }
}
