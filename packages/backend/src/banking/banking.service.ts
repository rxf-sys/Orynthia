import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GoCardlessProvider } from './providers/gocardless.provider';
import { BankingProvider, Institution } from './providers/banking-provider.interface';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);
  private readonly provider: BankingProvider;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private goCardless: GoCardlessProvider,
  ) {
    // Provider auswählen (aktuell nur GoCardless)
    this.provider = this.goCardless;
    this.logger.log(`Banking-Provider: ${this.provider.name}`);
  }

  /** Verfügbare Banken für ein Land abrufen */
  async getInstitutions(countryCode: string = 'DE'): Promise<Institution[]> {
    return this.provider.getInstitutions(countryCode.toUpperCase());
  }

  /** Bank-Verbindung starten - gibt Auth-URL zurück */
  async connectBank(userId: string, institutionId: string) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/accounts?bankConnected=true`;

    const result = await this.provider.createConnection({
      institutionId,
      redirectUrl,
      referenceId: userId,
    });

    // Verbindung in DB speichern
    await this.prisma.bankConnection.create({
      data: {
        userId,
        provider: this.provider.name,
        externalConnectionId: result.connectionId,
        institutionId,
        status: 'CREATED',
      },
    });

    return {
      connectionId: result.connectionId,
      authUrl: result.authUrl,
    };
  }

  /** Callback nach Bank-Authentifizierung - Konten importieren */
  async handleCallback(userId: string, connectionId: string) {
    const connection = await this.prisma.bankConnection.findFirst({
      where: { userId, externalConnectionId: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Verbindung nicht gefunden');
    }

    // Status prüfen
    const status = await this.provider.getConnectionStatus(connectionId);

    await this.prisma.bankConnection.update({
      where: { id: connection.id },
      data: { status: status.status },
    });

    if (status.status !== 'LINKED' && status.status !== 'GIVING_CONSENT') {
      // Manche Banken gehen direkt auf LINKED, manche brauchen einen Zwischenschritt
      if (status.accountIds.length === 0) {
        return { status: status.status, message: 'Bank-Authentifizierung noch nicht abgeschlossen', accounts: [] };
      }
    }

    // Konten importieren
    const externalAccounts = await this.provider.getAccounts(connectionId);
    const importedAccounts = [];

    for (const ext of externalAccounts) {
      // Prüfen ob Konto schon existiert
      const existing = await this.prisma.bankAccount.findFirst({
        where: { userId, externalId: ext.id },
      });

      if (existing) {
        importedAccounts.push(existing);
        continue;
      }

      // Kontostand abrufen
      let balance = 0;
      try {
        const balanceData = await this.provider.getBalances(ext.id);
        balance = balanceData.current;
      } catch (e) {
        this.logger.warn(`Kontostand für ${ext.id} nicht abrufbar: ${e}`);
      }

      // Konto anlegen
      const account = await this.prisma.bankAccount.create({
        data: {
          userId,
          bankName: ext.ownerName || ext.name || 'Bank',
          accountName: ext.product || ext.name || 'Konto',
          iban: ext.iban,
          accountType: this.guessAccountType(ext.product),
          balance,
          currency: ext.currency,
          externalId: ext.id,
          lastSynced: new Date(),
        },
      });

      importedAccounts.push(account);
    }

    // Direkt erste Synchronisation starten
    for (const acc of importedAccounts) {
      if (acc.externalId) {
        await this.syncAccount(userId, acc.id).catch((e) =>
          this.logger.warn(`Erster Sync für ${acc.id} fehlgeschlagen: ${e}`),
        );
      }
    }

    return {
      status: 'LINKED',
      message: `${importedAccounts.length} Konto(en) importiert`,
      accounts: importedAccounts,
    };
  }

  /** Einzelnes Konto synchronisieren */
  async syncAccount(userId: string, accountId: string, dateFrom?: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) throw new NotFoundException('Konto nicht gefunden');
    if (!account.externalId) throw new BadRequestException('Konto ist nicht mit einer Bank verbunden');

    // Kontostand aktualisieren
    try {
      const balance = await this.provider.getBalances(account.externalId);
      await this.prisma.bankAccount.update({
        where: { id: accountId },
        data: { balance: balance.current, lastSynced: new Date() },
      });
    } catch (e) {
      this.logger.warn(`Kontostand-Sync für ${accountId} fehlgeschlagen: ${e}`);
    }

    // Transaktionen abrufen (letzte 30 Tage als Standard)
    const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const transactions = await this.provider.getTransactions(account.externalId, from);

    let newCount = 0;
    let updatedCount = 0;

    // Auto-Kategorisierung laden
    const categories = await this.prisma.category.findMany({
      where: { OR: [{ userId }, { isSystem: true }] },
    });

    for (const tx of transactions) {
      // Prüfe ob Transaktion schon existiert
      const existing = await this.prisma.transaction.findUnique({
        where: { externalId: tx.externalId },
      });

      if (existing) {
        updatedCount++;
        continue;
      }

      // Auto-Kategorisierung
      const categoryId = this.autoMatchCategory(tx.purpose || '', tx.counterpartName || '', categories);

      await this.prisma.transaction.create({
        data: {
          bankAccountId: accountId,
          amount: tx.amount,
          currency: tx.currency,
          date: new Date(tx.date),
          valueDate: tx.bookingDate ? new Date(tx.bookingDate) : undefined,
          purpose: tx.purpose,
          counterpartName: tx.counterpartName,
          counterpartIban: tx.counterpartIban,
          type: tx.type as any,
          externalId: tx.externalId,
          categoryId,
        },
      });

      newCount++;
    }

    await this.prisma.bankAccount.update({
      where: { id: accountId },
      data: { lastSynced: new Date() },
    });

    return {
      newTransactions: newCount,
      existingTransactions: updatedCount,
      totalFetched: transactions.length,
    };
  }

  /** Alle verbundenen Konten eines Users synchronisieren */
  async syncAllAccounts(userId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId, isActive: true, externalId: { not: null } },
    });

    const results = [];
    for (const account of accounts) {
      try {
        const result = await this.syncAccount(userId, account.id);
        results.push({ accountId: account.id, accountName: account.accountName, ...result });
      } catch (e) {
        this.logger.error(`Sync fehlgeschlagen für ${account.id}: ${e}`);
        results.push({ accountId: account.id, accountName: account.accountName, error: String(e) });
      }
    }

    return results;
  }

  /** Verbindungen eines Users auflisten */
  async getConnections(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Verbindung entfernen */
  async removeConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.bankConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) throw new NotFoundException('Verbindung nicht gefunden');

    await this.prisma.bankConnection.delete({ where: { id: connectionId } });
    return { message: 'Verbindung entfernt' };
  }

  /** Automatischer Sync alle 6 Stunden */
  @Cron(CronExpression.EVERY_6_HOURS)
  async autoSync() {
    this.logger.log('Starte automatischen Bank-Sync...');

    const accounts = await this.prisma.bankAccount.findMany({
      where: { isActive: true, externalId: { not: null } },
      include: { user: { select: { id: true } } },
    });

    for (const account of accounts) {
      try {
        await this.syncAccount(account.userId, account.id);
        this.logger.log(`Sync erfolgreich: ${account.accountName} (${account.id})`);
      } catch (e) {
        this.logger.error(`Auto-Sync fehlgeschlagen für ${account.id}: ${e}`);
      }
    }

    this.logger.log(`Auto-Sync abgeschlossen: ${accounts.length} Konten verarbeitet`);
  }

  // --- Hilfsmethoden ---

  private guessAccountType(product?: string): 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEPOT' | 'OTHER' {
    if (!product) return 'CHECKING';
    const lower = product.toLowerCase();
    if (lower.includes('giro') || lower.includes('checking')) return 'CHECKING';
    if (lower.includes('spar') || lower.includes('tagesgeld') || lower.includes('saving')) return 'SAVINGS';
    if (lower.includes('kredit') || lower.includes('credit')) return 'CREDIT_CARD';
    if (lower.includes('depot') || lower.includes('wertpapier')) return 'DEPOT';
    return 'CHECKING';
  }

  private autoMatchCategory(purpose: string, counterpartName: string, categories: any[]): string | null {
    const searchText = `${purpose} ${counterpartName}`.toLowerCase();

    for (const cat of categories) {
      if (cat.keywords && cat.keywords.length > 0) {
        const match = cat.keywords.some((kw: string) => searchText.includes(kw.toLowerCase()));
        if (match) return cat.id;
      }
    }

    return null;
  }
}
