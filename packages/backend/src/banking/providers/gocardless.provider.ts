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

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';

@Injectable()
export class GoCardlessProvider implements BankingProvider {
  readonly name = 'gocardless';
  private readonly logger = new Logger(GoCardlessProvider.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: ConfigService) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const secretId = this.config.get('GOCARDLESS_SECRET_ID');
    const secretKey = this.config.get('GOCARDLESS_SECRET_KEY');

    if (!secretId || !secretKey) {
      throw new Error('GoCardless API-Schlüssel nicht konfiguriert. Bitte GOCARDLESS_SECRET_ID und GOCARDLESS_SECRET_KEY setzen.');
    }

    const res = await fetch(`${BASE_URL}/token/new/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`Token-Fehler: ${error}`);
      throw new Error('GoCardless Authentifizierung fehlgeschlagen');
    }

    const data = await res.json();
    this.accessToken = data.access;
    // Token 29 Minuten cachen (läuft nach 30 Min ab)
    this.tokenExpiry = Date.now() + 29 * 60 * 1000;
    return this.accessToken!;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`API-Fehler ${method} ${path}: ${res.status} - ${error}`);
      throw new Error(`GoCardless API-Fehler: ${res.status}`);
    }

    return res.json();
  }

  async getInstitutions(countryCode: string): Promise<Institution[]> {
    const data = await this.request<any[]>('GET', `/institutions/?country=${countryCode}`);
    return data.map((inst) => ({
      id: inst.id,
      name: inst.name,
      bic: inst.bic,
      logo: inst.logo,
      countries: inst.countries,
    }));
  }

  async createConnection(params: CreateConnectionParams): Promise<ConnectionResult> {
    // 1. Endbenutzer-Vereinbarung erstellen (90 Tage Zugriff)
    const agreement = await this.request<any>('POST', '/agreements/enduser/', {
      institution_id: params.institutionId,
      max_historical_days: 365,
      access_valid_for_days: 90,
      access_scope: ['balances', 'details', 'transactions'],
    });

    // 2. Requisition (Bank-Link) erstellen
    const requisition = await this.request<any>('POST', '/requisitions/', {
      institution_id: params.institutionId,
      redirect: params.redirectUrl,
      reference: params.referenceId,
      agreement: agreement.id,
      user_language: 'DE',
    });

    return {
      connectionId: requisition.id,
      authUrl: requisition.link,
    };
  }

  async getConnectionStatus(connectionId: string): Promise<ConnectionStatus> {
    const data = await this.request<any>('GET', `/requisitions/${connectionId}/`);
    return {
      id: data.id,
      status: data.status?.toUpperCase() || 'CREATED',
      accountIds: data.accounts || [],
    };
  }

  async getAccounts(connectionId: string): Promise<ExternalAccount[]> {
    const status = await this.getConnectionStatus(connectionId);
    const accounts: ExternalAccount[] = [];

    for (const accountId of status.accountIds) {
      try {
        const details = await this.request<any>('GET', `/accounts/${accountId}/details/`);
        const acc = details.account || details;
        accounts.push({
          id: accountId,
          iban: acc.iban,
          name: acc.name || acc.product,
          ownerName: acc.ownerName,
          currency: acc.currency || 'EUR',
          product: acc.product,
        });
      } catch (e) {
        this.logger.warn(`Kontodetails für ${accountId} nicht abrufbar: ${e}`);
      }
    }

    return accounts;
  }

  async getBalances(externalAccountId: string): Promise<AccountBalance> {
    const data = await this.request<any>('GET', `/accounts/${externalAccountId}/balances/`);
    const balances = data.balances || [];

    // Bevorzuge "expected" (verfügbar) oder "interimAvailable", fallback auf ersten
    const available = balances.find((b: any) => b.balanceType === 'expected' || b.balanceType === 'interimAvailable');
    const current = balances.find((b: any) => b.balanceType === 'closingBooked' || b.balanceType === 'openingBooked');
    const primary = available || current || balances[0];

    if (!primary) {
      return { current: 0, currency: 'EUR' };
    }

    return {
      available: available ? Number(available.balanceAmount.amount) : undefined,
      current: Number((current || primary).balanceAmount.amount),
      currency: primary.balanceAmount.currency || 'EUR',
    };
  }

  async getTransactions(externalAccountId: string, dateFrom?: string, dateTo?: string): Promise<ExternalTransaction[]> {
    let path = `/accounts/${externalAccountId}/transactions/`;
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (params.toString()) path += `?${params.toString()}`;

    const data = await this.request<any>('GET', path);
    const booked = data.transactions?.booked || [];

    return booked.map((tx: any) => {
      const amount = Number(tx.transactionAmount?.amount || 0);
      return {
        externalId: tx.internalTransactionId || tx.transactionId || `${tx.bookingDate}-${amount}-${tx.remittanceInformationUnstructured?.slice(0, 20)}`,
        amount,
        currency: tx.transactionAmount?.currency || 'EUR',
        date: tx.bookingDate || tx.valueDate,
        bookingDate: tx.bookingDate,
        purpose: tx.remittanceInformationUnstructured || tx.remittanceInformationStructured || tx.additionalInformation,
        counterpartName: tx.creditorName || tx.debtorName,
        counterpartIban: tx.creditorAccount?.iban || tx.debtorAccount?.iban,
        type: amount > 0 ? 'INCOME' : 'EXPENSE',
      };
    });
  }
}
