import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

// Durchschnittliche Marktpreise Deutschland (Stand 2025/2026)
// Quelle: Check24, Verivox, Stiftung Warentest Durchschnittswerte
const MARKET_AVERAGES: Record<string, { avgMonthly: number; avgYearly: number; unit?: string; tips: string[]; compareUrls: string[] }> = {
  INSURANCE_LIABILITY: {
    avgMonthly: 5,
    avgYearly: 60,
    tips: ['Gute Tarife gibt es ab 3-5€/Monat', 'Deckungssumme mind. 10 Mio € empfohlen', 'Schlüsselverlust sollte mitversichert sein'],
    compareUrls: ['https://www.check24.de/haftpflichtversicherung/', 'https://www.verivox.de/haftpflichtversicherung/'],
  },
  INSURANCE_HOUSEHOLD: {
    avgMonthly: 15,
    avgYearly: 180,
    tips: ['Versicherungssumme an Haushaltsgröße anpassen (650€/m²)', 'Fahrraddiebstahl prüfen', 'Elementarschäden optional mitversichern'],
    compareUrls: ['https://www.check24.de/hausratversicherung/', 'https://www.verivox.de/hausratversicherung/'],
  },
  INSURANCE_HEALTH: {
    avgMonthly: 200,
    avgYearly: 2400,
    tips: ['Krankenzusatzversicherung prüfen', 'Zahnzusatz separat oft günstiger', 'Beiträge steigen mit dem Alter'],
    compareUrls: ['https://www.check24.de/krankenversicherung/'],
  },
  INSURANCE_DENTAL: {
    avgMonthly: 25,
    avgYearly: 300,
    tips: ['Wartezeiten beachten (meist 8 Monate)', 'Mind. 80% Erstattung für Zahnersatz', 'Professionelle Zahnreinigung inklusive?'],
    compareUrls: ['https://www.check24.de/zahnzusatzversicherung/', 'https://www.waizmanntabelle.de/'],
  },
  INSURANCE_CAR: {
    avgMonthly: 50,
    avgYearly: 600,
    tips: ['Jährliche Zahlung spart 5-10%', 'SF-Klasse beim Wechsel mitnehmen', 'Werkstattbindung spart 10-20%'],
    compareUrls: ['https://www.check24.de/kfz-versicherung/', 'https://www.verivox.de/kfz-versicherung/'],
  },
  INSURANCE_LEGAL: {
    avgMonthly: 20,
    avgYearly: 240,
    tips: ['Privat + Beruf + Verkehr als Kombipaket', 'Selbstbeteiligung von 150€ senkt Beitrag', 'Mietrecht als Baustein wichtig'],
    compareUrls: ['https://www.check24.de/rechtsschutzversicherung/'],
  },
  INSURANCE_DISABILITY: {
    avgMonthly: 60,
    avgYearly: 720,
    tips: ['Früh abschließen = günstiger', 'Mind. 75% des Nettoeinkommens absichern', 'Nachversicherungsgarantie wichtig'],
    compareUrls: ['https://www.check24.de/berufsunfaehigkeitsversicherung/'],
  },
  INSURANCE_LIFE: {
    avgMonthly: 30,
    avgYearly: 360,
    tips: ['Risikolebensversicherung ist günstiger als Kapitallebensversicherung', 'Laufzeit an Bedarf anpassen', 'Überschussbeteiligung vergleichen'],
    compareUrls: ['https://www.check24.de/risikolebensversicherung/'],
  },
  ENERGY_ELECTRICITY: {
    avgMonthly: 80,
    avgYearly: 960,
    unit: 'ct/kWh',
    tips: ['Durchschnittspreis ca. 30-35 ct/kWh (2025)', 'Neukundenbonus mitnehmen', 'Ökostrom oft gleich teuer oder günstiger', 'Jährlich Anbieter wechseln spart 100-300€'],
    compareUrls: ['https://www.check24.de/strom/', 'https://www.verivox.de/strom/'],
  },
  ENERGY_GAS: {
    avgMonthly: 100,
    avgYearly: 1200,
    unit: 'ct/kWh',
    tips: ['Durchschnittspreis ca. 10-12 ct/kWh (2025)', 'Gaspreisbremse beachten', 'Wechsel spart oft 200-500€/Jahr'],
    compareUrls: ['https://www.check24.de/gas/', 'https://www.verivox.de/gas/'],
  },
  TELECOM_MOBILE: {
    avgMonthly: 20,
    avgYearly: 240,
    tips: ['Discounter (Aldi Talk, Lidl Connect) ab 8€/Monat', 'Drillisch-Marken bieten gutes Preis-Leistungs-Verhältnis', '5G-Tarife werden günstiger'],
    compareUrls: ['https://www.check24.de/handytarife/', 'https://www.verivox.de/handy/'],
  },
  TELECOM_INTERNET: {
    avgMonthly: 35,
    avgYearly: 420,
    tips: ['100 Mbit/s reichen für die meisten Haushalte', 'Glasfaser zukunftssicher', 'Router-Freiheit nutzen statt Miete'],
    compareUrls: ['https://www.check24.de/dsl/', 'https://www.verivox.de/internet/'],
  },
};

