import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const DEMO_EMAIL = 'demo@orynthia.local';
// Überschreibbar via DEMO_PASSWORD, damit das Repo-Default nicht auf
// erreichbaren Instanzen mit aktiviertem Seed verwendet wird.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

@Injectable()
export class DemoSeedService implements OnModuleInit {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SEED_DEMO_USER !== 'true') return;

    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        'SEED_DEMO_USER=true ist in NODE_ENV=production blockiert. ' +
          'Demo-Daten würden bekannte Zugangsdaten in die Live-DB schreiben. Aktion abgebrochen.',
      );
      return;
    }

    this.logger.log(`SEED_DEMO_USER=true – Demo-Daten werden neu erstellt …`);

    const existing = await this.prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (existing) {
      await this.prisma.user.delete({ where: { id: existing.id } });
      this.logger.log('Bisheriger Demo-User samt Daten gelöscht.');
    }

    await this.createDemoData();
  }

  private async createDemoData() {
    const systemCategories = await this.prisma.category.findMany({
      where: { isSystem: true, userId: null },
    });
    const catByName = new Map(systemCategories.map((c) => [c.name, c.id]));
    const catId = (name: string) => catByName.get(name) ?? null;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await this.prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash,
        firstName: 'Demo',
        lastName: 'Benutzer',
        isEmailVerified: true,
      },
    });

    const giro = await this.prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName: 'Demo Bank',
        accountName: 'Girokonto',
        iban: 'DE89370400440532013000',
        accountType: 'CHECKING',
        balance: 3847.52,
        currency: 'EUR',
      },
    });
    const spar = await this.prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName: 'Demo Bank',
        accountName: 'Tagesgeld',
        iban: 'DE12500105170648489890',
        accountType: 'SAVINGS',
        balance: 12500.0,
        currency: 'EUR',
      },
    });
    const kredit = await this.prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName: 'AutoFinanz AG',
        accountName: 'KFZ-Kredit',
        iban: 'DE76100500000123456789',
        accountType: 'LOAN',
        balance: -8200.0,
        currency: 'EUR',
      },
    });

    const txInputs = this.buildTransactions(giro.id, spar.id, kredit.id, catId);
    await this.prisma.transaction.createMany({ data: txInputs });

    const budgets: { categoryName: string; amount: number }[] = [
      { categoryName: 'Lebensmittel', amount: 400 },
      { categoryName: 'Restaurant & Café', amount: 150 },
      { categoryName: 'Transport & Auto', amount: 200 },
      { categoryName: 'Shopping & Kleidung', amount: 250 },
      { categoryName: 'Freizeit & Unterhaltung', amount: 100 },
      { categoryName: 'Abonnements', amount: 50 },
    ];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    for (const b of budgets) {
      const cid = catId(b.categoryName);
      if (!cid) continue;
      await this.prisma.budget.create({
        data: {
          userId: user.id,
          categoryId: cid,
          amount: b.amount,
          period: 'MONTHLY',
          startDate: monthStart,
        },
      });
    }

    await this.prisma.savingsGoal.createMany({
      data: [
        {
          userId: user.id,
          name: 'Sommerurlaub Italien',
          targetAmount: 3000,
          currentAmount: 1200,
          deadline: addMonths(new Date(), 5),
          icon: '🏖️',
          color: '#ffb17a',
        },
        {
          userId: user.id,
          name: 'Notgroschen (3 Monatsgehälter)',
          targetAmount: 10000,
          currentAmount: 10000,
          icon: '🛡️',
          color: '#1f8a5b',
          isCompleted: true,
          completedAt: new Date(),
        },
        {
          userId: user.id,
          name: 'Neues E-Bike',
          targetAmount: 3500,
          currentAmount: 850,
          icon: '🚴',
          color: '#5b8def',
        },
      ],
    });

    await this.prisma.contract.createMany({
      data: [
        {
          userId: user.id,
          name: 'Privathaftpflicht',
          provider: 'HUK24',
          contractType: 'INSURANCE_LIABILITY',
          monthlyCost: 6.5,
          yearlyCost: 78.0,
          billingCycle: 'YEARLY',
          autoRenewal: true,
          startDate: addMonths(new Date(), -14),
          counterpartName: 'HUK24',
        },
        {
          userId: user.id,
          name: 'Netflix Standard',
          provider: 'Netflix',
          contractType: 'STREAMING',
          monthlyCost: 12.99,
          yearlyCost: 155.88,
          billingCycle: 'MONTHLY',
          autoRenewal: true,
          counterpartName: 'Netflix',
        },
        {
          userId: user.id,
          name: 'Spotify Premium',
          provider: 'Spotify',
          contractType: 'STREAMING',
          monthlyCost: 9.99,
          yearlyCost: 119.88,
          billingCycle: 'MONTHLY',
          autoRenewal: true,
          counterpartName: 'Spotify',
        },
        {
          userId: user.id,
          name: 'Mobilfunk-Vertrag',
          provider: 'Telekom',
          contractType: 'TELECOM_MOBILE',
          monthlyCost: 29.95,
          yearlyCost: 359.4,
          billingCycle: 'MONTHLY',
          autoRenewal: true,
          startDate: addMonths(new Date(), -22),
          counterpartName: 'Telekom Deutschland',
        },
      ],
    });

    await this.prisma.recurringPayment.createMany({
      data: [
        {
          userId: user.id,
          name: 'Miete Wohnung',
          amount: -850,
          frequency: 'MONTHLY',
          counterpartName: 'Hausverwaltung Schmidt',
          categoryId: catId('Miete & Wohnen'),
          nextDueDate: nextMonthStart(),
        },
        {
          userId: user.id,
          name: 'Netflix',
          amount: -12.99,
          frequency: 'MONTHLY',
          counterpartName: 'Netflix',
          categoryId: catId('Abonnements'),
          nextDueDate: addDays(new Date(), 6),
        },
        {
          userId: user.id,
          name: 'Spotify Premium',
          amount: -9.99,
          frequency: 'MONTHLY',
          counterpartName: 'Spotify',
          categoryId: catId('Abonnements'),
          nextDueDate: addDays(new Date(), 11),
        },
        {
          userId: user.id,
          name: 'Fitnessstudio',
          amount: -29.99,
          frequency: 'MONTHLY',
          counterpartName: 'McFit',
          categoryId: catId('Gesundheit & Fitness'),
          nextDueDate: addDays(new Date(), 18),
        },
      ],
    });

    this.logger.log(
      `Demo-Daten angelegt: ${DEMO_EMAIL} / ${DEMO_PASSWORD} – ` +
        `3 Konten, ${txInputs.length} Transaktionen, ${budgets.length} Budgets, 3 Sparziele, 4 Verträge, 4 wiederkehrende Zahlungen.`,
    );
  }

  private buildTransactions(
    giroId: string,
    sparId: string,
    kreditId: string,
    catId: (name: string) => string | null,
  ) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    type TxSeed = {
      account: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
      purpose: string;
      counterpart: string;
      category: string | null;
      date: Date;
    };

    const txs: TxSeed[] = [];

    for (let m = 0; m < 3; m++) {
      const monthDate = addMonths(today, -m);
      txs.push({
        account: giroId,
        amount: 3200,
        type: 'INCOME',
        purpose: `Gehalt ${monthLabel(monthDate)}`,
        counterpart: 'Beispiel GmbH',
        category: catId('Gehalt & Einkommen'),
        date: setDay(monthDate, 1),
      });
      txs.push({
        account: giroId,
        amount: -850,
        type: 'EXPENSE',
        purpose: `Miete ${monthLabel(monthDate)}`,
        counterpart: 'Hausverwaltung Schmidt',
        category: catId('Miete & Wohnen'),
        date: setDay(monthDate, 3),
      });
      txs.push({
        account: giroId,
        amount: -185,
        type: 'EXPENSE',
        purpose: 'KFZ-Kredit Rate',
        counterpart: 'AutoFinanz AG',
        category: catId('Sonstiges'),
        date: setDay(monthDate, 5),
      });
      txs.push({
        account: giroId,
        amount: -300,
        type: 'TRANSFER',
        purpose: 'Sparplan',
        counterpart: 'Eigenes Tagesgeld',
        category: catId('Sparen & Investieren'),
        date: setDay(monthDate, 6),
      });
      txs.push({
        account: sparId,
        amount: 300,
        type: 'TRANSFER',
        purpose: 'Sparplan-Eingang',
        counterpart: 'Eigenes Girokonto',
        category: catId('Sparen & Investieren'),
        date: setDay(monthDate, 6),
      });
      txs.push({
        account: kreditId,
        amount: 185,
        type: 'TRANSFER',
        purpose: 'Tilgung KFZ-Kredit',
        counterpart: 'Eigenes Girokonto',
        category: null,
        date: setDay(monthDate, 5),
      });
      txs.push({
        account: giroId,
        amount: -12.99,
        type: 'EXPENSE',
        purpose: 'Netflix Abo',
        counterpart: 'Netflix',
        category: catId('Abonnements'),
        date: setDay(monthDate, 8),
      });
      txs.push({
        account: giroId,
        amount: -9.99,
        type: 'EXPENSE',
        purpose: 'Spotify Premium',
        counterpart: 'Spotify',
        category: catId('Abonnements'),
        date: setDay(monthDate, 12),
      });
      txs.push({
        account: giroId,
        amount: -29.95,
        type: 'EXPENSE',
        purpose: 'Mobilfunk',
        counterpart: 'Telekom Deutschland',
        category: catId('Telekommunikation'),
        date: setDay(monthDate, 14),
      });
      txs.push({
        account: giroId,
        amount: -29.99,
        type: 'EXPENSE',
        purpose: 'Fitnessstudio',
        counterpart: 'McFit',
        category: catId('Gesundheit & Fitness'),
        date: setDay(monthDate, 15),
      });
    }

    const groceries = [
      { c: 'REWE', amt: -68.43 },
      { c: 'Edeka', amt: -42.18 },
      { c: 'Aldi', amt: -34.95 },
      { c: 'REWE', amt: -55.12 },
      { c: 'Lidl', amt: -27.8 },
      { c: 'REWE', amt: -71.6 },
      { c: 'Edeka', amt: -38.4 },
      { c: 'Aldi', amt: -22.99 },
      { c: 'REWE', amt: -49.55 },
      { c: 'Penny', amt: -19.4 },
      { c: 'Kaufland', amt: -82.3 },
      { c: 'REWE', amt: -59.25 },
    ];
    groceries.forEach((g, i) => {
      txs.push({
        account: giroId,
        amount: g.amt,
        type: 'EXPENSE',
        purpose: 'Wocheneinkauf',
        counterpart: g.c,
        category: catId('Lebensmittel'),
        date: addDays(today, -i * 7 - 1),
      });
    });

    const fueling = [
      { c: 'Aral', amt: -65.4 },
      { c: 'Shell', amt: -72.1 },
      { c: 'Total', amt: -58.9 },
      { c: 'Aral', amt: -69.2 },
      { c: 'Shell', amt: -61.5 },
    ];
    fueling.forEach((f, i) => {
      txs.push({
        account: giroId,
        amount: f.amt,
        type: 'EXPENSE',
        purpose: 'Tanken',
        counterpart: f.c,
        category: catId('Transport & Auto'),
        date: addDays(today, -i * 14 - 4),
      });
    });

    const restaurants = [
      { c: 'Lieferando', amt: -34.5, p: 'Pizza Lieferung' },
      { c: 'Burger King', amt: -18.9, p: 'Mittagessen' },
      { c: 'Starbucks', amt: -6.5, p: 'Cappuccino' },
      { c: 'Italiano Ristorante', amt: -52.8, p: 'Abendessen' },
      { c: 'McDonalds', amt: -12.4, p: 'Snack' },
      { c: 'Sushi Bar', amt: -28.6, p: 'Sushi to go' },
      { c: 'Starbucks', amt: -5.9, p: 'Latte Macchiato' },
      { c: 'Lieferando', amt: -41.2, p: 'Indisch' },
    ];
    restaurants.forEach((r, i) => {
      txs.push({
        account: giroId,
        amount: r.amt,
        type: 'EXPENSE',
        purpose: r.p,
        counterpart: r.c,
        category: catId('Restaurant & Café'),
        date: addDays(today, -i * 9 - 2),
      });
    });

    const shopping = [
      { c: 'Amazon', amt: -89.9 },
      { c: 'Zalando', amt: -134.5 },
      { c: 'MediaMarkt', amt: -249.0 },
      { c: 'Amazon', amt: -27.4 },
      { c: 'H&M', amt: -45.8 },
    ];
    shopping.forEach((s, i) => {
      txs.push({
        account: giroId,
        amount: s.amt,
        type: 'EXPENSE',
        purpose: 'Online-Einkauf',
        counterpart: s.c,
        category: catId('Shopping & Kleidung'),
        date: addDays(today, -i * 11 - 5),
      });
    });

    txs.push({
      account: giroId,
      amount: -78.0,
      type: 'EXPENSE',
      purpose: 'Jahresbeitrag Haftpflicht',
      counterpart: 'HUK24',
      category: catId('Versicherungen'),
      date: addMonths(today, -2),
    });
    txs.push({
      account: giroId,
      amount: -22.5,
      type: 'EXPENSE',
      purpose: 'Apotheke',
      counterpart: 'Adler Apotheke',
      category: catId('Gesundheit & Fitness'),
      date: addDays(today, -16),
    });
    txs.push({
      account: giroId,
      amount: -45.0,
      type: 'EXPENSE',
      purpose: 'Kinoabend',
      counterpart: 'Cinemaxx',
      category: catId('Freizeit & Unterhaltung'),
      date: addDays(today, -22),
    });

    return txs.map((tx) => ({
      bankAccountId: tx.account,
      amount: tx.amount,
      type: tx.type,
      purpose: tx.purpose,
      counterpartName: tx.counterpart,
      categoryId: tx.category ?? undefined,
      date: tx.date,
    }));
  }
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(d: Date, months: number) {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
}

function setDay(d: Date, day: number) {
  const next = new Date(d);
  next.setDate(day);
  return next;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString('de-DE', { month: 'long' });
}

function nextMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
