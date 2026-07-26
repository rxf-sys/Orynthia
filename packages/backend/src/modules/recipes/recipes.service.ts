import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateRecipeDto, UpdateRecipeDto } from './dto/recipe.dto';

const RECIPE_INCLUDE = {
  ingredients: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.RecipeInclude;

export interface RecipeFilters {
  search?: string;
  mealType?: string;
  dietary?: string;
  difficulty?: string;
  favorite?: boolean;
  maxTotalMinutes?: number;
}

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, filters: RecipeFilters = {}) {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        userId,
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
                { tags: { has: filters.search.toLowerCase() } },
              ],
            }
          : {}),
        ...(filters.mealType ? { mealTypes: { has: filters.mealType } } : {}),
        ...(filters.dietary ? { dietary: { has: filters.dietary } } : {}),
        ...(filters.difficulty ? { difficulty: filters.difficulty as never } : {}),
        ...(filters.favorite ? { isFavorite: true } : {}),
      },
      include: RECIPE_INCLUDE,
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
      take: 500,
    });
    // Gesamtzeit-Filter clientnah, aber serverseitig gerechnet
    if (filters.maxTotalMinutes) {
      return recipes.filter((r) => r.prepMinutes + r.cookMinutes <= filters.maxTotalMinutes!);
    }
    return recipes;
  }

  async findOne(userId: string, id: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, userId },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) throw new NotFoundException('Rezept nicht gefunden');
    return recipe;
  }

  async create(userId: string, dto: CreateRecipeDto) {
    const { ingredients, ...data } = dto;
    return this.prisma.recipe.create({
      data: {
        userId,
        ...data,
        ingredients: {
          create: (ingredients ?? []).map((ing, i) => ({ ...ing, sortOrder: i })),
        },
      },
      include: RECIPE_INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdateRecipeDto) {
    await this.findOne(userId, id);
    const { ingredients, ...data } = dto;
    // Zutaten werden als Ganzes ersetzt – einfacher und robuster als Feld-Diffs
    return this.prisma.recipe.update({
      where: { id },
      data: {
        ...data,
        ...(ingredients !== undefined
          ? {
              ingredients: {
                deleteMany: {},
                create: ingredients.map((ing, i) => ({ ...ing, sortOrder: i })),
              },
            }
          : {}),
      },
      include: RECIPE_INCLUDE,
    });
  }

  async toggleFavorite(userId: string, id: string) {
    const recipe = await this.findOne(userId, id);
    return this.prisma.recipe.update({
      where: { id },
      data: { isFavorite: !recipe.isFavorite },
      include: RECIPE_INCLUDE,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.recipe.delete({ where: { id } });
    return { message: 'Rezept gelöscht' };
  }

  /** Schmale Public API für die globale Suche. */
  async search(userId: string, q: string, limit = 5) {
    return this.prisma.recipe.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { tags: { has: q.toLowerCase() } },
        ],
      },
      select: { id: true, title: true, isFavorite: true },
      take: limit,
    });
  }
}
