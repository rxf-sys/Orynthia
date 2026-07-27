import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrisma = {
    task: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    taskList: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockNotifications = { create: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('wirft NotFound für fremde Aufgaben (Ownership)', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);
      await expect(service.update('user1', 'task1', { completed: true })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('erzeugt beim Erledigen einer wiederkehrenden Aufgabe die nächste Instanz', async () => {
      const dueAt = new Date('2026-01-31T09:00:00.000Z');
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task1',
        userId: 'user1',
        title: 'Miete überweisen',
        notes: null,
        priority: 'MEDIUM',
        recurrence: 'MONTHLY',
        taskListId: null,
        dueAt,
        completedAt: null,
      });
      mockPrisma.task.create.mockResolvedValue({});
      mockPrisma.task.update.mockResolvedValue({});

      await service.update('user1', 'task1', { completed: true });

      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);
      const created = mockPrisma.task.create.mock.calls[0][0].data;
      // 31. Jan + 1 Monat → auf Monatsende Februar geklemmt (kein Drift in den März)
      expect(created.dueAt.getMonth()).toBe(1);
      expect(created.dueAt.getDate()).toBe(28);
      expect(created.recurrence).toBe('MONTHLY');
    });

    it('erzeugt keine neue Instanz beim erneuten Speichern einer bereits erledigten Aufgabe', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task1',
        userId: 'user1',
        recurrence: 'WEEKLY',
        dueAt: new Date(),
        completedAt: new Date(),
      });
      mockPrisma.task.update.mockResolvedValue({});

      await service.update('user1', 'task1', { completed: true });
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyDueTasks', () => {
    it('meldet fällige Aufgaben mit tagesgenauem dedupeKey', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't1', userId: 'user1', title: 'Reifen wechseln', dueAt: new Date('2000-01-01') },
      ]);
      mockNotifications.create.mockResolvedValue({});

      await service.notifyDueTasks();

      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      const arg = mockNotifications.create.mock.calls[0][0];
      expect(arg.type).toBe('TASK_DUE');
      expect(arg.dedupeKey).toMatch(/^task-due:t1:\d{4}-\d{2}-\d{2}$/);
      expect(arg.title).toBe('Aufgabe überfällig');
    });
  });

  describe('removeList', () => {
    it('wirft NotFound für fremde Listen (Ownership)', async () => {
      mockPrisma.taskList.findFirst.mockResolvedValue(null);
      await expect(service.removeList('user1', 'list1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.taskList.delete).not.toHaveBeenCalled();
    });
  });
});
