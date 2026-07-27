import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateHabitDto, UpdateHabitDto } from './dto/habit.dto';

/** Datumsteil ohne Zeitzonen-Drift – Gewohnheiten denken in Kalendertagen. */
function toDateOnly(iso?: string): Date {
  const base = iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000Z`) : new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService) {}

  /** Gewohnheiten mit Historie der letzten Wochen und aktuellem Streak. */
  async findAll(userId: string, opts: { includeArchived?: boolean } = {}) {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const habits = await this.prisma.habit.findMany({
      where: { userId, ...(opts.includeArchived ? {} : { isArchived: false }) },
      include: {
        entries: { where: { date: { gte: since } }, orderBy: { date: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const today = toDateOnly();
    return habits.map((habit) => {
      const days = habit.entries.map((e) => dayKey(e.date));
      const daySet = new Set(days);
      return {
        id: habit.id,
        title: habit.title,
        notes: habit.notes,
        frequency: habit.frequency,
        targetPerPeriod: habit.targetPerPeriod,
        color: habit.color,
        icon: habit.icon,
        isArchived: habit.isArchived,
        doneToday: daySet.has(dayKey(today)),
        streak: this.calcStreak(daySet, habit.frequency, today),
        last30Days: days.filter((d) => d >= dayKey(new Date(today.getTime() - 30 * 86_400_000))),
        completedThisPeriod: this.countThisPeriod(daySet, habit.frequency, today),
      };
    });
  }

  async create(userId: string, dto: CreateHabitDto) {
    return this.prisma.habit.create({ data: { userId, ...dto } });
  }

  async update(userId: string, id: string, dto: UpdateHabitDto) {
    await this.assertOwnership(userId, id);
    return this.prisma.habit.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);
    await this.prisma.habit.delete({ where: { id } });
    return { message: 'Gewohnheit gelöscht' };
  }

  /** Tag abhaken bzw. Haken entfernen. */
  async toggleEntry(userId: string, habitId: string, dateIso?: string) {
    await this.assertOwnership(userId, habitId);
    const date = toDateOnly(dateIso);
    const existing = await this.prisma.habitEntry.findUnique({
      where: { habitId_date: { habitId, date } },
    });
    if (existing) {
      await this.prisma.habitEntry.delete({ where: { id: existing.id } });
      return { done: false, date: dayKey(date) };
    }
    await this.prisma.habitEntry.create({ data: { habitId, date } });
    return { done: true, date: dayKey(date) };
  }

  /** Kompakte Zusammenfassung fürs Home-Widget. */
  async getSummary(userId: string) {
    const habits = await this.findAll(userId);
    return {
      total: habits.length,
      doneToday: habits.filter((h) => h.doneToday).length,
      bestStreak: habits.reduce((max, h) => Math.max(max, h.streak), 0),
    };
  }

  // ---------- Berechnungen ----------

  /**
   * Aktueller Streak in Perioden. Bei täglichen Gewohnheiten zählt jeder
   * lückenlose Tag rückwärts; der heutige Tag darf noch offen sein, ohne
   * den Streak zu brechen. Bei wöchentlichen zählen erreichte Wochen.
   */
  private calcStreak(daySet: Set<string>, frequency: string, today: Date): number {
    if (frequency === 'WEEKLY') {
      let streak = 0;
      for (let week = 0; week < 52; week++) {
        const weekStart = this.startOfWeek(new Date(today.getTime() - week * 7 * 86_400_000));
        const hit = [...Array(7)].some((_, i) =>
          daySet.has(dayKey(new Date(weekStart.getTime() + i * 86_400_000))),
        );
        if (hit) streak++;
        else if (week > 0) break;
      }
      return streak;
    }

    let streak = 0;
    for (let offset = 0; offset < 365; offset++) {
      const day = new Date(today.getTime() - offset * 86_400_000);
      if (daySet.has(dayKey(day))) streak++;
      else if (offset > 0) break;
    }
    return streak;
  }

  private countThisPeriod(daySet: Set<string>, frequency: string, today: Date): number {
    if (frequency === 'WEEKLY') {
      const weekStart = this.startOfWeek(today);
      return [...Array(7)].filter((_, i) =>
        daySet.has(dayKey(new Date(weekStart.getTime() + i * 86_400_000))),
      ).length;
    }
    return daySet.has(dayKey(today)) ? 1 : 0;
  }

  /** Wochenstart Montag (UTC). */
  private startOfWeek(date: Date): Date {
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(date.getTime() - diff * 86_400_000);
  }

  private async assertOwnership(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId }, select: { id: true } });
    if (!habit) throw new NotFoundException('Gewohnheit nicht gefunden');
  }
}