export interface DetectedContract {
  counterpartName: string;
  counterpartIban?: string;
  occurrences: number;
  totalAmount: number;
  avgAmount: number;
  frequency: string;
  lastDate: Date;
  firstDate: Date;
  suggestedType: string;
}

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateContractDto) {
    // Monatlich/jährlich berechnen wenn nur eins angegeben
    let monthlyCost = dto.monthlyCost;
    let yearlyCost = dto.yearlyCost;
    const cycle = dto.billingCycle || 'MONTHLY';

    if (monthlyCost && !yearlyCost) {
      yearlyCost = monthlyCost * 12;
    } else if (yearlyCost && !monthlyCost) {
      monthlyCost = yearlyCost / 12;
    }

    return this.prisma.contract.create({
      data: {
        userId,
        name: dto.name,
        provider: dto.provider,
        contractType: dto.contractType as any,
        monthlyCost,
        yearlyCost,
        billingCycle: cycle as any,
        contractNumber: dto.contractNumber,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        cancellationDate: dto.cancellationDate ? new Date(dto.cancellationDate) : null,
        noticePeriod: dto.noticePeriod,
        autoRenewal: dto.autoRenewal ?? true,
        details: dto.details || undefined,
        counterpartName: dto.counterpartName,
        counterpartIban: dto.counterpartIban,
      },
    });
  }

  async findAll(userId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { contractType: 'asc' }, { name: 'asc' }],
    });

    // Kosten zusammenrechnen
    const activeContracts = contracts.filter((c) => c.isActive);
    const totalMonthly = activeContracts.reduce((sum, c) => sum + Number(c.monthlyCost || 0), 0);
    const totalYearly = activeContracts.reduce((sum, c) => sum + Number(c.yearlyCost || 0), 0);

    // Gruppierung nach Typ
    const byType: Record<string, { contracts: typeof contracts; totalMonthly: number; totalYearly: number }> = {};
    for (const contract of contracts) {
      const type = contract.contractType;
      if (!byType[type]) {
        byType[type] = { contracts: [], totalMonthly: 0, totalYearly: 0 };
      }
      byType[type].contracts.push(contract);
      if (contract.isActive) {
        byType[type].totalMonthly += Number(contract.monthlyCost || 0);
        byType[type].totalYearly += Number(contract.yearlyCost || 0);
      }
    }

    return {
      contracts: contracts.map((c) => ({
        ...c,
        monthlyCost: Number(c.monthlyCost || 0),
        yearlyCost: Number(c.yearlyCost || 0),
        avgMonthlyAmount: Number(c.avgMonthlyAmount || 0),
      })),
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      totalYearly: Math.round(totalYearly * 100) / 100,
      byType,
    };
  }

  async update(userId: string, id: string, dto: UpdateContractDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, userId },
    });
    if (!contract) throw new NotFoundException('Vertrag nicht gefunden');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.contractType !== undefined) data.contractType = dto.contractType;
    if (dto.billingCycle !== undefined) data.billingCycle = dto.billingCycle;
    if (dto.contractNumber !== undefined) data.contractNumber = dto.contractNumber;
    if (dto.noticePeriod !== undefined) data.noticePeriod = dto.noticePeriod;
    if (dto.autoRenewal !== undefined) data.autoRenewal = dto.autoRenewal;
    if (dto.details !== undefined) data.details = dto.details;
    if (dto.counterpartName !== undefined) data.counterpartName = dto.counterpartName;
    if (dto.counterpartIban !== undefined) data.counterpartIban = dto.counterpartIban;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.cancellationDate !== undefined) data.cancellationDate = dto.cancellationDate ? new Date(dto.cancellationDate) : null;

    // Kosten synchron halten
    if (dto.monthlyCost !== undefined) {
      data.monthlyCost = dto.monthlyCost;
      if (dto.yearlyCost === undefined) data.yearlyCost = dto.monthlyCost * 12;
    }
    if (dto.yearlyCost !== undefined) {
      data.yearlyCost = dto.yearlyCost;
      if (dto.monthlyCost === undefined) data.monthlyCost = dto.yearlyCost / 12;
    }

    return this.prisma.contract.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, userId },
    });
    if (!contract) throw new NotFoundException('Vertrag nicht gefunden');

    await this.prisma.contract.delete({ where: { id } });
    return { message: 'Vertrag gelöscht' };
  }

  /** Automatische Vertragserkennung aus Transaktionsmustern */
  async detectContracts(userId: string) {
    // Alle Transaktionen der letzten 12 Monate laden
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        bankAccount: { userId },
        amount: { lt: 0 }, // Nur Ausgaben
        date: { gte: twelveMonthsAgo },
        counterpartName: { not: null },
      },
      select: {
        counterpartName: true,
        counterpartIban: true,
        amount: true,
        date: true,
        purpose: true,
      },
      orderBy: { date: 'asc' },
    });

    // Bereits vorhandene Verträge laden (zum Ausschließen)
    const existingContracts = await this.prisma.contract.findMany({
      where: { userId },
      select: { counterpartName: true, counterpartIban: true },
    });
    const existingNames = new Set(existingContracts.map((c) => c.counterpartName?.toLowerCase()).filter(Boolean));
    const existingIbans = new Set(existingContracts.map((c) => c.counterpartIban).filter(Boolean));

    // Nach Gegenpartei gruppieren
    const grouped = new Map<string, {
      name: string;
      iban?: string;
      amounts: number[];
      dates: Date[];
      purposes: string[];
    }>();

    for (const tx of transactions) {
      const name = tx.counterpartName!.trim();
      const key = tx.counterpartIban || name.toLowerCase();

      if (!grouped.has(key)) {
        grouped.set(key, { name, iban: tx.counterpartIban || undefined, amounts: [], dates: [], purposes: [] });
      }

      const entry = grouped.get(key)!;
      entry.amounts.push(Math.abs(Number(tx.amount)));
      entry.dates.push(tx.date);
      if (tx.purpose) entry.purposes.push(tx.purpose);
    }

    // Wiederkehrende Muster erkennen (mind. 3 Zahlungen, ähnliche Beträge)
    const detected: DetectedContract[] = [];

    for (const [, entry] of grouped) {
      if (entry.amounts.length < 3) continue;

      // Bereits als Vertrag erfasst?
      if (existingNames.has(entry.name.toLowerCase())) continue;
      if (entry.iban && existingIbans.has(entry.iban)) continue;

      const avgAmount = entry.amounts.reduce((a, b) => a + b, 0) / entry.amounts.length;

      // Betragsstabilität prüfen (max. 20% Abweichung vom Durchschnitt)
      const isStable = entry.amounts.every(
        (a) => Math.abs(a - avgAmount) / avgAmount < 0.20,
      );
      if (!isStable) continue;

      // Frequenz schätzen
      const sortedDates = entry.dates.sort((a, b) => a.getTime() - b.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      let frequency = 'MONTHLY';
      if (avgInterval < 10) frequency = 'WEEKLY';
      else if (avgInterval < 21) frequency = 'BIWEEKLY';
      else if (avgInterval < 50) frequency = 'MONTHLY';
      else if (avgInterval < 120) frequency = 'QUARTERLY';
      else if (avgInterval < 250) frequency = 'BIANNUALLY';
      else frequency = 'YEARLY';

      // Vertragstyp raten
      const suggestedType = this.guessContractType(entry.name, entry.purposes);

      detected.push({
        counterpartName: entry.name,
        counterpartIban: entry.iban,
        occurrences: entry.amounts.length,
        totalAmount: entry.amounts.reduce((a, b) => a + b, 0),
        avgAmount: Math.round(avgAmount * 100) / 100,
        frequency,
        lastDate: sortedDates[sortedDates.length - 1],
        firstDate: sortedDates[0],
        suggestedType,
      });
    }

    // Nach Häufigkeit sortieren
    detected.sort((a, b) => b.occurrences - a.occurrences);

    return detected;
  }

  /** Vertrag aus Auto-Erkennung erstellen */
  async createFromDetection(userId: string, detection: {
    counterpartName: string;
    counterpartIban?: string;
    avgAmount: number;
    frequency: string;
    contractType: string;
    name?: string;
    provider?: string;
  }) {
    const monthlyAmount = this.toMonthly(detection.avgAmount, detection.frequency);

    return this.create(userId, {
      name: detection.name || detection.counterpartName,
      provider: detection.provider || detection.counterpartName,
      contractType: detection.contractType,
      monthlyCost: Math.round(monthlyAmount * 100) / 100,
      yearlyCost: Math.round(monthlyAmount * 12 * 100) / 100,
      billingCycle: this.frequencyToBilling(detection.frequency),
      counterpartName: detection.counterpartName,
      counterpartIban: detection.counterpartIban,
    });
  }

  /** Anbietervergleich: aktuelle Kosten vs. Marktdurchschnitt */
  async compareProviders(userId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { userId, isActive: true },
    });

    const comparisons = [];

    for (const contract of contracts) {
      const marketData = MARKET_AVERAGES[contract.contractType];
      if (!marketData) continue;

      const monthlyCost = Number(contract.monthlyCost || 0);
      const yearlyCost = Number(contract.yearlyCost || 0);
      const marketMonthly = marketData.avgMonthly;
      const marketYearly = marketData.avgYearly;

      const savingsPotentialMonthly = Math.max(0, monthlyCost - marketMonthly);
      const savingsPotentialYearly = Math.max(0, yearlyCost - marketYearly);
      const percentAboveAvg = marketMonthly > 0 ? Math.round(((monthlyCost - marketMonthly) / marketMonthly) * 100) : 0;

      comparisons.push({
        contractId: contract.id,
        contractName: contract.name,
        provider: contract.provider,
        contractType: contract.contractType,
        currentMonthly: monthlyCost,
        currentYearly: yearlyCost,
        marketAvgMonthly: marketMonthly,
        marketAvgYearly: marketYearly,
        savingsPotentialMonthly: Math.round(savingsPotentialMonthly * 100) / 100,
        savingsPotentialYearly: Math.round(savingsPotentialYearly * 100) / 100,
        percentAboveAvg,
        rating: percentAboveAvg <= 0 ? 'GOOD' : percentAboveAvg <= 30 ? 'OK' : 'EXPENSIVE',
        tips: marketData.tips,
        compareUrls: marketData.compareUrls,
        unit: marketData.unit,
      });
    }

    // Sortieren: teuerste Abweichungen zuerst
    comparisons.sort((a, b) => b.savingsPotentialYearly - a.savingsPotentialYearly);

    const totalSavingsMonthly = comparisons.reduce((sum, c) => sum + c.savingsPotentialMonthly, 0);
    const totalSavingsYearly = comparisons.reduce((sum, c) => sum + c.savingsPotentialYearly, 0);

    return {
      comparisons,
      totalSavingsMonthly: Math.round(totalSavingsMonthly * 100) / 100,
      totalSavingsYearly: Math.round(totalSavingsYearly * 100) / 100,
    };
  }

  // --- Hilfsmethoden ---

  private guessContractType(name: string, purposes: string[]): string {
    const text = `${name} ${purposes.join(' ')}`.toLowerCase();

    // Versicherungen
    if (text.match(/haftpflicht/)) return 'INSURANCE_LIABILITY';
    if (text.match(/hausrat/)) return 'INSURANCE_HOUSEHOLD';
    if (text.match(/kranken|health|aok|tk |barmer|dak/)) return 'INSURANCE_HEALTH';
    if (text.match(/zahn/)) return 'INSURANCE_DENTAL';
    if (text.match(/leben|life/)) return 'INSURANCE_LIFE';
    if (text.match(/kfz|auto.*versich|fahrzeug/)) return 'INSURANCE_CAR';
    if (text.match(/rechtsschutz/)) return 'INSURANCE_LEGAL';
    if (text.match(/berufsunfähig|bu-/)) return 'INSURANCE_DISABILITY';
    if (text.match(/versicher|allianz|ergo|huk|axa|generali|zurich|debeka|gothaer/)) return 'INSURANCE_OTHER';

    // Energie
    if (text.match(/strom|electricity|vattenfall|eon|e\.on|innogy|enb[wW]|stadtwerke.*strom|lichtblick|naturstrom/)) return 'ENERGY_ELECTRICITY';
    if (text.match(/gas|erdgas|stadtwerke.*gas/)) return 'ENERGY_GAS';

    // Telekommunikation
    if (text.match(/vodafone|telekom|o2|telefonica|1&1|drillisch|aldi.*talk|congstar|simyo|blau/)) {
      if (text.match(/dsl|internet|glasfaser|fiber/)) return 'TELECOM_INTERNET';
      return 'TELECOM_MOBILE';
    }
    if (text.match(/internet|dsl|glasfaser|unitymedia|kabel|fiber/)) return 'TELECOM_INTERNET';

    // Streaming
    if (text.match(/netflix|spotify|disney|amazon.*prime|dazn|apple.*tv|youtube.*premium|crunchyroll/)) return 'STREAMING';

    // Fitness
    if (text.match(/fitness|gym|mcfit|john reed|urban sport/)) return 'GYM';

    // Miete
    if (text.match(/miete|wohnung|hausgeld/)) return 'RENT';

    // Leasing
    if (text.match(/leasing|leasingrate/)) return 'LEASE';

    return 'SUBSCRIPTION';
  }

  private toMonthly(amount: number, frequency: string): number {
    switch (frequency) {
      case 'WEEKLY': return amount * 4.33;
      case 'BIWEEKLY': return amount * 2.17;
      case 'MONTHLY': return amount;
      case 'QUARTERLY': return amount / 3;
      case 'BIANNUALLY': return amount / 6;
      case 'YEARLY': return amount / 12;
      default: return amount;
    }
  }

  private frequencyToBilling(frequency: string): string {
    switch (frequency) {
      case 'WEEKLY':
      case 'BIWEEKLY':
      case 'MONTHLY': return 'MONTHLY';
      case 'QUARTERLY': return 'QUARTERLY';
      case 'BIANNUALLY': return 'BIANNUALLY';
      case 'YEARLY': return 'YEARLY';
      default: return 'MONTHLY';
    }
  }
}
