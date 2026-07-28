import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DocumentStorageService } from '../modules/documents/document-storage.service';
import * as bcrypt from 'bcrypt';

const DEMO_EMAIL = 'demo@orynthia.local';
// Überschreibbar via DEMO_PASSWORD, damit das Repo-Default nicht auf
// erreichbaren Instanzen mit aktiviertem Seed verwendet wird.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

@Injectable()
export class DemoSeedService implements OnModuleInit {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private prisma: PrismaService,
    private documentStorage: DocumentStorageService,
  ) {}

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
      // Die Dateien liegen außerhalb der Datenbank – der Cascade-Delete
      // räumt sie nicht mit ab. Ohne diesen Schritt bleiben verwaiste
      // verschlüsselte Blobs bei jedem Seed-Lauf zurück.
      const oldDocs = await this.prisma.document.findMany({
        where: { userId: existing.id },
        select: { storageKey: true },
      });
      for (const doc of oldDocs) await this.documentStorage.remove(doc.storageKey);

      await this.prisma.user.delete({ where: { id: existing.id } });
      this.logger.log(
        `Bisheriger Demo-User samt Daten gelöscht (inkl. ${oldDocs.length} Dokument-Dateien).`,
      );
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

    const depot = await this.prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName: 'Demo Broker',
        accountName: 'Wertpapierdepot',
        accountType: 'DEPOT',
        balance: 9420.6,
        currency: 'EUR',
      },
    });

    // ---------- Depot-Positionen ----------
    // Gemischt aus Gewinn und Verlust, damit die Rendite-Darstellung
    // beide Richtungen zeigt.
    await this.prisma.investmentPosition.createMany({
      data: [
        {
          userId: user.id,
          bankAccountId: depot.id,
          symbol: 'IE00B4L5Y983',
          name: 'iShares Core MSCI World',
          type: 'ETF',
          quantity: 42,
          averagePrice: 78.4,
          currentPrice: 92.15,
          purchaseDate: addDays(new Date(), -540),
          notes: 'Monatlicher Sparplan, 200 € zum Monatsanfang.',
        },
        {
          userId: user.id,
          bankAccountId: depot.id,
          symbol: 'IE00BK5BQT80',
          name: 'Vanguard FTSE All-World',
          type: 'ETF',
          quantity: 18,
          averagePrice: 101.2,
          currentPrice: 110.05,
          purchaseDate: addDays(new Date(), -300),
        },
        {
          userId: user.id,
          bankAccountId: depot.id,
          symbol: 'AAPL',
          name: 'Apple Inc.',
          type: 'STOCK',
          quantity: 12,
          averagePrice: 165.3,
          currentPrice: 189.7,
          currency: 'EUR',
          purchaseDate: addDays(new Date(), -420),
        },
        {
          userId: user.id,
          bankAccountId: depot.id,
          symbol: 'BASF',
          name: 'BASF SE',
          type: 'STOCK',
          quantity: 30,
          averagePrice: 52.1,
          currentPrice: 44.85,
          purchaseDate: addDays(new Date(), -220),
          notes: 'Läuft seit dem Kauf seitwärts – beobachten.',
        },
        {
          userId: user.id,
          symbol: 'BTC',
          name: 'Bitcoin',
          type: 'CRYPTO',
          quantity: 0.05,
          averagePrice: 41200,
          currentPrice: 58300,
          purchaseDate: addDays(new Date(), -160),
        },
      ],
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
          cancellationDate: addDays(new Date(), 21),
          noticePeriod: '3 Monate',
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

    // ---------- Aufgaben ----------
    const errandsList = await this.prisma.taskList.create({
      data: { userId: user.id, name: 'Haushalt', color: '#1f8a5b' },
    });
    const projectList = await this.prisma.taskList.create({
      data: { userId: user.id, name: 'Projekte', color: '#b97aff' },
    });
    await this.prisma.task.createMany({
      data: [
        {
          userId: user.id,
          title: 'Stromzähler ablesen',
          priority: 'MEDIUM',
          taskListId: errandsList.id,
          dueAt: addDays(new Date(), 2),
        },
        {
          userId: user.id,
          title: 'Steuererklärung vorbereiten',
          notes: 'Belege aus dem Ordner „Finanzen 2025“ heraussuchen',
          priority: 'HIGH',
          dueAt: addDays(new Date(), 7),
        },
        {
          userId: user.id,
          title: 'Miete überweisen',
          priority: 'HIGH',
          recurrence: 'MONTHLY',
          dueAt: nextMonthStart(),
        },
        {
          userId: user.id,
          title: 'Altglas wegbringen',
          priority: 'LOW',
          taskListId: errandsList.id,
        },
        {
          userId: user.id,
          title: 'Versicherungsvergleich prüfen',
          completedAt: addDays(new Date(), -1),
          dueAt: addDays(new Date(), -1),
        },
        // Überfällig – damit die Home-Kachel „Überfällig“ nicht leer bleibt
        {
          userId: user.id,
          title: 'Rechnung Werkstatt bezahlen',
          notes: 'Zahlungsziel war letzte Woche.',
          priority: 'HIGH',
          dueAt: addDays(new Date(), -3),
        },
        // Heute fällig
        {
          userId: user.id,
          title: 'Paket abholen',
          priority: 'MEDIUM',
          taskListId: errandsList.id,
          dueAt: (() => {
            const d = new Date();
            d.setHours(18, 0, 0, 0);
            return d;
          })(),
        },
        {
          userId: user.id,
          title: 'Wäsche aufhängen',
          priority: 'LOW',
          taskListId: errandsList.id,
          recurrence: 'WEEKLY',
          dueAt: addDays(new Date(), 1),
        },
        {
          userId: user.id,
          title: 'Geschenk für Lena besorgen',
          notes: 'Geburtstag ist am Wochenende.',
          priority: 'HIGH',
          taskListId: projectList.id,
          dueAt: addDays(new Date(), 4),
        },
        {
          userId: user.id,
          title: 'Angebote für Umzugsfirma einholen',
          priority: 'MEDIUM',
          taskListId: projectList.id,
          dueAt: addDays(new Date(), 10),
        },
        {
          userId: user.id,
          title: 'Kellerregal aufbauen',
          priority: 'LOW',
          taskListId: projectList.id,
        },
        {
          userId: user.id,
          title: 'Handyvertrag kündigen',
          taskListId: projectList.id,
          completedAt: addDays(new Date(), -4),
        },
      ],
    });

    // ---------- Kalender ----------
    const privateCal = await this.prisma.calendar.create({
      data: { userId: user.id, name: 'Privat', color: '#5b8def', isDefault: true },
    });
    const workCal = await this.prisma.calendar.create({
      data: { userId: user.id, name: 'Arbeit', color: '#fda481' },
    });
    const at = (daysFromNow: number, hour: number, minutes = 0) => {
      const d = addDays(new Date(), daysFromNow);
      d.setHours(hour, minutes, 0, 0);
      return d;
    };
    await this.prisma.calendarEvent.createMany({
      data: [
        {
          calendarId: privateCal.id,
          title: 'Zahnarzt',
          location: 'Praxis Dr. Sommer',
          startsAt: at(1, 9, 30),
          endsAt: at(1, 10, 15),
          reminderMinutes: 60,
        },
        {
          calendarId: workCal.id,
          title: 'Team-Meeting',
          startsAt: at(2, 10, 0),
          endsAt: at(2, 11, 0),
          recurrence: 'WEEKLY',
          reminderMinutes: 15,
        },
        {
          calendarId: privateCal.id,
          title: 'Geburtstag Lena',
          startsAt: at(5, 0, 0),
          endsAt: at(5, 23, 59),
          isAllDay: true,
          recurrence: 'YEARLY',
        },
        {
          calendarId: privateCal.id,
          title: 'Sport',
          startsAt: at(3, 18, 30),
          endsAt: at(3, 20, 0),
          recurrence: 'WEEKLY',
        },
        // Weiter verteilt über den Monat, damit die Monatsansicht gefüllt ist
        {
          calendarId: workCal.id,
          title: 'Quartalsplanung',
          location: 'Besprechungsraum 2',
          description: 'Zahlen aus Q2 mitbringen.',
          startsAt: at(8, 13, 0),
          endsAt: at(8, 16, 0),
          reminderMinutes: 60,
        },
        {
          calendarId: privateCal.id,
          title: 'Elternabend',
          location: 'Grundschule Nord',
          startsAt: at(9, 19, 0),
          endsAt: at(9, 20, 30),
          reminderMinutes: 120,
        },
        {
          calendarId: privateCal.id,
          title: 'Werkstatt-Termin',
          location: 'KFZ Meier',
          startsAt: at(12, 8, 0),
          endsAt: at(12, 9, 0),
          reminderMinutes: 1440,
        },
        {
          calendarId: workCal.id,
          title: 'Homeoffice',
          startsAt: at(15, 0, 0),
          endsAt: at(15, 23, 59),
          isAllDay: true,
        },
        {
          calendarId: privateCal.id,
          title: 'Konzert im Stadtpark',
          location: 'Stadtpark',
          startsAt: at(18, 20, 0),
          endsAt: at(18, 23, 0),
        },
        {
          calendarId: privateCal.id,
          title: 'Müllabfuhr Biotonne',
          startsAt: at(4, 0, 0),
          endsAt: at(4, 23, 59),
          isAllDay: true,
          recurrence: 'WEEKLY',
        },
        // Auch rückwärts, damit die Monatsansicht nicht erst ab heute füllt
        {
          calendarId: workCal.id,
          title: 'Retrospektive',
          startsAt: at(-4, 15, 0),
          endsAt: at(-4, 16, 0),
        },
        {
          calendarId: privateCal.id,
          title: 'Brunch mit Sarah',
          location: 'Café Central',
          startsAt: at(-6, 11, 0),
          endsAt: at(-6, 13, 0),
        },
      ],
    });

    // ---------- Rezepte ----------
    const bolognese = await this.prisma.recipe.create({
      data: {
        userId: user.id,
        title: 'Spaghetti Bolognese',
        description: 'Klassiker für die ganze Familie – schmeckt aufgewärmt fast noch besser.',
        prepMinutes: 15,
        cookMinutes: 45,
        servings: 4,
        difficulty: 'EASY',
        mealTypes: ['dinner'],
        tags: ['klassiker', 'familienessen'],
        instructions: [
          'Zwiebeln und Knoblauch fein würfeln und in Olivenöl glasig dünsten.',
          'Hackfleisch zugeben und krümelig anbraten.',
          'Tomaten zugeben, salzen, pfeffern und 30 Minuten köcheln lassen.',
          'Spaghetti nach Packungsangabe kochen und mit der Sauce servieren.',
        ],
        isFavorite: true,
        ingredients: {
          create: [
            { name: 'Hackfleisch', amount: 500, unit: 'g', sortOrder: 0 },
            { name: 'Passierte Tomaten', amount: 800, unit: 'g', sortOrder: 1 },
            { name: 'Zwiebeln', amount: 2, unit: 'Stück', sortOrder: 2 },
            { name: 'Knoblauchzehen', amount: 2, unit: 'Stück', sortOrder: 3 },
            { name: 'Spaghetti', amount: 500, unit: 'g', sortOrder: 4 },
            { name: 'Olivenöl', sortOrder: 5 },
          ],
        },
      },
    });
    const porridge = await this.prisma.recipe.create({
      data: {
        userId: user.id,
        title: 'Porridge mit Beeren',
        description: 'Schnelles Frühstück, das lange satt hält.',
        prepMinutes: 5,
        cookMinutes: 10,
        servings: 2,
        difficulty: 'EASY',
        mealTypes: ['breakfast'],
        dietary: ['vegetarian'],
        tags: ['schnell'],
        instructions: [
          'Haferflocken mit Milch aufkochen und 5 Minuten quellen lassen.',
          'Mit Beeren und Honig anrichten.',
        ],
        ingredients: {
          create: [
            { name: 'Haferflocken', amount: 100, unit: 'g', sortOrder: 0 },
            { name: 'Milch', amount: 400, unit: 'ml', sortOrder: 1 },
            { name: 'Beerenmischung', amount: 150, unit: 'g', sortOrder: 2 },
            { name: 'Honig', amount: 2, unit: 'EL', sortOrder: 3 },
          ],
        },
      },
    });

    const curry = await this.prisma.recipe.create({
      data: {
        userId: user.id,
        title: 'Rotes Linsen-Curry',
        description: 'Ein Topf, 25 Minuten, komplett pflanzlich – und am nächsten Tag noch besser.',
        prepMinutes: 10,
        cookMinutes: 25,
        servings: 4,
        difficulty: 'EASY',
        mealTypes: ['lunch', 'dinner'],
        dietary: ['vegan', 'vegetarian', 'gluten-free'],
        tags: ['schnell', 'meal-prep'],
        isFavorite: true,
        instructions: [
          'Zwiebel und Ingwer würfeln, in Öl anschwitzen, Currypaste kurz mitrösten.',
          'Linsen, Kokosmilch und Gemüsebrühe zugeben, aufkochen.',
          '20 Minuten köcheln lassen, bis die Linsen zerfallen.',
          'Mit Limettensaft und Salz abschmecken, mit Koriander servieren.',
        ],
        ingredients: {
          create: [
            { name: 'Rote Linsen', amount: 300, unit: 'g', sortOrder: 0 },
            { name: 'Kokosmilch', amount: 400, unit: 'ml', sortOrder: 1 },
            { name: 'Gemüsebrühe', amount: 500, unit: 'ml', sortOrder: 2 },
            { name: 'Zwiebeln', amount: 1, unit: 'Stück', sortOrder: 3 },
            { name: 'Ingwer', amount: 20, unit: 'g', sortOrder: 4 },
            { name: 'Rote Currypaste', amount: 2, unit: 'EL', sortOrder: 5 },
            { name: 'Limette', amount: 1, unit: 'Stück', sortOrder: 6 },
          ],
        },
      },
    });
    const ofengemuese = await this.prisma.recipe.create({
      data: {
        userId: user.id,
        title: 'Ofengemüse mit Feta',
        description: 'Blech rein, Blech raus. Funktioniert mit fast jedem Gemüse im Kühlschrank.',
        prepMinutes: 15,
        cookMinutes: 35,
        servings: 3,
        difficulty: 'EASY',
        mealTypes: ['dinner'],
        dietary: ['vegetarian', 'gluten-free'],
        tags: ['resteverwertung'],
        instructions: [
          'Ofen auf 200 °C Umluft vorheizen.',
          'Gemüse in mundgerechte Stücke schneiden, mit Öl, Salz und Oregano mischen.',
          '25 Minuten backen, dann den Feta darüber bröseln.',
          'Weitere 10 Minuten backen, bis der Feta Farbe nimmt.',
        ],
        ingredients: {
          create: [
            { name: 'Zucchini', amount: 2, unit: 'Stück', sortOrder: 0 },
            { name: 'Paprika', amount: 2, unit: 'Stück', sortOrder: 1 },
            { name: 'Kartoffeln', amount: 600, unit: 'g', sortOrder: 2 },
            { name: 'Feta', amount: 200, unit: 'g', sortOrder: 3 },
            { name: 'Olivenöl', amount: 4, unit: 'EL', sortOrder: 4 },
            { name: 'Oregano', sortOrder: 5 },
          ],
        },
      },
    });
    const pancakes = await this.prisma.recipe.create({
      data: {
        userId: user.id,
        title: 'Buttermilch-Pancakes',
        description: 'Sonntagsfrühstück. Der Teig darf ruhig etwas klumpig bleiben.',
        prepMinutes: 10,
        cookMinutes: 15,
        servings: 2,
        difficulty: 'EASY',
        mealTypes: ['breakfast'],
        dietary: ['vegetarian'],
        tags: ['wochenende'],
        instructions: [
          'Trockene Zutaten mischen, Buttermilch und Ei unterrühren.',
          'Teig 10 Minuten ruhen lassen.',
          'Portionsweise in einer beschichteten Pfanne goldbraun backen.',
        ],
        ingredients: {
          create: [
            { name: 'Mehl', amount: 250, unit: 'g', sortOrder: 0 },
            { name: 'Buttermilch', amount: 300, unit: 'ml', sortOrder: 1 },
            { name: 'Eier', amount: 2, unit: 'Stück', sortOrder: 2 },
            { name: 'Backpulver', amount: 1, unit: 'TL', sortOrder: 3 },
            { name: 'Ahornsirup', sortOrder: 4 },
          ],
        },
      },
    });
    const schokomousse = await this.prisma.recipe.create({
      data: {
        userId: user.id,
        title: 'Schokomousse',
        description: 'Braucht vier Stunden im Kühlschrank – also rechtzeitig anfangen.',
        prepMinutes: 20,
        cookMinutes: 0,
        servings: 4,
        difficulty: 'MEDIUM',
        mealTypes: ['dessert'],
        dietary: ['vegetarian'],
        tags: ['gäste'],
        instructions: [
          'Schokolade über dem Wasserbad schmelzen und leicht abkühlen lassen.',
          'Eigelb unterrühren, Sahne und Eiweiß getrennt steif schlagen.',
          'Erst die Sahne, dann das Eiweiß vorsichtig unterheben.',
          'Mindestens 4 Stunden kalt stellen.',
        ],
        ingredients: {
          create: [
            { name: 'Zartbitterschokolade', amount: 200, unit: 'g', sortOrder: 0 },
            { name: 'Sahne', amount: 250, unit: 'ml', sortOrder: 1 },
            { name: 'Eier', amount: 3, unit: 'Stück', sortOrder: 2 },
            { name: 'Zucker', amount: 40, unit: 'g', sortOrder: 3 },
          ],
        },
      },
    });

    // ---------- Listen (inkl. Herkunft aus Rezept) ----------
    await this.prisma.list.create({
      data: {
        userId: user.id,
        name: 'Wocheneinkauf',
        type: 'SHOPPING',
        items: {
          create: [
            { name: 'Hackfleisch', amount: 500, unit: 'g', sortOrder: 0, recipeId: bolognese.id },
            { name: 'Passierte Tomaten', amount: 800, unit: 'g', sortOrder: 1, recipeId: bolognese.id },
            { name: 'Spaghetti', amount: 500, unit: 'g', sortOrder: 2, recipeId: bolognese.id },
            { name: 'Kaffeebohnen', amount: 1, unit: 'kg', sortOrder: 3 },
            { name: 'Spülmittel', sortOrder: 4, checked: true },
          ],
        },
      },
    });
    await this.prisma.list.create({
      data: {
        userId: user.id,
        name: 'Packliste Urlaub',
        type: 'PACKING',
        items: {
          create: [
            { name: 'Reisepass', sortOrder: 0 },
            { name: 'Ladekabel', sortOrder: 1 },
            { name: 'Sonnencreme', sortOrder: 2 },
            { name: 'Badesachen', sortOrder: 3, checked: true },
            { name: 'Reiseapotheke', sortOrder: 4 },
            { name: 'Adapter Italien', sortOrder: 5 },
          ],
        },
      },
    });
    await this.prisma.list.create({
      data: {
        userId: user.id,
        name: 'Wohnung übergeben',
        type: 'CHECKLIST',
        icon: '🔑',
        items: {
          create: [
            { name: 'Zählerstände notieren', sortOrder: 0, checked: true },
            { name: 'Nachsendeauftrag stellen', sortOrder: 1, checked: true },
            { name: 'Löcher spachteln', sortOrder: 2 },
            { name: 'Übergabeprotokoll ausdrucken', sortOrder: 3 },
            { name: 'Zweitschlüssel von Nachbarn holen', sortOrder: 4 },
          ],
        },
      },
    });
    await this.prisma.list.create({
      data: {
        userId: user.id,
        name: 'Wünsche',
        type: 'WISHLIST',
        icon: '🎁',
        items: {
          create: [
            { name: 'Kopfhörer mit ANC', amount: 1, unit: 'Stück', sortOrder: 0 },
            { name: 'Pfanne 28 cm', sortOrder: 1 },
            { name: 'Buch: Die Kunst des klaren Denkens', sortOrder: 2 },
          ],
        },
      },
    });

    // ---------- Wochenplan (Rezepte ↔ Kalender/Einkauf) ----------
    const planDay = (offset: number) => {
      const d = addDays(new Date(), offset);
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    };
    await this.prisma.mealPlanEntry.createMany({
      data: [
        { userId: user.id, recipeId: bolognese.id, date: planDay(1), slot: 'DINNER', servings: 4 },
        { userId: user.id, recipeId: porridge.id, date: planDay(1), slot: 'BREAKFAST', servings: 2 },
        { userId: user.id, recipeId: porridge.id, date: planDay(3), slot: 'BREAKFAST', servings: 2 },
        { userId: user.id, title: 'Essen gehen', date: planDay(5), slot: 'DINNER', servings: 2 },
        // Woche weiter füllen – so hat „Einkaufsliste erzeugen“ auch etwas zu tun
        { userId: user.id, recipeId: curry.id, date: planDay(0), slot: 'DINNER', servings: 4 },
        { userId: user.id, recipeId: curry.id, date: planDay(2), slot: 'LUNCH', servings: 2 },
        { userId: user.id, recipeId: ofengemuese.id, date: planDay(2), slot: 'DINNER', servings: 3 },
        { userId: user.id, recipeId: pancakes.id, date: planDay(6), slot: 'BREAKFAST', servings: 2 },
        { userId: user.id, recipeId: ofengemuese.id, date: planDay(4), slot: 'DINNER', servings: 3 },
        { userId: user.id, recipeId: schokomousse.id, date: planDay(5), slot: 'SNACK', servings: 4 },
        { userId: user.id, title: 'Reste', date: planDay(3), slot: 'DINNER', servings: 2 },
      ],
    });

    // ---------- Notizen ----------
    await this.prisma.note.createMany({
      data: [
        {
          userId: user.id,
          title: 'WLAN Ferienwohnung',
          content: 'Netz: Gardasee-Gast\nPasswort: siehe Ordner im Flur',
          tags: ['urlaub'],
          color: '#5b8def',
          pinned: true,
        },
        {
          userId: user.id,
          title: 'Ideen fürs Wohnzimmer',
          content: 'Regal umstellen, Pflanze für die Ecke, Lampe warmweiß tauschen',
          tags: ['wohnen', 'ideen'],
        },
        {
          userId: user.id,
          content: 'Autoschlüssel-Ersatz liegt bei den Nachbarn.',
          tags: ['wichtig'],
        },
        {
          userId: user.id,
          title: 'Buchtipps von Sarah',
          content:
            'Die Kunst des klaren Denkens\nDer Weg des Künstlers\nEine kurze Geschichte der Zeit',
          tags: ['ideen'],
          color: '#b97aff',
        },
        {
          userId: user.id,
          title: 'Zählerstände 01.07.',
          content: 'Strom: 41 892 kWh\nGas: 8 214 m³\nWasser: 412 m³',
          tags: ['wohnen', 'wichtig'],
          color: '#3aa3a5',
        },
        {
          userId: user.id,
          title: 'Rezeptidee: Ofengemüse-Variante',
          content:
            'Beim nächsten Mal Süßkartoffel statt Kartoffel und Halloumi statt Feta probieren.',
          tags: ['kochen'],
        },
      ],
    });

    // ---------- Gewohnheiten (mit Historie, damit Streaks sichtbar sind) ----------
    const utcToday = (() => {
      const now = new Date();
      return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    })();
    const dayBefore = (offset: number) => new Date(utcToday - offset * 86_400_000);

    const lesen = await this.prisma.habit.create({
      data: {
        userId: user.id,
        title: '30 Minuten lesen',
        notes: 'Abends statt Handy.',
        frequency: 'DAILY',
        color: '#5b8def',
      },
    });
    const sport = await this.prisma.habit.create({
      data: {
        userId: user.id,
        title: 'Sport',
        frequency: 'WEEKLY',
        targetPerPeriod: 3,
        color: '#1f8a5b',
      },
    });
    const wasser = await this.prisma.habit.create({
      data: { userId: user.id, title: '2 Liter Wasser', frequency: 'DAILY', color: '#3aa3a5' },
    });
    const meditation = await this.prisma.habit.create({
      data: {
        userId: user.id,
        title: '10 Minuten Meditation',
        notes: 'Direkt nach dem Aufstehen.',
        frequency: 'DAILY',
        color: '#b97aff',
      },
    });
    const putzen = await this.prisma.habit.create({
      data: {
        userId: user.id,
        title: 'Wohnung durchwischen',
        frequency: 'WEEKLY',
        targetPerPeriod: 1,
        color: '#fda481',
      },
    });
    // Archiviert – zeigt, dass pausierte Routinen erhalten bleiben
    await this.prisma.habit.create({
      data: {
        userId: user.id,
        title: 'Vokabeln lernen',
        frequency: 'DAILY',
        color: '#e76b8d',
        isArchived: true,
      },
    });

    await this.prisma.habitEntry.createMany({
      data: [
        // Lesen: lückenlose Serie seit gestern, heute noch offen
        ...[1, 2, 3, 4, 5, 6].map((d) => ({ habitId: lesen.id, date: dayBefore(d) })),
        // Sport: verteilt über die letzten drei Wochen
        ...[1, 4, 6, 8, 11, 15, 18].map((d) => ({ habitId: sport.id, date: dayBefore(d) })),
        // Wasser: heute bereits erledigt
        ...[0, 1, 2, 4, 5].map((d) => ({ habitId: wasser.id, date: dayBefore(d) })),
        // Meditation: junge Serie, heute schon abgehakt
        ...[0, 1, 2].map((d) => ({ habitId: meditation.id, date: dayBefore(d) })),
        // Putzen: einmal pro Woche über vier Wochen
        ...[2, 9, 16, 23].map((d) => ({ habitId: putzen.id, date: dayBefore(d) })),
      ],
    });

    // ---------- Reise (Showcase: Termin + Packliste + Notiz) ----------
    const tripStart = addDays(new Date(), 30);
    const tripEnd = addDays(new Date(), 40);
    const trip = await this.prisma.trip.create({
      data: {
        userId: user.id,
        title: 'Sommerurlaub Italien',
        destination: 'Gardasee',
        startDate: utcDate(tripStart),
        endDate: utcDate(tripEnd),
        budgetAmount: 1800,
        notes: 'Fähre nach Limone vorab buchen. Vignette für Österreich nicht vergessen.',
      },
    });
    const packingList = await this.prisma.list.findFirst({
      where: { userId: user.id, name: 'Packliste Urlaub' },
    });
    const wlanNote = await this.prisma.note.findFirst({
      where: { userId: user.id, title: 'WLAN Ferienwohnung' },
    });
    const tripEvent = await this.prisma.calendarEvent.create({
      data: {
        calendarId: privateCal.id,
        title: 'Abfahrt Italien',
        startsAt: new Date(tripStart.setHours(6, 0, 0, 0)),
        endsAt: new Date(new Date(tripStart).setHours(14, 0, 0, 0)),
        reminderMinutes: 1440,
      },
    });
    await this.prisma.entityLink.createMany({
      data: [
        ...(packingList
          ? [
              {
                userId: user.id,
                sourceType: 'TRIP' as const,
                sourceId: trip.id,
                targetType: 'LIST' as const,
                targetId: packingList.id,
              },
            ]
          : []),
        ...(wlanNote
          ? [
              {
                userId: user.id,
                sourceType: 'TRIP' as const,
                sourceId: trip.id,
                targetType: 'NOTE' as const,
                targetId: wlanNote.id,
              },
            ]
          : []),
        {
          userId: user.id,
          sourceType: 'TRIP' as const,
          sourceId: trip.id,
          targetType: 'CALENDAR_EVENT' as const,
          targetId: tripEvent.id,
        },
      ],
    });

    // Zwei weitere Reisen, damit alle drei Status vertreten sind
    const cityStart = addDays(new Date(), 12);
    const cityEnd = addDays(new Date(), 15);
    await this.prisma.trip.create({
      data: {
        userId: user.id,
        title: 'Städtetrip Wien',
        destination: 'Wien',
        startDate: utcDate(cityStart),
        endDate: utcDate(cityEnd),
        budgetAmount: 620,
        notes: 'Zug ist gebucht. Museumsquartier und Naschmarkt einplanen.',
      },
    });
    const pastStart = addDays(new Date(), -75);
    const pastEnd = addDays(new Date(), -68);
    await this.prisma.trip.create({
      data: {
        userId: user.id,
        title: 'Wanderwoche Allgäu',
        destination: 'Oberstdorf',
        startDate: utcDate(pastStart),
        endDate: utcDate(pastEnd),
        budgetAmount: 480,
        status: 'DONE',
        notes: 'Hütte war ausgebucht – nächstes Mal früher reservieren.',
      },
    });

    // ---------- Dokumente ----------
    // Echte, verschlüsselte Dateien: sie nehmen denselben Weg wie ein
    // Upload, damit der Download in der Demo tatsächlich funktioniert.
    const documents = await this.seedDocuments(user.id);

    // Mietvertrag an die Reise hängen? Nein – Reisepass passt fachlich.
    const passport = documents.find((d) => d.title === 'Reisepass');
    if (passport) {
      await this.prisma.entityLink.create({
        data: {
          userId: user.id,
          sourceType: 'TRIP',
          sourceId: trip.id,
          targetType: 'DOCUMENT',
          targetId: passport.id,
        },
      });
    }

    // ---------- Benachrichtigungen ----------
    await this.prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: 'BUDGET_WARNING',
          title: 'Budget fast aufgebraucht',
          message: 'Im Budget „Restaurant & Café" sind noch 18,40 € übrig.',
          createdAt: addDays(new Date(), -1),
        },
        {
          userId: user.id,
          type: 'TASK_DUE',
          title: 'Aufgabe überfällig',
          message: '„Rechnung Werkstatt bezahlen" war vor 3 Tagen fällig.',
          createdAt: addDays(new Date(), -1),
        },
        {
          userId: user.id,
          type: 'EVENT_REMINDER',
          title: 'Termin morgen',
          message: 'Zahnarzt um 09:30 Uhr bei Praxis Dr. Sommer.',
        },
        {
          userId: user.id,
          type: 'SAVINGS_MILESTONE',
          title: 'Sparziel erreicht',
          message: 'Der Notgroschen ist voll – 10.000 € erreicht.',
          isRead: true,
          readAt: addDays(new Date(), -5),
          createdAt: addDays(new Date(), -6),
        },
        {
          userId: user.id,
          type: 'RECURRING_DETECTED',
          title: 'Neues Abo erkannt',
          message: 'Wiederkehrende Abbuchung von 12,99 € an „Streaming Plus" gefunden.',
          isRead: true,
          readAt: addDays(new Date(), -9),
          createdAt: addDays(new Date(), -10),
        },
      ],
    });

    const counts = await this.countAll(user.id);
    this.logger.log(
      `Demo-Daten angelegt: ${DEMO_EMAIL} / ${DEMO_PASSWORD} – ` +
        `4 Konten, ${txInputs.length} Transaktionen, ${budgets.length} Budgets, ` +
        `${counts.investmentPosition} Depot-Positionen, 3 Sparziele, 4 Verträge, ` +
        `4 wiederkehrende Zahlungen, ${counts.task} Aufgaben in 2 Listen, ` +
        `2 Kalender mit ${counts.calendarEvent} Terminen, ${counts.recipe} Rezepte, ` +
        `${counts.list} Listen, ${counts.mealPlanEntry} Wochenplan-Einträge, ` +
        `${counts.note} Notizen, ${counts.habit} Gewohnheiten mit Historie, ` +
        `${counts.trip} Reisen, ${counts.document} verschlüsselte Dokumente, ` +
        `${counts.notification} Benachrichtigungen, ${counts.entityLink} Verknüpfungen.`,
    );
  }

  /**
   * Zählt je Modul, was der Demo-User tatsächlich hat. Bleibt ein Modul
   * leer, sieht die Demo dort nach einem Fehler aus – deshalb wird das
   * beim Seed-Lauf ausdrücklich gemeldet statt still zu bleiben.
   */
  private async countAll(userId: string) {
    const [
      investmentPosition,
      task,
      calendarEvent,
      recipe,
      list,
      mealPlanEntry,
      note,
      habit,
      trip,
      document,
      notification,
      entityLink,
    ] = await Promise.all([
      this.prisma.investmentPosition.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.calendarEvent.count({ where: { calendar: { userId } } }),
      this.prisma.recipe.count({ where: { userId } }),
      this.prisma.list.count({ where: { userId } }),
      this.prisma.mealPlanEntry.count({ where: { userId } }),
      this.prisma.note.count({ where: { userId } }),
      this.prisma.habit.count({ where: { userId } }),
      this.prisma.trip.count({ where: { userId } }),
      this.prisma.document.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.entityLink.count({ where: { userId } }),
    ]);

    const counts = {
      investmentPosition,
      task,
      calendarEvent,
      recipe,
      list,
      mealPlanEntry,
      note,
      habit,
      trip,
      document,
      notification,
      entityLink,
    };
    const leer = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([name]) => name);
    if (leer.length > 0) {
      this.logger.warn(`Demo-Daten unvollständig – keine Einträge für: ${leer.join(', ')}`);
    }
    return counts;
  }

  /**
   * Legt echte Dokumente an: die Dateien werden über denselben Storage
   * geschrieben wie ein normaler Upload und sind damit verschlüsselt,
   * prüfsummengesichert und in der Demo tatsächlich herunterladbar.
   */
  private async seedDocuments(userId: string) {
    const heute = new Date().toLocaleDateString('de-DE');
    const files: Array<{
      title: string;
      filename: string;
      mimeType: string;
      content: Buffer;
      tags: string[];
      notes?: string;
      expiresAt?: Date;
    }> = [
      {
        title: 'Mietvertrag',
        filename: 'mietvertrag-hauptstrasse.pdf',
        mimeType: 'application/pdf',
        content: buildPdf('Mietvertrag', [
          'Mieter: Demo Benutzer',
          'Objekt: Hauptstrasse 12, 3. OG links',
          'Kaltmiete: 850,00 EUR   Nebenkosten: 190,00 EUR',
          'Beginn: 01.03.2023   Kuendigungsfrist: 3 Monate',
          '',
          'Dies ist ein Beispieldokument der Orynthia-Demo.',
        ]),
        tags: ['wohnen', 'vertrag'],
        notes: 'Kündigungsfrist 3 Monate zum Monatsende.',
      },
      {
        title: 'Reisepass',
        filename: 'reisepass-scan.pdf',
        mimeType: 'application/pdf',
        content: buildPdf('Reisepass (Kopie)', [
          'Name: Demo Benutzer',
          'Pass-Nr.: C01X00T47',
          'Ausgestellt: 14.05.2021',
          '',
          'Dies ist ein Beispieldokument der Orynthia-Demo.',
        ]),
        tags: ['ausweis', 'reise'],
        expiresAt: addMonths(new Date(), 36),
      },
      {
        title: 'Personalausweis',
        filename: 'personalausweis.pdf',
        mimeType: 'application/pdf',
        content: buildPdf('Personalausweis (Kopie)', [
          'Name: Demo Benutzer',
          'Ausweis-Nr.: T22000129',
          '',
          'Dies ist ein Beispieldokument der Orynthia-Demo.',
        ]),
        tags: ['ausweis'],
        // Läuft bald ab – so ist der Hinweis auf der Seite sichtbar
        expiresAt: addDays(new Date(), 24),
        notes: 'Verlängerung rechtzeitig beim Bürgeramt beantragen.',
      },
      {
        title: 'Hausratversicherung – Police',
        filename: 'hausrat-police-2026.pdf',
        mimeType: 'application/pdf',
        content: buildPdf('Versicherungsschein Hausrat', [
          'Versicherungsnummer: HR-884213',
          'Versicherungssumme: 65.000 EUR',
          'Jahresbeitrag: 142,80 EUR',
          'Selbstbeteiligung: 150 EUR',
          '',
          'Dies ist ein Beispieldokument der Orynthia-Demo.',
        ]),
        tags: ['versicherung', 'vertrag'],
      },
      {
        title: 'Gehaltsabrechnung Juni',
        filename: 'gehaltsabrechnung-juni.pdf',
        mimeType: 'application/pdf',
        content: buildPdf('Gehaltsabrechnung Juni', [
          'Arbeitgeber: Musterfirma GmbH',
          'Brutto: 4.200,00 EUR',
          'Netto: 2.685,00 EUR',
          '',
          'Dies ist ein Beispieldokument der Orynthia-Demo.',
        ]),
        tags: ['gehalt', '2026'],
      },
      {
        title: 'Zählerstände',
        filename: 'zaehlerstaende.txt',
        mimeType: 'text/plain',
        content: Buffer.from(
          [
            `Ablesung vom ${heute}`,
            '',
            'Strom  41892 kWh',
            'Gas     8214 m3',
            'Wasser   412 m3',
          ].join('\n'),
          'utf8',
        ),
        tags: ['wohnen'],
      },
    ];

    const created = [];
    for (const file of files) {
      const storageKey = this.documentStorage.newStorageKey();
      await this.documentStorage.write(storageKey, file.content);
      created.push(
        await this.prisma.document.create({
          data: {
            userId,
            title: file.title,
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.content.length,
            storageKey,
            checksum: this.documentStorage.checksum(file.content),
            tags: file.tags,
            notes: file.notes,
            expiresAt: file.expiresAt,
          },
          select: { id: true, title: true },
        }),
      );
    }
    return created;
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

/** Reine Datumsangabe ohne Zeitzonen-Drift (Reisen speichern nur Tage). */
function utcDate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Erzeugt ein gültiges, einseitiges PDF. Die Demo soll herunterladbare
 * Dateien enthalten, die sich auch wirklich öffnen lassen – ein Platzhalter
 * mit ein paar Bytes würde im PDF-Viewer nur eine Fehlermeldung zeigen.
 */
function buildPdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/([\\()])/g, '\\$1');
  const body = [
    'BT',
    '/F1 18 Tf',
    '60 780 Td',
    `(${esc(title)}) Tj`,
    '/F1 11 Tf',
    ...lines.flatMap((l) => ['0 -26 Td', `(${esc(l)}) Tj`]),
    'ET',
  ].join('\n');
  // WinAnsi deckt Umlaute ab; latin1 ist genau diese Byte-Darstellung.
  const stream = Buffer.from(body, 'latin1');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`,
  ];

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [];
  let position = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(position);
    const chunk = Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, 'latin1');
    parts.push(chunk);
    position += chunk.length;
  });

  const xrefStart = position;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  ].join('');
  parts.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(parts);
}
