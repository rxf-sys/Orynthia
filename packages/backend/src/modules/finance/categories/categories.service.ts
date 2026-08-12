import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';

const DEFAULT_SYSTEM_CATEGORIES = [
  { name: 'Gehalt & Einkommen', icon: '💰', color: '#7c5cff', keywords: ['gehalt', 'lohn', 'salary', 'einkommen', 'bonus'] },
  { name: 'Miete & Wohnen', icon: '🏠', color: '#2f7dff', keywords: ['miete', 'rent', 'nebenkosten', 'strom', 'gas', 'wasser', 'hausgeld'] },
  { name: 'Lebensmittel', icon: '🛒', color: '#3aa3a5', keywords: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'dm'] },
  { name: 'Restaurant & Café', icon: '🍽️', color: '#8a92ab', keywords: ['restaurant', 'cafe', 'lieferando', 'uber eats', 'mcdonalds', 'starbucks'] },
  { name: 'Transport & Auto', icon: '🚗', color: '#b97aff', keywords: ['tankstelle', 'shell', 'aral', 'db', 'bahn', 'uber', 'taxi', 'adac', 'kfz'] },
  { name: 'Shopping & Kleidung', icon: '🛍️', color: '#4d6bd8', keywords: ['amazon', 'zalando', 'h&m', 'zara', 'mediamarkt', 'saturn'] },
  { name: 'Gesundheit & Fitness', icon: '🏥', color: '#5f7f9c', keywords: ['apotheke', 'arzt', 'fitnessstudio', 'gym', 'krankenkasse'] },
  { name: 'Versicherungen', icon: '🛡️', color: '#6f5aa8', keywords: ['versicherung', 'insurance', 'haftpflicht', 'hausrat'] },
  { name: 'Abonnements', icon: '📱', color: '#7c5cff', keywords: ['netflix', 'spotify', 'disney', 'youtube', 'apple', 'amazon prime'] },
  { name: 'Telekommunikation', icon: '📞', color: '#2f7dff', keywords: ['telekom', 'vodafone', 'o2', 'internet', 'mobilfunk'] },
  { name: 'Freizeit & Unterhaltung', icon: '🎮', color: '#3aa3a5', keywords: ['kino', 'theater', 'konzert', 'museum', 'steam', 'playstation'] },
  { name: 'Bildung', icon: '📚', color: '#8a92ab', keywords: ['uni', 'schule', 'kurs', 'udemy', 'coursera', 'bücher'] },
  { name: 'Sparen & Investieren', icon: '📈', color: '#b97aff', keywords: ['sparplan', 'etf', 'depot', 'aktie', 'tagesgeld'] },
  { name: 'Geschenke & Spenden', icon: '🎁', color: '#4d6bd8', keywords: ['geschenk', 'spende', 'donation'] },
  { name: 'Sonstiges', icon: '📌', color: '#5f7f9c', keywords: [] },
];

/**
 * Farben der System-Kategorien stammen aus der wertfreien Skala des
 * Frontends (`lib/categoryColors.ts`) – bewusst ohne Grün und Rot. Sonst
 * läse man in Kategorie-Donuts und -Icons eine Bewertung mit, obwohl
 * wertende Farben allein der Status-Achse gehören.
 */
@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.category.findMany({
      where: { isSystem: true, userId: null },
      select: { name: true, color: true },
    });
    const existingByName = new Map(existing.map((c) => [c.name, c]));
    const missing = DEFAULT_SYSTEM_CATEGORIES.filter((c) => !existingByName.has(c.name));

    if (missing.length > 0) {
      await this.prisma.category.createMany({
        data: missing.map((c) => ({ ...c, isSystem: true })),
      });
      this.logger.log(
        `System-Kategorien angelegt: ${missing.length} (${missing.map((c) => c.name).join(', ')})`,
      );
    }

    // Bestehende Instanzen tragen noch die alten, wertenden Farben. Nur
    // System-Kategorien werden angeglichen – selbst angelegte Kategorien
    // gehören dem Nutzer und bleiben unangetastet.
    const outdated = DEFAULT_SYSTEM_CATEGORIES.filter((c) => {
      const current = existingByName.get(c.name);
      return current && current.color !== c.color;
    });
    for (const cat of outdated) {
      await this.prisma.category.updateMany({
        where: { name: cat.name, isSystem: true, userId: null },
        data: { color: cat.color },
      });
    }
    if (outdated.length > 0) {
      this.logger.log(`Kategoriefarben auf die wertfreie Skala umgestellt: ${outdated.length}`);
    }
  }

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { isSystem: true }] },
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, data: { name: string; icon?: string; color?: string; keywords?: string[] }) {
    return this.prisma.category.create({
      data: { ...data, userId, keywords: data.keywords || [] },
    });
  }

  async update(userId: string, id: string, data: { name?: string; icon?: string; color?: string; keywords?: string[] }) {
    const cat = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden');
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, userId, isSystem: false } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden oder ist System-Kategorie');
    // Budgets hängen mit Restrict-FK an der Kategorie und müssen mit weg;
    // alles atomar, damit kein halb bereinigter Zustand entsteht.
    await this.prisma.$transaction([
      this.prisma.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
      this.prisma.budget.deleteMany({ where: { categoryId: id } }),
      this.prisma.category.delete({ where: { id } }),
    ]);
    return { message: 'Kategorie gelöscht' };
  }
}
