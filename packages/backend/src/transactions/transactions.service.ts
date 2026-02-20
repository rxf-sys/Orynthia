import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, UpdateTransactionDto, TransactionFilterDto } from './dto/transaction.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransactionDto) {
    // Prüfe ob Konto dem User gehört
    await this.verifyAccountOwnership(userId, dto.bankAccountId);

    // Auto-Kategorisierung wenn keine Kategorie angegeben
    let categoryId = dto.categoryId;
    if (!categoryId && dto.counterpartName) {
      categoryId = await this.autoCategorize(userId, dto.counterpartName, dto.purpose);
    }

    return this.prisma.transaction.create({
      data: {
        bankAccountId: dto.bankAccountId,
        categoryId,
        amount: dto.amount,
        date: new Date(dto.date),
        purpose: dto.purpose,
        counterpartName: dto.counterpartName,
        counterpartIban: dto.counterpartIban,
        type: dto.type || (dto.amount >= 0 ? 'INCOME' : 'EXPENSE'),
        notes: dto.notes,
        tags: dto.tags || [],
      },
      include: { category: true, bankAccount: { select: { accountName: true, bankName: true } } },
    });
  }

  async findAll(userId: string, filters: TransactionFilterDto) {
    const where: Prisma.TransactionWhereInput = {
      bankAccount: { userId },
    };

    if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.type) where.type = filters.type;

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      where.OR = [
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        { counterpartName: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          bankAccount: { select: { accountName: true, bankName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        bankAccount: { select: { id: true, accountName: true, bankName: true, userId: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaktion nicht gefunden');
    if (transaction.bankAccount.userId !== userId) throw new ForbiddenException();

    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.findById(userId, id); // Ownership check

    return this.prisma.transaction.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findById(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
    return { message: 'Transaktion gelöscht' };
  }

  // Ausgaben nach Kategorie aggregieren
  async getExpensesByCategory(userId: string, startDate: Date, endDate: Date) {
    const result = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        bankAccount: { userId },
        amount: { lt: 0 },
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Kategorie-Details laden
    const categoryIds = result.map(r => r.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const catMap = new Map(categories.map(c => [c.id, c]));

    return result.map(r => ({
      category: r.categoryId ? catMap.get(r.categoryId) : { name: 'Unkategorisiert', icon: '❓', color: '#94a3b8' },
      totalAmount: Math.abs(Number(r._sum.amount)),
      count: r._count.id,
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  // Monatliche Übersicht
  async getMonthlyOverview(userId: string, months: number = 6) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        bankAccount: { userId },
        date: { gte: startDate },
      },
      select: { amount: true, date: true },
    });

    // Nach Monat gruppieren
    const monthlyData = new Map<string, { income: number; expenses: number }>();

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, { income: 0, expenses: 0 });
    }

    for (const tx of transactions) {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyData.get(key);
      if (entry) {
        const amount = Number(tx.amount);
        if (amount >= 0) entry.income += amount;
        else entry.expenses += Math.abs(amount);
      }
    }

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({ month, ...data }))
      .reverse();
  }

  // --- Private Helpers ---

  private async verifyAccountOwnership(userId: string, accountId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new ForbiddenException('Konto gehört nicht diesem Benutzer');
  }

  private async autoCategorize(userId: string, counterpartName: string, purpose?: string): Promise<string | undefined> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
    });

    const searchText = `${counterpartName} ${purpose || ''}`.toLowerCase();

    for (const cat of categories) {
      for (const keyword of cat.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return cat.id;
        }
      }
    }

    return undefined;
  }
}
