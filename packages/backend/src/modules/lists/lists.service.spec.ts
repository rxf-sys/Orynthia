import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListsService } from './lists.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

describe('ListsService', () => {
  let service: ListsService;

  const mockPrisma = {
    list: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    listItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    recipe: { findFirst: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };

  const ownedList = { id: 'list1', userId: 'user1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ListsService>(ListsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  describe('Ownership', () => {
    it('wirft NotFound bei fremder Liste', async () => {
      mockPrisma.list.findFirst.mockResolvedValue(null);
      await expect(service.addItem('user1', 'fremd', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.listItem.create).not.toHaveBeenCalled();
    });

    it('wirft NotFound bei fremdem Eintrag', async () => {
      mockPrisma.listItem.findFirst.mockResolvedValue(null);
      await expect(service.removeItem('user1', 'item-fremd')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.listItem.delete).not.toHaveBeenCalled();
    });
  });

  describe('addFromRecipe', () => {
    const recipe = {
      id: 'r1',
      userId: 'user1',
      title: 'Bolognese',
      servings: 2,
      ingredients: [
        { id: 'i1', name: 'Hackfleisch', amount: new Prisma.Decimal(250), unit: 'g', sortOrder: 0 },
        { id: 'i2', name: 'Zwiebel', amount: new Prisma.Decimal(1), unit: 'Stück', sortOrder: 1 },
        { id: 'i3', name: 'Salz', amount: null, unit: null, sortOrder: 2 },
      ],
    };

    beforeEach(() => {
      mockPrisma.list.findFirst.mockResolvedValue(ownedList);
      mockPrisma.recipe.findFirst.mockResolvedValue(recipe);
      mockPrisma.listItem.findMany.mockResolvedValue([]);
      mockPrisma.listItem.findFirst.mockResolvedValue(null);
    });

    it('skaliert Mengen auf die gewünschte Portionszahl', async () => {
      const result = await service.addFromRecipe('user1', 'list1', { recipeId: 'r1', servings: 4 });

      expect(result.added).toBe(3);
      expect(result.servings).toBe(4);
      const created = mockPrisma.listItem.createMany.mock.calls[0][0].data;
      expect(created.find((c: { name: string }) => c.name === 'Hackfleisch').amount).toBe(500);
      expect(created.find((c: { name: string }) => c.name === 'Zwiebel').amount).toBe(2);
      // Zutat ohne Menge bleibt ohne Menge
      expect(created.find((c: { name: string }) => c.name === 'Salz').amount).toBeUndefined();
      // Herkunft wird vermerkt
      expect(created[0].recipeId).toBe('r1');
    });

    it('behält die Rezept-Menge ohne servings-Angabe', async () => {
      await service.addFromRecipe('user1', 'list1', { recipeId: 'r1' });
      const created = mockPrisma.listItem.createMany.mock.calls[0][0].data;
      expect(created.find((c: { name: string }) => c.name === 'Hackfleisch').amount).toBe(250);
    });

    it('führt bestehende Einträge mit gleicher Einheit zusammen statt zu duplizieren', async () => {
      mockPrisma.listItem.findMany.mockResolvedValue([
        {
          id: 'existing1',
          listId: 'list1',
          name: 'hackfleisch', // andere Schreibweise
          amount: new Prisma.Decimal(100),
          unit: 'Gramm', // Synonym zu g
          checked: true,
          sortOrder: 0,
          recipeId: null,
        },
      ]);

      const result = await service.addFromRecipe('user1', 'list1', { recipeId: 'r1' });

      expect(result.updated).toBe(1);
      expect(result.added).toBe(2); // Zwiebel + Salz
      const updateCall = mockPrisma.listItem.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('existing1');
      expect(updateCall.data.amount).toBe(350); // 100 + 250
      // Abgehakter Treffer wird reaktiviert
      expect(updateCall.data.checked).toBe(false);
    });

    it('übernimmt nur ausgewählte Zutaten', async () => {
      const result = await service.addFromRecipe('user1', 'list1', {
        recipeId: 'r1',
        ingredientIds: ['i2'],
      });
      expect(result.added).toBe(1);
      const created = mockPrisma.listItem.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(1);
      expect(created[0].name).toBe('Zwiebel');
    });

    it('wirft NotFound für fremde Rezepte', async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue(null);
      await expect(
        service.addFromRecipe('user1', 'list1', { recipeId: 'fremd' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lehnt Rezepte ohne Zutaten ab', async () => {
      mockPrisma.recipe.findFirst.mockResolvedValue({ ...recipe, ingredients: [] });
      await expect(service.addFromRecipe('user1', 'list1', { recipeId: 'r1' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addItems (bulk)', () => {
    it('fasst doppelte Zutaten innerhalb eines Aufrufs zusammen', async () => {
      mockPrisma.list.findFirst.mockResolvedValue(ownedList);
      mockPrisma.listItem.findMany.mockResolvedValue([]);
      mockPrisma.listItem.findFirst.mockResolvedValue(null);

      const result = await service.addItems('user1', 'list1', {
        items: [
          { name: 'Milch', amount: 1, unit: 'l' },
          { name: 'milch', amount: 2, unit: 'Liter' },
        ],
      });

      // Der zweite Eintrag landet als Update auf dem gerade erzeugten
      expect(result.added).toBe(1);
      expect(result.updated).toBe(1);
    });
  });

  describe('clearChecked', () => {
    it('entfernt nur abgehakte Einträge der eigenen Liste', async () => {
      mockPrisma.list.findFirst.mockResolvedValue(ownedList);
      mockPrisma.listItem.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.clearChecked('user1', 'list1');

      expect(result.removed).toBe(3);
      expect(mockPrisma.listItem.deleteMany).toHaveBeenCalledWith({
        where: { listId: 'list1', checked: true },
      });
    });
  });
});
