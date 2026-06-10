import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnableBankingProvider } from './providers/enable-banking.provider';
import { Institution } from './providers/banking-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { encrypt } from '../common/crypto/encryption';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private enableBanking: EnableBankingProvider,
    private notifications: NotificationsService,
  ) {
    this.logger.log(`Banking-Provider: ${this.enableBanking.name}`);
  }

  /** Verfügbare Banken für ein Land abrufen */
  async getInstitutions(countryCode: string = 'DE'): Promise<Institution[]> {
    return this.enableBanking.getInstitutions(countryCode.toUpperCase());
  }

  /** Bank-Verbindung starten - gibt Auth-URL zurück */
  async connectBank(userId: string, institutionId: string) {
    // Enable Banking erfordert exakten Match mit den Redirect-URLs, die in der
    // App-Registrierung hinterlegt sind. Wir senden daher nur die saubere
    // Basis-URL ohne Query-Params – Enable Banking hängt code + state selbst an.
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    const redirectUrl = `${frontendUrl}/accounts`;

    const result = await this.enableBanking.createConnection({
      institutionId,
      redirectUrl,
      referenceId: userId,
    });

    // Verbindung in DB speichern
    await this.prisma.bankConnection.create({
      data: {
        userId,
        provider: this.enableBanking.name,
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

  /** Callback nach Bank-Authentifizierung - Session erstellen und Konten importieren */
  async handleCallback(userId: string, connectionId: string, code?: string) {
    const connection = await this.prisma.bankConnection.findFirst({
      where: { userId, externalConnectionId: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Verbindung nicht gefunden');
    }

    if (!code) {
      throw new BadRequestException('Authorization-Code fehlt. Bitte erneut mit der Bank verbinden.');
    }

    // Enable Banking: Session mit dem Authorization-Code erstellen
    const session = await this.enableBanking.createSession(code);

    // Session-ID in der Verbindung speichern (verschlüsselt)
    await this.prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        status: 'LINKED',
        sessionId: encrypt(session.sessionId),
      },
    });

    // Konten importieren
    const importedAccounts = [];

    for (const ext of session.accounts) {
      // Prüfen ob Konto schon existiert
      const existing = await this.prisma.bankAccount.findFirst({
        where: { userId, externalId: ext.id },
      });

      if (existing) {
        importedAccounts.push(existing);
        continue;
      }

      // Kontostand abrufen – bei Fehler: Konto trotzdem mit balance=null markieren
      // (statt 0, was eine valide Bilanz vortäuschen würde)
      let balance: number | null = null;
      try {
        const balanceData = await this.enableBanking.getBalances(ext.id);
        balance = balanceData.current;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Initialer Kontostand für ${ext.id} nicht abrufbar: ${reason}`);
        await this.notifications
          .create({
            userId,
            type: 'SYNC_ERROR',
            title: `Kontostand nicht verfügbar: ${ext.name ?? ext.iban ?? 'Konto'}`,
            message: `Beim Import konnte der Kontostand nicht abgerufen werden (${reason}). Bitte später manuell synchronisieren.`,
            dedupeKey: `balance-init-${ext.id}`,
            data: { externalId: ext.id, error: reason },
          })
          .catch((err: unknown) => {
            this.logger.warn(`Import-Benachrichtigung fehlgeschlagen: ${err}`);
          });
      }

      // Konto anlegen
      const account = await this.prisma.bankAccount.create({
        data: {
          userId,
          bankName: ext.ownerName || ext.name || 'Bank',
          accountName: ext.product || ext.name || 'Konto',
          iban: ext.iban,
          accountType: this.guessAccountType(ext.product),
          balance: balance ?? 0,
          currency: ext.currency,
          externalId: ext.id,
          lastSynced: balance !== null ? new Date() : null,
        },
      });

      importedAccounts.push(account);
    }

    // Direkt erste Synchronisation starten
    for (const acc of importedAccounts) {
      if (acc.externalId) {
        await this.syncAccount(userId, acc.id).catch((error: unknown) =>
          this.logger.warn(`Erster Sync für ${acc.id} fehlgeschlagen: ${error}`),
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

    // Kontostand abrufen (außerhalb der Transaktion – externer Call)
    let newBalance: number | null = null;
    try {
      const balance = await this.enableBanking.getBalances(account.externalId);
      newBalance = balance.current;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Kontostand-Sync für ${accountId} fehlgeschlagen: ${reason}`);
    }

    // Transaktionen abrufen (letzte 30 Tage als Standard)
    const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const transactions = await this.enableBanking.getTransactions(account.externalId, from);

    // Auto-Kategorisierung laden
    const categories = await this.prisma.category.findMany({
      where: { OR: [{ userId }, { isSystem: true }] },
    });

    // DB-Schreibvorgänge atomar: Balance + alle neuen Transaktionen in einer Transaction.
    // Verhindert Duplikate bei parallelen Syncs (Cron + manueller Aufruf) und macht
    // Teil-Schreibstände unmöglich.
    const result = await this.prisma.$transaction(async (tx) => {
      let newCount = 0;
      let updatedCount = 0;

      for (const txData of transactions) {
        const existing = await tx.transaction.findUnique({
          // externalId ist nur pro Konto eindeutig — verschiedene Banken
          // können identische IDs vergeben.
          where: { bankAccountId_externalId: { bankAccountId: accountId, externalId: txData.externalId } },
        });
        if (existing) {
          updatedCount++;
          continue;
        }

        const categoryId = this.autoMatchCategory(
          txData.purpose || '',
          txData.counterpartName || '',
          categories,
        );

        await tx.transaction.create({
          data: {
            bankAccountId: accountId,
            amount: txData.amount,
            currency: txData.currency,
            date: new Date(txData.date),
            valueDate: txData.bookingDate ? new Date(txData.bookingDate) : undefined,
            purpose: txData.purpose,
            counterpartName: txData.counterpartName,
            counterpartIban: txData.counterpartIban,
            type: txData.type,
            externalId: txData.externalId,
            categoryId,
          },
        });
        newCount++;
      }

      await tx.bankAccount.update({
        where: { id: accountId },
        data: {
          balance: newBalance ?? account.balance,
          lastSynced: new Date(),
        },
      });

      return { newCount, updatedCount };
    });

    return {
      newTransactions: result.newCount,
      existingTransactions: result.updatedCount,
      totalFetched: transactions.length,
      balanceUpdated: newBalance !== null,
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
      } catch (error: unknown) {
        this.logger.error(`Sync fehlgeschlagen für ${account.id}: ${error}`);
        results.push({ accountId: account.id, accountName: account.accountName, error: String(error) });
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

    // Begrenzte Parallelität: schneller als sequenziell, ohne die Banking-API
    // mit allen Konten gleichzeitig zu fluten.
    const CONCURRENCY = 5;
    for (let i = 0; i < accounts.length; i += CONCURRENCY) {
      const chunk = accounts.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (account) => {
          try {
            await this.syncAccount(account.userId, account.id);
            this.logger.log(`Sync erfolgreich: ${account.accountName} (${account.id})`);
          } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.error(`Auto-Sync fehlgeschlagen für ${account.id}: ${reason}`);
            const todayKey = new Date().toISOString().slice(0, 10);
            await this.notifications
              .create({
                userId: account.userId,
                type: 'SYNC_ERROR',
                title: `Bank-Sync fehlgeschlagen: ${account.bankName}`,
                message: `Konto "${account.accountName}" konnte nicht aktualisiert werden. ${reason}`,
                dedupeKey: `sync-error-${account.id}-${todayKey}`,
                data: { bankAccountId: account.id, error: reason },
              })
              .catch((err: unknown) => {
                this.logger.warn(`Sync-Fehler-Benachrichtigung fehlgeschlagen: ${err}`);
              });
          }
        }),
      );
    }

    this.logger.log(`Auto-Sync abgeschlossen: ${accounts.length} Konten verarbeitet`);
  }

  // --- Hilfsmethoden ---

  private guessAccountType(product?: string): 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEPOT' | 'OTHER' {
    if (!product) return 'CHECKING';
    const lower = product.toLowerCase();
    if (lower.includes('giro') || lower.includes('checking') || lower.includes('cacc')) return 'CHECKING';
    if (lower.includes('spar') || lower.includes('tagesgeld') || lower.includes('saving')) return 'SAVINGS';
    if (lower.includes('kredit') || lower.includes('credit')) return 'CREDIT_CARD';
    if (lower.includes('depot') || lower.includes('wertpapier')) return 'DEPOT';
    return 'CHECKING';
  }

  private autoMatchCategory(purpose: string, counterpartName: string, categories: Category[]): string | null {
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
