import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  AddFromRecipeDto,
  BulkItemsDto,
  CreateListDto,
  CreateListItemDto,
  ReorderItemsDto,
  UpdateListDto,
  UpdateListItemDto,
} from './dto/list.dto';

const LIST_INCLUDE = {
  items: { orderBy: [{ checked: 'asc' as const }, { sortOrder: 'asc' as const }] },
} satisfies Prisma.ListInclude;

/**
 * Normalisiert Einheiten für die Zusammenführung gleicher Zutaten:
 * "Gramm"/"g" oder "EL"/"esslöffel" sollen als dieselbe Einheit gelten.
 * Bewusst simpel gehalten – keine Umrechnung zwischen g und kg, sondern
 * nur Zusammenfassen exakt gleicher Einheiten (siehe Plan: kein
 * Unit-Parsing-Perfektionismus).
 */
function normalizeUnit(unit?: string | null): string {
  const raw = (unit ?? '').trim().toLowerCase().replace(/\.$/, '');
  const map: Record<string, string> = {
    gramm: 'g',
    g: 'g',
    kilogramm: 'kg',
    kg: 'kg',
    milliliter: 'ml',
    ml: 'ml',
    liter: 'l',
    l: 'l',
    esslöffel: 'el',
    el: 'el',
    teelöffel: 'tl',
    tl: 'tl',
    stück: 'stk',
    stk: 'stk',
    prise: 'prise',
    '': '',
  };
  return map[raw] ?? raw;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Mengen zusammenführen: Nur addieren, wenn beide Seiten eine Menge haben –
 * "500 g Mehl" + "Mehl (ohne Menge)" bleibt bei 500 g, zwei mengenlose
 * Einträge bleiben mengenlos.
 */
function addAmounts(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b!;
  if (b == null) return a;
  return Math.round((a + b) * 100) / 100;
}

@Injectable()
export class ListsService {
  constructor(private prisma: PrismaService) {}

  // ---------- Listen ----------

  async findAll(userId: string) {
    return this.prisma.list.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { items: { where: { checked: false } } } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const list = await this.prisma.list.findFirst({
      where: { id, userId },
      include: LIST_INCLUDE,
    });
    if (!list) throw new NotFoundException('Liste nicht gefunden');
    return list;
  }

  async create(userId: string, dto: CreateListDto) {
    const existing = await this.prisma.list.findFirst({ where: { userId, name: dto.name } });
    if (existing) throw new BadRequestException('Eine Liste mit diesem Namen existiert bereits');
    return this.prisma.list.create({
      data: { userId, name: dto.name, type: dto.type, icon: dto.icon },
      include: LIST_INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdateListDto) {
    await this.assertListOwnership(userId, id);
    return this.prisma.list.update({ where: { id }, data: dto, include: LIST_INCLUDE });
  }

  async remove(userId: string, id: string) {
    await this.assertListOwnership(userId, id);
    await this.prisma.list.delete({ where: { id } });
    return { message: 'Liste gelöscht' };
  }

  // ---------- Einträge ----------

  async addItem(userId: string, listId: string, dto: CreateListItemDto) {
    await this.assertListOwnership(userId, listId);
    const maxOrder = await this.nextSortOrder(listId);
    return this.prisma.listItem.create({
      data: { listId, name: dto.name, amount: dto.amount, unit: dto.unit, sortOrder: maxOrder },
    });
  }

  async addItems(userId: string, listId: string, dto: BulkItemsDto) {
    await this.assertListOwnership(userId, listId);
    const merged = await this.mergeIntoList(listId, dto.items);
    return { added: merged.added, updated: merged.updated };
  }

  async updateItem(userId: string, itemId: string, dto: UpdateListItemDto) {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, list: { userId } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Eintrag nicht gefunden');
    return this.prisma.listItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.checked !== undefined ? { checked: dto.checked } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, list: { userId } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Eintrag nicht gefunden');
    await this.prisma.listItem.delete({ where: { id: itemId } });
    return { message: 'Eintrag gelöscht' };
  }

  /** Alle abgehakten Einträge entfernen („Aufräumen"). */
  async clearChecked(userId: string, listId: string) {
    await this.assertListOwnership(userId, listId);
    const result = await this.prisma.listItem.deleteMany({ where: { listId, checked: true } });
    return { removed: result.count };
  }

  async reorder(userId: string, listId: string, dto: ReorderItemsDto) {
    await this.assertListOwnership(userId, listId);
    const owned = await this.prisma.listItem.findMany({
      where: { listId, id: { in: dto.itemIds } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((i) => i.id));
    await this.prisma.$transaction(
      dto.itemIds
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          this.prisma.listItem.update({ where: { id }, data: { sortOrder: index } }),
        ),
    );
    return this.findOne(userId, listId);
  }

  // ---------- Cross-Module: Rezept → Einkaufsliste ----------

  /**
   * Übernimmt die Zutaten eines Rezepts in eine Liste. Mengen werden auf die
   * gewünschte Portionszahl skaliert; bereits vorhandene Einträge mit
   * gleichem Namen und gleicher Einheit werden zusammengeführt statt doppelt
   * angelegt.
   */
  async addFromRecipe(userId: string, listId: string, dto: AddFromRecipeDto) {
    await this.assertListOwnership(userId, listId);
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: dto.recipeId, userId },
      include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!recipe) throw new NotFoundException('Rezept nicht gefunden');

    let ingredients = recipe.ingredients;
    if (dto.ingredientIds?.length) {
      const wanted = new Set(dto.ingredientIds);
      ingredients = ingredients.filter((i) => wanted.has(i.id));
    }
    if (ingredients.length === 0) {
      throw new BadRequestException('Das Rezept enthält keine übernehmbaren Zutaten');
    }

    const factor = dto.servings && recipe.servings > 0 ? dto.servings / recipe.servings : 1;
    const items = ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount ? Math.round(Number(ing.amount) * factor * 100) / 100 : undefined,
      unit: ing.unit ?? undefined,
    }));

    const result = await this.mergeIntoList(listId, items, recipe.id);
    return {
      ...result,
      recipeTitle: recipe.title,
      servings: dto.servings ?? recipe.servings,
    };
  }

  /**
   * Schmale Public API für andere Module (z. B. Meal-Planner): Einträge
   * hinzufügen und dabei gleichnamige zusammenführen. Die Ownership der
   * Liste wird hier geprüft, der Aufrufer muss das nicht wissen.
   */
  async addMergedItems(
    userId: string,
    listId: string,
    items: Array<{ name: string; amount?: number; unit?: string }>,
  ) {
    await this.assertListOwnership(userId, listId);
    return this.mergeIntoList(listId, items);
  }

  /** Schmale Public API für die globale Suche. */
  async search(userId: string, q: string, limit = 5) {
    const [lists, items] = await Promise.all([
      this.prisma.list.findMany({
        where: { userId, name: { contains: q, mode: 'insensitive' } },
        select: { id: true, name: true, type: true },
        take: limit,
      }),
      this.prisma.listItem.findMany({
        where: { list: { userId }, name: { contains: q, mode: 'insensitive' }, checked: false },
        select: { id: true, name: true, list: { select: { id: true, name: true } } },
        take: limit,
      }),
    ]);
    return { lists, items };
  }

  // ---------- interne Helfer ----------

  /**
   * Fügt Einträge hinzu und führt gleichnamige Einträge mit gleicher Einheit
   * zusammen (Mengen addieren). Abgehakte Treffer werden dabei reaktiviert.
   */
  private async mergeIntoList(
    listId: string,
    items: Array<{ name: string; amount?: number; unit?: string }>,
    recipeId?: string,
  ) {
    const existing = await this.prisma.listItem.findMany({ where: { listId } });
    const existingIndex = new Map<string, (typeof existing)[number]>();
    for (const item of existing) {
      existingIndex.set(`${normalizeName(item.name)}|${normalizeUnit(item.unit)}`, item);
    }

    let nextOrder = await this.nextSortOrder(listId);
    const creates: Prisma.ListItemCreateManyInput[] = [];
    // Zutaten, die in diesem Aufruf mehrfach vorkommen, landen im selben
    // create-Eintrag; bestehende Einträge werden je Ziel-ID einmal summiert.
    const createIndex = new Map<string, Prisma.ListItemCreateManyInput>();
    const updates = new Map<string, number | null>();

    for (const item of items) {
      const key = `${normalizeName(item.name)}|${normalizeUnit(item.unit)}`;

      const pending = createIndex.get(key);
      if (pending) {
        pending.amount = addAmounts(pending.amount as number | null | undefined, item.amount);
        continue;
      }

      const match = existingIndex.get(key);
      if (match) {
        const current = updates.has(match.id)
          ? updates.get(match.id)!
          : match.amount !== null
            ? Number(match.amount)
            : null;
        updates.set(match.id, addAmounts(current, item.amount));
        continue;
      }

      const create: Prisma.ListItemCreateManyInput = {
        listId,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        sortOrder: nextOrder++,
        recipeId,
      };
      creates.push(create);
      createIndex.set(key, create);
    }

    await this.prisma.$transaction([
      ...(creates.length ? [this.prisma.listItem.createMany({ data: creates })] : []),
      ...[...updates.entries()].map(([id, amount]) =>
        this.prisma.listItem.update({ where: { id }, data: { amount, checked: false } }),
      ),
    ]);

    return { added: creates.length, updated: updates.size };
  }

  private async nextSortOrder(listId: string): Promise<number> {
    const last = await this.prisma.listItem.findFirst({
      where: { listId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async assertListOwnership(userId: string, listId: string) {
    const list = await this.prisma.list.findFirst({
      where: { id: listId, userId },
      select: { id: true },
    });
    if (!list) throw new NotFoundException('Liste nicht gefunden');
  }
}
