import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HabitsService } from './habits.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

/** Tag relativ zu heute (UTC-Mitternacht), wie ihn der Service speichert. */
function dayAgo(offset: number): Date {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - offset * 86_400_000);
}

describe('HabitsService', () => {
  let service: HabitsService;

  const mockPrisma = {
    habit: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    habitEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const habit = (entries: Date[], frequency = 'DAILY') => ({
    id: 'h1',
    title: 'Lesen',
    notes: null,
    frequency,
    targetPerPeriod: 1,
    color: null,
    icon: null,
    isArchived: false,
    entries: entries.map((date, i) => ({ id: `e${i}`, date })),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HabitsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<HabitsService>(HabitsService);
    jest.clearAllMocks();
  });

  describe('Streak-Berechnung (täglich)', () => {
    it('zählt lückenlose Tage inklusive heute', async () => {
      mockPrisma.habit.findMany.mockResolvedValue([habit([dayAgo(0), dayAgo(1), dayAgo(2)])]);

      const [result] = await service.findAll('u1');

      expect(result.streak).toBe(3);
      expect(result.doneToday).toBe(true);
    });

    it('bricht den Streak nicht, wenn heute noch offen ist', async () => {
      mockPrisma.habit.findMany.mockResolvedValue([habit([dayAgo(1), dayAgo(2)])]);

      const [result] = await service.findAll('u1');

      // Gestern und vorgestern erledigt, heute noch offen → Streak bleibt 2
      expect(result.streak).toBe(2);
      expect(result.doneToday).toBe(false);
    });

    it('endet der Streak an der ersten Lücke', async () => {
      mockPrisma.habit.findMany.mockResolvedValue([habit([dayAgo(0), dayAgo(1), dayAgo(5)])]);

      const [result] = await service.findAll('u1');
      expect(result.streak).toBe(2);
    });

    it('liefert 0 ohne Einträge', async () => {
      mockPrisma.habit.findMany.mockResolvedValue([habit([])]);

      const [result] = await service.findAll('u1');
      expect(result.streak).toBe(0);
      expect(result.doneToday).toBe(false);
    });
  });

  describe('Streak-Berechnung (wöchentlich)', () => {
    it('zählt Wochen mit mindestens einem Eintrag', async () => {
      // Exakte Wochenabstände, damit der Test unabhängig vom Wochentag ist
      mockPrisma.habit.findMany.mockResolvedValue([
        habit([dayAgo(0), dayAgo(7), dayAgo(14)], 'WEEKLY'),
      ]);

      const [result] = await service.findAll('u1');
      expect(result.streak).toBe(3);
    });

    it('bricht bei einer ausgelassenen Woche ab', async () => {
      mockPrisma.habit.findMany.mockResolvedValue([
        habit([dayAgo(0), dayAgo(7), dayAgo(28)], 'WEEKLY'),
      ]);

      const [result] = await service.findAll('u1');
      expect(result.streak).toBe(2);
    });
  });

  describe('toggleEntry', () => {
    it('legt einen Eintrag an, wenn der Tag noch offen ist', async () => {
      mockPrisma.habit.findFirst.mockResolvedValue({ id: 'h1' });
      mockPrisma.habitEntry.findUnique.mockResolvedValue(null);

      const result = await service.toggleEntry('u1', 'h1');

      expect(result.done).toBe(true);
      expect(mockPrisma.habitEntry.create).toHaveBeenCalled();
    });

    it('entfernt einen bestehenden Eintrag wieder', async () => {
      mockPrisma.habit.findFirst.mockResolvedValue({ id: 'h1' });
      mockPrisma.habitEntry.findUnique.mockResolvedValue({ id: 'e1' });

      const result = await service.toggleEntry('u1', 'h1');

      expect(result.done).toBe(false);
      expect(mockPrisma.habitEntry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('wirft NotFound für fremde Gewohnheiten', async () => {
      mockPrisma.habit.findFirst.mockResolvedValue(null);
      await expect(service.toggleEntry('u1', 'fremd')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.habitEntry.create).not.toHaveBeenCalled();
    });
  });
});
