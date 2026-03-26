import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { userId },
      include: {
        snapshots: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assets.map((asset) => ({
      ...asset,
      value: Number(asset.value),
      interestRate: asset.interestRate ? Number(asset.interestRate) : null,
      latestSnapshot: asset.snapshots[0]
        ? { value: Number(asset.snapshots[0].value), date: asset.snapshots[0].date }
        : null,
      snapshots: undefined,
    }));
  }

  async create(userId: string, dto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      data: {
        userId,
        name: dto.name,
        assetType: dto.assetType as any,
        value: dto.value,
        currency: dto.currency || 'EUR',
        isLiability: dto.isLiability || false,
        interestRate: dto.interestRate ?? null,
        institution: dto.institution ?? null,
        notes: dto.notes ?? null,
      },
    });

    // Create initial snapshot
    await this.prisma.assetSnapshot.create({
      data: {
        assetId: asset.id,
        value: dto.value,
        date: new Date(),
      },
    });

    return {
      ...asset,
      value: Number(asset.value),
      interestRate: asset.interestRate ? Number(asset.interestRate) : null,
    };
  }

  async update(userId: string, id: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, userId },
    });
    if (!asset) throw new NotFoundException('Asset nicht gefunden');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.assetType !== undefined) data.assetType = dto.assetType;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.isLiability !== undefined) data.isLiability = dto.isLiability;
    if (dto.interestRate !== undefined) data.interestRate = dto.interestRate;
    if (dto.institution !== undefined) data.institution = dto.institution;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.asset.update({
      where: { id },
      data,
    });

    // If value changed, create a new snapshot
    if (dto.value !== undefined && dto.value !== Number(asset.value)) {
      await this.prisma.assetSnapshot.create({
        data: {
          assetId: id,
          value: dto.value,
          date: new Date(),
        },
      });
    }

    return {
      ...updated,
      value: Number(updated.value),
      interestRate: updated.interestRate ? Number(updated.interestRate) : null,
    };
  }

  async remove(userId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, userId },
    });
    if (!asset) throw new NotFoundException('Asset nicht gefunden');

    await this.prisma.asset.delete({ where: { id } });
    return { message: 'Asset geloescht' };
  }

  async getNetWorth(userId: string) {
    // Fetch all assets for the user
    const assets = await this.prisma.asset.findMany({
      where: { userId },
      include: {
        snapshots: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    // Fetch bank accounts
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { userId, isActive: true },
    });

    // Separate assets and liabilities
    const assetItems = assets.filter((a) => !a.isLiability);
    const liabilityItems = assets.filter((a) => a.isLiability);

    const totalAssets =
      assetItems.reduce((sum, a) => sum + Number(a.value), 0) +
      bankAccounts.reduce((sum, ba) => sum + Number(ba.balance), 0);

    const totalLiabilities = liabilityItems.reduce((sum, a) => sum + Number(a.value), 0);

    const netWorth = totalAssets - totalLiabilities;

    // Group by type
    const byTypeMap = new Map<string, { type: string; items: { name: string; value: number }[]; total: number }>();
    for (const asset of assets) {
      const type = asset.assetType;
      if (!byTypeMap.has(type)) {
        byTypeMap.set(type, { type, items: [], total: 0 });
      }
      const group = byTypeMap.get(type)!;
      const value = Number(asset.value);
      group.items.push({ name: asset.name, value });
      group.total += value;
    }

    // Get net worth history (last 12 months)
    const history = await this.getNetWorthHistory(userId, 12);

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      byType: Array.from(byTypeMap.values()),
      bankAccounts: {
        total: bankAccounts.reduce((sum, ba) => sum + Number(ba.balance), 0),
        accounts: bankAccounts.map((ba) => ({
          name: ba.accountName,
          balance: Number(ba.balance),
        })),
      },
      history,
    };
  }

  async getNetWorthHistory(userId: string, months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Get all asset snapshots in the time range
    const snapshots = await this.prisma.assetSnapshot.findMany({
      where: {
        asset: { userId },
        date: { gte: startDate },
      },
      include: {
        asset: {
          select: { isLiability: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Get bank account balances (current only, since no history model exists)
    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { userId, isActive: true },
    });
    const bankTotal = bankAccounts.reduce((sum, ba) => sum + Number(ba.balance), 0);

    // Aggregate snapshots by month
    const monthlyData = new Map<string, { assets: number; liabilities: number }>();

    for (const snapshot of snapshots) {
      const monthKey = `${snapshot.date.getFullYear()}-${String(snapshot.date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { assets: 0, liabilities: 0 });
      }

      const entry = monthlyData.get(monthKey)!;
      const value = Number(snapshot.value);

      if (snapshot.asset.isLiability) {
        entry.liabilities += value;
      } else {
        entry.assets += value;
      }
    }

    // Build history array with monthly net worth
    // For each month, use last known snapshot values per asset
    const allAssets = await this.prisma.asset.findMany({
      where: { userId },
      select: { id: true, isLiability: true },
    });

    const history: { date: string; netWorth: number }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      let totalAssets = bankTotal;
      let totalLiabilities = 0;

      // For each asset, find the latest snapshot up to this month
      for (const asset of allAssets) {
        const latestSnapshot = await this.prisma.assetSnapshot.findFirst({
          where: {
            assetId: asset.id,
            date: { lte: monthEnd },
          },
          orderBy: { date: 'desc' },
        });

        if (latestSnapshot) {
          const value = Number(latestSnapshot.value);
          if (asset.isLiability) {
            totalLiabilities += value;
          } else {
            totalAssets += value;
          }
        }
      }

      history.push({
        date: monthKey,
        netWorth: totalAssets - totalLiabilities,
      });
    }

    return history;
  }

  async createSnapshot(userId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { userId },
    });

    const now = new Date();
    const snapshots = await Promise.all(
      assets.map((asset) =>
        this.prisma.assetSnapshot.create({
          data: {
            assetId: asset.id,
            value: asset.value,
            date: now,
          },
        }),
      ),
    );

    return {
      message: `${snapshots.length} Snapshots erstellt`,
      count: snapshots.length,
    };
  }
}
