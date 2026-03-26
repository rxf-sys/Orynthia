import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsGoalDto, UpdateSavingsGoalDto } from './dto/savings-goal.dto';

@Injectable()
export class SavingsGoalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSavingsGoalDto) {
    return this.prisma.savingsGoal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount || 0,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        icon: dto.icon,
        color: dto.color,
      },
    });
  }

  async findAll(userId: string) {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: [{ isCompleted: 'asc' }, { deadline: 'asc' }],
    });

    return goals.map((goal) => {
      const target = Number(goal.targetAmount);
      const current = Number(goal.currentAmount);
      const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
      const remaining = Math.max(0, target - current);

      return {
        ...goal,
        targetAmount: target,
        currentAmount: current,
        percentage,
        remaining,
      };
    });
  }

  async update(userId: string, id: string, dto: UpdateSavingsGoalDto) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
    });
    if (!goal) throw new NotFoundException('Sparziel nicht gefunden');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.targetAmount !== undefined) data.targetAmount = dto.targetAmount;
    if (dto.currentAmount !== undefined) {
      data.currentAmount = dto.currentAmount;
      // Auto-Complete wenn Ziel erreicht
      if (dto.currentAmount >= Number(goal.targetAmount)) {
        data.isCompleted = true;
        data.completedAt = new Date();
      } else {
        data.isCompleted = false;
        data.completedAt = null;
      }
    }
    if (dto.deadline !== undefined) data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;

    return this.prisma.savingsGoal.update({
      where: { id },
      data,
    });
  }

  async addAmount(userId: string, id: string, amount: number) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
    });
    if (!goal) throw new NotFoundException('Sparziel nicht gefunden');

    const newAmount = Number(goal.currentAmount) + amount;
    if (newAmount < 0) throw new BadRequestException('Betrag kann nicht negativ werden');

    const isCompleted = newAmount >= Number(goal.targetAmount);

    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        currentAmount: newAmount,
        isCompleted,
        completedAt: isCompleted && !goal.isCompleted ? new Date() : goal.completedAt,
      },
    });
  }

  async remove(userId: string, id: string) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
    });
    if (!goal) throw new NotFoundException('Sparziel nicht gefunden');

    await this.prisma.savingsGoal.delete({ where: { id } });
    return { message: 'Sparziel gelöscht' };
  }
}
