import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseholdDto, AddMemberDto, CreateSharedExpenseDto } from './dto/shared-expense.dto';

@Injectable()
export class SharedExpensesService {
  constructor(private prisma: PrismaService) {}

  async getHouseholds(userId: string) {
    return this.prisma.household.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: true,
        expenses: {
          include: { shares: true },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });
  }

  async createHousehold(userId: string, dto: CreateHouseholdDto) {
    const household = await this.prisma.household.create({
      data: {
        name: dto.name,
        members: {
          create: [
            { userId, name: 'Ich', role: 'ADMIN' },
            ...(dto.memberNames || []).map((name) => ({ name })),
          ],
        },
      },
      include: { members: true },
    });
    return household;
  }

  async addMember(userId: string, householdId: string, dto: AddMemberDto) {
    const household = await this.prisma.household.findFirst({
      where: { id: householdId, members: { some: { userId, role: 'ADMIN' } } },
    });
    if (!household) throw new NotFoundException('Haushalt nicht gefunden');

    return this.prisma.householdMember.create({
      data: { householdId, name: dto.name, userId: dto.userId },
    });
  }

  async createExpense(userId: string, dto: CreateSharedExpenseDto) {
    const household = await this.prisma.household.findFirst({
      where: { id: dto.householdId, members: { some: { userId } } },
      include: { members: true },
    });
    if (!household) throw new NotFoundException('Haushalt nicht gefunden');

    const members = household.members;
    const splitType = (dto.splitType as 'EQUAL' | 'PERCENTAGE' | 'CUSTOM') || 'EQUAL';

    let shares: { memberId: string; userId: string | null; amount: number }[];

    if (splitType === 'EQUAL') {
      const perPerson = Math.round((dto.amount / members.length) * 100) / 100;
      shares = members.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        amount: perPerson,
      }));
    } else if (dto.shares) {
      shares = dto.shares.map((s) => {
        const member = members.find((m) => m.id === s.memberId);
        return { memberId: s.memberId, userId: member?.userId || null, amount: s.amount };
      });
    } else {
      throw new BadRequestException('Anteile muessen angegeben werden');
    }

    const expense = await this.prisma.sharedExpense.create({
      data: {
        householdId: dto.householdId,
        paidById: userId,
        description: dto.description,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        splitType,
        shares: {
          create: shares.map((s) => ({
            memberId: s.memberId,
            userId: s.userId,
            amount: s.amount,
          })),
        },
      },
      include: { shares: { include: { member: true } } },
    });

    return expense;
  }

  async getBalances(userId: string, householdId: string) {
    const household = await this.prisma.household.findFirst({
      where: { id: householdId, members: { some: { userId } } },
      include: { members: true },
    });
    if (!household) throw new NotFoundException('Haushalt nicht gefunden');

    const expenses = await this.prisma.sharedExpense.findMany({
      where: { householdId },
      include: { shares: true },
    });

    // Calculate: for each member, how much they paid vs how much they owe
    const balances = new Map<string, { name: string; paid: number; owes: number; net: number }>();
    for (const member of household.members) {
      balances.set(member.id, { name: member.name, paid: 0, owes: 0, net: 0 });
    }

    for (const expense of expenses) {
      // Who paid
      const payer = household.members.find((m) => m.userId === expense.paidById);
      if (payer && balances.has(payer.id)) {
        balances.get(payer.id)!.paid += Number(expense.amount);
      }

      // Who owes
      for (const share of expense.shares) {
        if (!share.isSettled && balances.has(share.memberId)) {
          balances.get(share.memberId)!.owes += Number(share.amount);
        }
      }
    }

    const result = Array.from(balances.values()).map((b) => ({
      ...b,
      net: Math.round((b.paid - b.owes) * 100) / 100,
    }));

    return { members: result };
  }

  async settleShare(userId: string, shareId: string) {
    const share = await this.prisma.sharedExpenseShare.findFirst({
      where: { id: shareId, expense: { household: { members: { some: { userId } } } } },
    });
    if (!share) throw new NotFoundException('Anteil nicht gefunden');

    return this.prisma.sharedExpenseShare.update({
      where: { id: shareId },
      data: { isSettled: true },
    });
  }

  async removeExpense(userId: string, expenseId: string) {
    const expense = await this.prisma.sharedExpense.findFirst({
      where: { id: expenseId, household: { members: { some: { userId } } } },
    });
    if (!expense) throw new NotFoundException('Ausgabe nicht gefunden');

    await this.prisma.sharedExpense.delete({ where: { id: expenseId } });
    return { message: 'Ausgabe geloescht' };
  }
}
