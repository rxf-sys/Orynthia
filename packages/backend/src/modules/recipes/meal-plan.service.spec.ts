import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MealPlanService } from './meal-plan.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ListsService } from '../lists/lists.service';

describe('MealPlanService', () => {
  let service: MealPlanService;

  const mockPrisma = {
    mealPlanEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recipe: { findFirst: jest.fn(), findMany: jest.fn() },
  };

  const mockLists = { addMergedItems: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlanService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ListsService, useValue: mockLists },
      ],
    }).compile();

    service = module.get<MealPlanService>(MealPlanService);
    jest.clearAllMocks();
  });

  describe('findRange', () => {
    it('lehnt umgedrehte und zu große Zeiträume ab', async () => {
      await expect(service.findRange('u1', '2026-08-10', '2026-08-01')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findRange('u1', '2026-01-01', '2026-12-31')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('create', () => {
    it('verlangt Rezept oder Titel', async () => {
      await expect(service.create('u1', { date: '2026-08-03' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('übernimmt die Rezept-Portionen als Vorgabe', async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({ servings: 4 });
      mockPrisma.mealPlanEntry.create.mockResolvedValue({});

      await service.create('u1', { recipeId: 'r1', date: '2026-08-03' });

      expect(mockPrisma.mealPlanEntry.create.mock.calls[0][0].data.servings).toBe(4);
    });

    it('wirft NotFound für fremde Rezepte', async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);
      await expect(service.create('u1', { recipeId: 'fremd', date: '2026-08-03' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('erlaubt Freitext-Mahlzeiten ohne Rezept', async () => {
      mockPrisma.mealPlanEntry.create.mockResolvedValue({});
      await service.create('u1', { title: 'Essen gehen', date: '2026-08-03' });
      const data = mockPrisma.mealPlanEntry.create.mock.calls[0][0].data;
      expect(data.title).toBe('Essen gehen');
      expect(data.recipeId).toBeUndefined();
    });
  });

  describe('addRangeToList', () => {
    it('skaliert je Mahlzeit auf die geplanten Portionen und bündelt alles', async () => {
      mockPrisma.mealPlanEntry.findMany.mockResolvedValue([
        { id: 'm1', recipeId: 'r1', servings: 4, date: new Date('2026-08-03'), slot: 'DINNER' },
        { id: 'm2', recipeId: 'r1', servings: 2, date: new Date('2026-08-05'), slot: 'DINNER' },
      ]);
      mockPrisma.recipe.findMany.mockResolvedValue([
        {
          id: 'r1',
          servings: 2,
          ingredients: [
            { name: 'Nudeln', amount: new Prisma.Decimal(200), unit: 'g' },
            { name: 'Salz', amount: null, unit: null },
          ],
        },
      ]);
      mockLists.addMergedItems.mockResolvedValue({ added: 2, updated: 0 });

      const result = await service.addRangeToList('u1', {
        listId: 'l1',
        from: '2026-08-03',
        to: '2026-08-09',
      });

      expect(result.meals).toBe(2);
      const items = mockLists.addMergedItems.mock.calls[0][2];
      // 4 Portionen → Faktor 2 → 400 g; 2 Portionen → Faktor 1 → 200 g
      expect(items.filter((i: { name: string }) => i.name === 'Nudeln').map((i: { amount: number }) => i.amount)).toEqual([
        400, 200,
      ]);
      // Zutat ohne Menge bleibt ohne Menge
      expect(items.find((i: { name: string }) => i.name === 'Salz').amount).toBeUndefined();
    });

    it('lehnt Zeiträume ohne geplante Rezepte ab', async () => {
      mockPrisma.mealPlanEntry.findMany.mockResolvedValue([
        { id: 'm1', recipeId: null, title: 'Essen gehen', servings: 2, date: new Date() },
      ]);
      await expect(
        service.addRangeToList('u1', { listId: 'l1', from: '2026-08-03', to: '2026-08-09' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockLists.addMergedItems).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('wirft NotFound für fremde Einträge', async () => {
      mockPrisma.mealPlanEntry.findFirst.mockResolvedValue(null);
      await expect(service.remove('u1', 'fremd')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.mealPlanEntry.delete).not.toHaveBeenCalled();
    });
  });
});
