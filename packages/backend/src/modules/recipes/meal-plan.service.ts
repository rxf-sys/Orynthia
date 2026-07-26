import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ListsService } from '../lists/lists.service';
import {
  CreateMealPlanEntryDto,
  MealPlanToListDto,
  UpdateMealPlanEntryDto,
} from './dto/meal-plan.dto';

const ENTRY_INCLUDE = {
  recipe: { select: { id: true, title: true, imageUrl: true, servings: true } },
};

const MAX_RANGE_DAYS = 90;

/** Datumsteil ohne Zeitzonen-Drift: der Wochenplan denkt in Kalendertagen. */
function toDateOnly(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new BadRequestException('Ungültiges Datum');
  return d;
}

@Injectable()
export class MealPlanService {
  constructor(
    private prisma: PrismaService,
    private lists: ListsService,
  ) {}

  async findRange(userId: string, fromIso: string, toIso: string) {
    const from = toDateOnly(fromIso);
    const to = toDateOnly(toIso);
    if (to < from) throw new BadRequestException('Ungültiger Zeitraum');
    if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Zeitraum zu groß (max. ${MAX_RANGE_DAYS} Tage)`);
    }
    return this.prisma.mealPlanEntry.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: ENTRY_INCLUDE,
      orderBy: [{ date: 'asc' }, { slot: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateMealPlanEntryDto) {
    if (!dto.recipeId && !dto.title?.trim()) {
      throw new BadRequestException('Bitte ein Rezept wählen oder einen Titel angeben');
    }
    let servings = dto.servings;
    if (dto.recipeId) {
      const recipe = await this.prisma.recipe.findFirst({
        where: { id: dto.recipeId, userId },
        select: { servings: true },
      });
      if (!recipe) throw new NotFoundException('Rezept nicht gefunden');
      servings = servings ?? recipe.servings;
    }
    return this.prisma.mealPlanEntry.create({
      data: {
        userId,
        recipeId: dto.recipeId,
        title: dto.title?.trim() || undefined,
        date: toDateOnly(dto.date),
        slot: dto.slot,
        servings: servings ?? 2,
        note: dto.note,
      },
      include: ENTRY_INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdateMealPlanEntryDto) {
    await this.assertOwnership(userId, id);
    return this.prisma.mealPlanEntry.update({
      where: { id },
      data: {
        ...(dto.date !== undefined ? { date: toDateOnly(dto.date) } : {}),
        ...(dto.slot !== undefined ? { slot: dto.slot } : {}),
        ...(dto.servings !== undefined ? { servings: dto.servings } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
      include: ENTRY_INCLUDE,
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);
    await this.prisma.mealPlanEntry.delete({ where: { id } });
    return { message: 'Eintrag entfernt' };
  }

  /**
   * Sammel-Einkaufsliste: Zutaten aller geplanten Mahlzeiten eines Zeitraums
   * auf die jeweils geplanten Portionen skalieren und gebündelt in eine Liste
   * übernehmen. Das Zusammenführen gleicher Zutaten übernimmt der ListsService.
   */
  async addRangeToList(userId: string, dto: MealPlanToListDto) {
    const entries = await this.findRange(userId, dto.from, dto.to);
    const withRecipe = entries.filter((e) => e.recipeId);
    if (withRecipe.length === 0) {
      throw new BadRequestException('Im gewählten Zeitraum sind keine Rezepte geplant');
    }

    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: withRecipe.map((e) => e.recipeId!) }, userId },
      include: { ingredients: true },
    });
    const byId = new Map(recipes.map((r) => [r.id, r]));

    const items: Array<{ name: string; amount?: number; unit?: string }> = [];
    for (const entry of withRecipe) {
      const recipe = byId.get(entry.recipeId!);
      if (!recipe) continue;
      const factor = recipe.servings > 0 ? entry.servings / recipe.servings : 1;
      for (const ing of recipe.ingredients) {
        items.push({
          name: ing.name,
          amount: ing.amount ? Math.round(Number(ing.amount) * factor * 100) / 100 : undefined,
          unit: ing.unit ?? undefined,
        });
      }
    }

    const result = await this.lists.addMergedItems(userId, dto.listId, items);
    return { ...result, meals: withRecipe.length };
  }

  private async assertOwnership(userId: string, id: string) {
    const entry = await this.prisma.mealPlanEntry.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Eintrag nicht gefunden');
  }
}
