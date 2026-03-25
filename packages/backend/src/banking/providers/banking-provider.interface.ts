// Banking Provider Interface - Abstraktion für verschiedene Banking-APIs
// Implementierungen: GoCardless (Nordigen), finAPI, etc.

export interface BankingProvider {
  /** Name des Providers */
  readonly name: string;

  /** Verfügbare Banken/Institutionen für ein Land abrufen */
  getInstitutions(countryCode: string): Promise<Institution[]>;

  /** Bank-Verbindung initiieren - gibt eine Redirect-URL zurück */
  createConnection(params: CreateConnectionParams): Promise<ConnectionResult>;

  /** Status einer Verbindung prüfen */
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>;

  /** Konten einer Verbindung abrufen */
  getAccounts(connectionId: string): Promise<ExternalAccount[]>;

  /** Kontostand abrufen */
  getBalances(externalAccountId: string): Promise<AccountBalance>;

  /** Transaktionen abrufen */
  getTransactions(externalAccountId: string, dateFrom?: string, dateTo?: string): Promise<ExternalTransaction[]>;
}

export interface Institution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  countries: string[];
}

export interface CreateConnectionParams {
  institutionId: string;
  redirectUrl: string;
  referenceId: string; // userId
}

export interface ConnectionResult {
  connectionId: string;
  authUrl: string; // URL zur Bank-Authentifizierung
}

export interface ConnectionStatus {
  id: string;
  status: 'CREATED' | 'GIVING_CONSENT' | 'UNDERGOING_AUTHENTICATION' | 'LINKED' | 'EXPIRED' | 'REJECTED' | 'SUSPENDED';
  accountIds: string[];
}

export interface ExternalAccount {
  id: string;
  iban?: string;
  name?: string;
  ownerName?: string;
  currency: string;
  product?: string; // z.B. "Girokonto", "Tagesgeld"
}

export interface AccountBalance {
  available?: number;
  current: number;
  currency: string;
}

export interface ExternalTransaction {
  externalId: string;
  amount: number;
  currency: string;
  date: string;
  bookingDate?: string;
  purpose?: string;
  counterpartName?: string;
  counterpartIban?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'OTHER';
}
