import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { addRecurrence } from '../../platform/common/dates';
import { CreateTaskDto, CreateTaskListDto, UpdateTaskDto, UpdateTaskListDto } from './dto/task.dto';

const TASK_INCLUDE = {
  taskList: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ---------- Aufgaben ----------

  async findAll(
    userId: string,
    opts: { status?: 'open' | 'completed' | 'all'; taskListId?: string; dueBefore?: string } = {},
  ) {
    const status = opts.status ?? 'open';
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        ...(status === 'open' ? { completedAt: null } : {}),
        ...(status === 'completed' ? { completedAt: { not: null } } : {}),
        ...(opts.taskListId ? { taskListId: opts.taskListId } : {}),
        ...(opts.dueBefore ? { dueAt: { lte: new Date(opts.dueBefore) } } : {}),
      },
      include: TASK_INCLUDE,
      orderBy: [{ completedAt: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 500,
    });
    return tasks;
  }

  async create(userId: string, dto: CreateTaskDto) {
    if (dto.taskListId) await this.assertListOwnership(userId, dto.taskListId);
    return this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        notes: dto.notes,
        priority: dto.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        recurrence: dto.recurrence,
        taskListId: dto.taskListId,
      },
      include: TASK_INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Aufgabe nicht gefunden');
    if (dto.taskListId) await this.assertListOwnership(userId, dto.taskListId);

    // Erledigen einer wiederkehrenden Aufgabe erzeugt die nächste Instanz –
    // die erledigte bleibt als Historie stehen.
    if (dto.completed === true && !task.completedAt && task.recurrence && task.dueAt) {
      await this.prisma.task.create({
        data: {
          userId,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          recurrence: task.recurrence,
          taskListId: task.taskListId,
          dueAt: addRecurrence(task.dueAt, task.recurrence, 1, task.dueAt.getDate()),
        },
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
        ...(dto.recurrence !== undefined ? { recurrence: dto.recurrence } : {}),
        ...(dto.taskListId !== undefined ? { taskListId: dto.taskListId } : {}),
        ...(dto.completed !== undefined
          ? { completedAt: dto.completed ? (task.completedAt ?? new Date()) : null }
          : {}),
      },
      include: TASK_INCLUDE,
    });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
    if (!task) throw new NotFoundException('Aufgabe nicht gefunden');
    await this.prisma.task.delete({ where: { id } });
    return { message: 'Aufgabe gelöscht' };
  }

  // ---------- Listen ----------

  async findAllLists(userId: string) {
    return this.prisma.taskList.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { tasks: { where: { completedAt: null } } } } },
    });
  }

  async createList(userId: string, dto: CreateTaskListDto) {
    const existing = await this.prisma.taskList.findFirst({ where: { userId, name: dto.name } });
    if (existing) throw new BadRequestException('Eine Liste mit diesem Namen existiert bereits');
    return this.prisma.taskList.create({ data: { userId, name: dto.name, color: dto.color } });
  }

  async updateList(userId: string, id: string, dto: UpdateTaskListDto) {
    await this.assertListOwnership(userId, id);
    return this.prisma.taskList.update({ where: { id }, data: dto });
  }

  async removeList(userId: string, id: string) {
    await this.assertListOwnership(userId, id);
    // Aufgaben bleiben erhalten (taskListId → null via onDelete: SetNull)
    await this.prisma.taskList.delete({ where: { id } });
    return { message: 'Liste gelöscht' };
  }

  // ---------- Zusammenfassung (Home-Widget / Public API des Moduls) ----------

  async getSummary(userId: string) {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const [open, dueToday, overdue] = await Promise.all([
      this.prisma.task.count({ where: { userId, completedAt: null } }),
      this.prisma.task.count({
        where: { userId, completedAt: null, dueAt: { gte: now, lte: endOfToday } },
      }),
      this.prisma.task.count({ where: { userId, completedAt: null, dueAt: { lt: now } } }),
    ]);
    return { open, dueToday, overdue };
  }

  /** Schmale Public API für die globale Suche. */
  async search(userId: string, q: string, limit = 5) {
    return this.prisma.task.findMany({
      where: { userId, completedAt: null, title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true, dueAt: true, priority: true },
      orderBy: { dueAt: { sort: 'asc', nulls: 'last' } },
      take: limit,
    });
  }

  // ---------- Fälligkeits-Erinnerungen ----------

  // Täglich 08:00 wie die Budget-Warnungen; dedupeKey macht den Lauf idempotent.
  @Cron('0 8 * * *')
  async notifyDueTasks() {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const due = await this.prisma.task.findMany({
      where: { completedAt: null, dueAt: { lte: endOfToday } },
      select: { id: true, userId: true, title: true, dueAt: true },
      take: 1000,
    });
    const today = new Date().toISOString().slice(0, 10);
    for (const task of due) {
      const overdue = task.dueAt! < new Date(new Date().setHours(0, 0, 0, 0));
      await this.notifications.create({
        userId: task.userId,
        type: 'TASK_DUE',
        title: overdue ? 'Aufgabe überfällig' : 'Aufgabe heute fällig',
        message: task.title,
        dedupeKey: `task-due:${task.id}:${today}`,
        data: { taskId: task.id },
      });
    }
    if (due.length > 0) this.logger.log(`Fälligkeits-Check: ${due.length} Aufgabe(n) gemeldet`);
  }

  private async assertListOwnership(userId: string, taskListId: string) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: taskListId, userId },
      select: { id: true },
    });
    if (!list) throw new NotFoundException('Aufgabenliste nicht gefunden');
  }
}
