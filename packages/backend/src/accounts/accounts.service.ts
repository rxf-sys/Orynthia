import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        bankName: true,
        accountName: true,
        iban: true,
        accountType: true,
        balance: true,
        currency: true,
        lastSynced: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getTotalBalance(userId: string) {
    const accounts = await this.findAll(userId);
    const total = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    return { totalBalance: total, currency: 'EUR', accountCount: accounts.length };
  }

  async create(userId: string, data: CreateAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        userId,
        bankName: data.bankName,
        accountName: data.accountName,
        iban: data.iban,
        bic: data.bic,
        accountType: data.accountType || 'CHECKING',
        balance: data.balance || 0,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateAccountDto) {
    const account = await this.prisma.bankAccount.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException('Konto nicht gefunden');
    return this.prisma.bankAccount.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const account = await this.prisma.bankAccount.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException('Konto nicht gefunden');
    await this.prisma.bankAccount.update({ where: { id }, data: { isActive: false } });
    return { message: 'Konto deaktiviert' };
  }
}
