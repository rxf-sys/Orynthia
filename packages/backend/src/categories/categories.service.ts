import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SYSTEM_CATEGORIES = [
  { name: 'Gehalt & Einkommen', icon: '💰', color: '#22c55e', keywords: ['gehalt', 'lohn', 'salary', 'einkommen', 'bonus'] },
  { name: 'Miete & Wohnen', icon: '🏠', color: '#3b82f6', keywords: ['miete', 'rent', 'nebenkosten', 'strom', 'gas', 'wasser', 'hausgeld'] },
  { name: 'Lebensmittel', icon: '🛒', color: '#f59e0b', keywords: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'dm'] },
  { name: 'Restaurant & Café', icon: '🍽️', color: '#ef4444', keywords: ['restaurant', 'cafe', 'lieferando', 'uber eats', 'mcdonalds', 'starbucks'] },
  { name: 'Transport & Auto', icon: '🚗', color: '#8b5cf6', keywords: ['tankstelle', 'shell', 'aral', 'db', 'bahn', 'uber', 'taxi', 'adac', 'kfz'] },
  { name: 'Shopping & Kleidung', icon: '🛍️', color: '#ec4899', keywords: ['amazon', 'zalando', 'h&m', 'zara', 'mediamarkt', 'saturn'] },
  { name: 'Gesundheit & Fitness', icon: '🏥', color: '#14b8a6', keywords: ['apotheke', 'arzt', 'fitnessstudio', 'gym', 'krankenkasse'] },
  { name: 'Versicherungen', icon: '🛡️', color: '#6366f1', keywords: ['versicherung', 'insurance', 'haftpflicht', 'hausrat'] },
  { name: 'Abonnements', icon: '📱', color: '#f97316', keywords: ['netflix', 'spotify', 'disney', 'youtube', 'apple', 'amazon prime'] },
  { name: 'Telekommunikation', icon: '📞', color: '#06b6d4', keywords: ['telekom', 'vodafone', 'o2', 'internet', 'mobilfunk'] },
  { name: 'Freizeit & Unterhaltung', icon: '🎮', color: '#a855f7', keywords: ['kino', 'theater', 'konzert', 'museum', 'steam', 'playstation'] },
  { name: 'Bildung', icon: '📚', color: '#0ea5e9', keywords: ['uni', 'schule', 'kurs', 'udemy', 'coursera', 'bücher'] },
  { name: 'Sparen & Investieren', icon: '📈', color: '#10b981', keywords: ['sparplan', 'etf', 'depot', 'aktie', 'tagesgeld'] },
  { name: 'Geschenke & Spenden', icon: '🎁', color: '#e11d48', keywords: ['geschenk', 'spende', 'donation'] },
  { name: 'Sonstiges', icon: '📌', color: '#64748b', keywords: [] },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.category.findMany({
      where: { isSystem: true, userId: null },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((c) => c.name));
    const missing = DEFAULT_SYSTEM_CATEGORIES.filter((c) => !existingNames.has(c.name));
    if (missing.length === 0) return;

    await this.prisma.category.createMany({
      data: missing.map((c) => ({ ...c, isSystem: true })),
    });
    this.logger.log(`System-Kategorien angelegt: ${missing.length} (${missing.map((c) => c.name).join(', ')})`);
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
