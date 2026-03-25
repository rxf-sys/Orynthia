import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankingProvider,
  Institution,
  CreateConnectionParams,
  ConnectionResult,
  ConnectionStatus,
  ExternalAccount,
  AccountBalance,
  ExternalTransaction,
} from './banking-provider.interface';

/**
 * finAPI Provider - Platzhalter für spätere Integration
 *
 * finAPI ist eine kostenpflichtige deutsche Banking-API.
 * Dokumentation: https://docs.finapi.io/
 *
 * Um finAPI zu nutzen:
 * 1. Account bei finAPI erstellen
 * 2. FINAPI_CLIENT_ID und FINAPI_CLIENT_SECRET in .env setzen
 * 3. Diese Klasse implementieren
 */
@Injectable()
export class FinApiProvider implements BankingProvider {
  readonly name = 'finapi';
  private readonly logger = new Logger(FinApiProvider.name);

  constructor(private config: ConfigService) {}

  async getInstitutions(_countryCode: string): Promise<Institution[]> {
    throw new Error('finAPI Provider ist noch nicht implementiert. Bitte GoCardless verwenden.');
  }

  async createConnection(_params: CreateConnectionParams): Promise<ConnectionResult> {
    throw new Error('finAPI Provider ist noch nicht implementiert.');
  }

  async getConnectionStatus(_connectionId: string): Promise<ConnectionStatus> {
    throw new Error('finAPI Provider ist noch nicht implementiert.');
  }

  async getAccounts(_connectionId: string): Promise<ExternalAccount[]> {
    throw new Error('finAPI Provider ist noch nicht implementiert.');
  }

  async getBalances(_externalAccountId: string): Promise<AccountBalance> {
    throw new Error('finAPI Provider ist noch nicht implementiert.');
  }

  async getTransactions(_externalAccountId: string, _dateFrom?: string, _dateTo?: string): Promise<ExternalTransaction[]> {
    throw new Error('finAPI Provider ist noch nicht implementiert.');
  }
}
