import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const defaultCategories = [
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

async function main() {
  console.log('🌱 Seeding Datenbank...');

  // System-Kategorien erstellen (upsert-Logik für nullable userId)
  for (const cat of defaultCategories) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: cat.name, isSystem: true },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          keywords: cat.keywords,
          isSystem: true,
        },
      });
    }
  }

  console.log(`✅ ${defaultCategories.length} Kategorien erstellt`);

  // Demo-User erstellen (nur in Development)
  if (process.env.NODE_ENV !== 'production') {
    const hashedPassword = await bcrypt.hash('demo1234', 12);
    
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@finanzguru.local' },
      update: {},
      create: {
        email: 'demo@finanzguru.local',
        passwordHash: hashedPassword,
        firstName: 'Demo',
        lastName: 'Benutzer',
        isEmailVerified: true,
      },
    });

    // Demo-Bankkonto
    const demoAccount = await prisma.bankAccount.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        userId: demoUser.id,
        bankName: 'Demo Bank',
        accountName: 'Girokonto',
        iban: 'DE89370400440532013000',
        accountType: 'CHECKING',
        balance: 3847.52,
        currency: 'EUR',
      },
    });

    // Demo-Transaktionen
    const categories = await prisma.category.findMany({ where: { isSystem: true } });
    const catMap = new Map(categories.map(c => [c.name, c.id]));

    const now = new Date();
    const demoTransactions = [
      { amount: 3200, type: 'INCOME', purpose: 'Gehalt November', counterpartName: 'Arbeitgeber GmbH', categoryName: 'Gehalt & Einkommen', daysAgo: 2 },
      { amount: -850, type: 'EXPENSE', purpose: 'Miete Dezember', counterpartName: 'Hausverwaltung', categoryName: 'Miete & Wohnen', daysAgo: 1 },
      { amount: -67.43, type: 'EXPENSE', purpose: 'Wocheneinkauf', counterpartName: 'REWE', categoryName: 'Lebensmittel', daysAgo: 3 },
      { amount: -12.99, type: 'EXPENSE', purpose: 'Netflix Abo', counterpartName: 'Netflix', categoryName: 'Abonnements', daysAgo: 5 },
      { amount: -45.00, type: 'EXPENSE', purpose: 'Tanken', counterpartName: 'Aral Tankstelle', categoryName: 'Transport & Auto', daysAgo: 4 },
      { amount: -89.90, type: 'EXPENSE', purpose: 'Amazon Bestellung', counterpartName: 'Amazon', categoryName: 'Shopping & Kleidung', daysAgo: 6 },
      { amount: -34.50, type: 'EXPENSE', purpose: 'Pizza Lieferung', counterpartName: 'Lieferando', categoryName: 'Restaurant & Café', daysAgo: 7 },
      { amount: -9.99, type: 'EXPENSE', purpose: 'Spotify Premium', counterpartName: 'Spotify', categoryName: 'Abonnements', daysAgo: 10 },
      { amount: -200, type: 'EXPENSE', purpose: 'Sparplan ETF', counterpartName: 'Trade Republic', categoryName: 'Sparen & Investieren', daysAgo: 8 },
      { amount: -29.99, type: 'EXPENSE', purpose: 'Fitnessstudio', counterpartName: 'McFit', categoryName: 'Gesundheit & Fitness', daysAgo: 12 },
    ];

    await prisma.transaction.createMany({
      data: demoTransactions.map((tx) => {
        const txDate = new Date(now);
        txDate.setDate(txDate.getDate() - tx.daysAgo);
        return {
          bankAccountId: demoAccount.id,
          categoryId: catMap.get(tx.categoryName) || null,
          amount: tx.amount,
          date: txDate,
          purpose: tx.purpose,
          counterpartName: tx.counterpartName,
          type: tx.type as 'INCOME' | 'EXPENSE',
        };
      }),
      skipDuplicates: true,
    });

    console.log(`✅ Demo-User: demo@finanzguru.local / demo1234`);
    console.log(`✅ ${demoTransactions.length} Demo-Transaktionen erstellt`);
  }

  console.log('🎉 Seeding abgeschlossen!');
}

main()
  .catch((e) => {
    console.error('❌ Seed Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
