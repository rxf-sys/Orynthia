import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
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

const BASE_URL = 'https://api.enablebanking.com';

@Injectable()
export class EnableBankingProvider implements BankingProvider {
  readonly name = 'enablebanking';
  private readonly logger = new Logger(EnableBankingProvider.name);

  constructor(private config: ConfigService) {}

  /** JWT mit RS256 generieren */
  private generateJwt(): string {
    const applicationId = this.config.get('ENABLE_BANKING_APP_ID');
    const privateKeyPem = this.config.get('ENABLE_BANKING_PRIVATE_KEY');

    if (!applicationId || !privateKeyPem) {
      throw new Error(
        'Enable Banking nicht konfiguriert. Bitte ENABLE_BANKING_APP_ID und ENABLE_BANKING_PRIVATE_KEY setzen.',
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // JWT Header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: applicationId,
    };

    // JWT Payload
    const payload = {
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: now,
      exp: now + 3600, // 1 Stunde gültig
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Newlines in private key normalisieren (falls aus .env als einzeilig)
    const normalizedKey = privateKeyPem.replace(/\\n/g, '\n');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(normalizedKey, 'base64url');

    return `${signingInput}.${signature}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const jwt = this.generateJwt();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`API-Fehler ${method} ${path}: ${res.status} - ${error}`);
      throw new Error(`Enable Banking API-Fehler: ${res.status}`);
    }

    return res.json();
  }

  async getInstitutions(countryCode: string): Promise<Institution[]> {
    const data = await this.request<any[]>('GET', `/aspsps?country=${countryCode}`);
    return data.map((aspsp) => ({
      // Enable Banking identifiziert Banken über name+country Kombination
      id: `${aspsp.name}:::${aspsp.country}`,
      name: aspsp.name,
      bic: aspsp.bic,
      logo: aspsp.logo,
      countries: [aspsp.country],
    }));
  }

  async createConnection(params: CreateConnectionParams): Promise<ConnectionResult> {
    // institutionId = "Bankname:::Country" (aus getInstitutions)
    const [bankName, country] = params.institutionId.split(':::');

    const authResponse = await this.request<any>('POST', '/auth', {
      access: {
        valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      aspsp: {
        name: bankName,
        country: country || 'DE',
      },
      state: params.referenceId,
      redirect_url: params.redirectUrl,
      psu_type: 'personal',
    });

    return {
      connectionId: authResponse.authorization_id,
      authUrl: authResponse.url,
    };
  }

  async getConnectionStatus(connectionId: string): Promise<ConnectionStatus> {
    // Bei Enable Banking gibt es keinen direkten Status-Endpunkt für Autorisierungen
    // Der Status wird über die Session bestimmt
    return {
      id: connectionId,
      status: 'CREATED',
      accountIds: [],
    };
  }

  /** Session erstellen mit dem Code aus dem Callback */
  async createSession(code: string): Promise<{ sessionId: string; accounts: ExternalAccount[] }> {
    const data = await this.request<any>('POST', '/sessions', { code });

    const accounts: ExternalAccount[] = (data.accounts || []).map((acc: any) => ({
      id: acc.uid,
      iban: acc.account_id?.iban,
      name: acc.name || acc.details,
      ownerName: acc.name,
      currency: acc.currency || 'EUR',
      product: acc.details || acc.cash_account_type,
    }));

    return {
      sessionId: data.session_id,
      accounts,
    };
  }

  async getAccounts(connectionId: string): Promise<ExternalAccount[]> {
    // Bei Enable Banking werden Konten direkt beim Session-Erstellen zurückgegeben
    // Diese Methode ist ein Fallback - normalerweise wird createSession verwendet
    throw new Error('Verwende createSession() mit dem Authorization-Code statt getAccounts()');
  }

  async getBalances(externalAccountId: string): Promise<AccountBalance> {
    const data = await this.request<any>('GET', `/accounts/${externalAccountId}/balances`);
    const balances = data.balances || [];

    // Bevorzuge CLBD (Closing Booked Balance) oder ersten verfügbaren
    const closingBooked = balances.find((b: any) => b.balance_type === 'CLBD');
    const interimAvailable = balances.find((b: any) => b.balance_type === 'ITAV');
    const primary = closingBooked || interimAvailable || balances[0];

    if (!primary) {
      return { current: 0, currency: 'EUR' };
    }

    return {
      available: interimAvailable ? Number(interimAvailable.balance_amount.amount) : undefined,
      current: Number(primary.balance_amount.amount),
      currency: primary.balance_amount.currency || 'EUR',
    };
  }

  async getTransactions(
    externalAccountId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<ExternalTransaction[]> {
    const allTransactions: ExternalTransaction[] = [];
    let continuationKey: string | undefined;

    // Pagination über continuation_key
    do {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (continuationKey) params.set('continuation_key', continuationKey);

      const query = params.toString();
      const path = `/accounts/${externalAccountId}/transactions${query ? '?' + query : ''}`;

      const data = await this.request<any>('GET', path);
      continuationKey = data.continuation_key;

      const transactions = data.transactions || [];
      for (const tx of transactions) {
        const amount = Number(tx.transaction_amount?.amount || 0);
        const isCredit = tx.credit_debit_indicator === 'CRDT';

        allTransactions.push({
          externalId:
            tx.entry_reference ||
            `${tx.booking_date}-${amount}-${(tx.remittance_information || []).join('').slice(0, 20)}`,
          amount: isCredit ? Math.abs(amount) : -Math.abs(amount),
          currency: tx.transaction_amount?.currency || 'EUR',
          date: tx.booking_date || tx.transaction_date || tx.value_date,
          bookingDate: tx.booking_date,
          purpose: (tx.remittance_information || []).join(' ') || undefined,
          counterpartName: isCredit ? tx.debtor?.name : tx.creditor?.name,
          counterpartIban: isCredit
            ? tx.debtor_account?.iban
            : tx.creditor_account?.iban,
          type: isCredit ? 'INCOME' : 'EXPENSE',
        });
      }
    } while (continuationKey);

    return allTransactions;
  }
}
