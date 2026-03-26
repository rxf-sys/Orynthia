import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedTransaction {
  date: Date;
  amount: number;
  purpose?: string;
  counterpartName?: string;
  counterpartIban?: string;
  currency: string;
  type: 'INCOME' | 'EXPENSE';
}

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  async importCsv(
    userId: string,
    bankAccountId: string,
    csvContent: string,
    options: { dateFormat?: string; delimiter?: string } = {},
  ) {
    // Verify account belongs to user
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
    });
    if (!account) throw new BadRequestException('Konto nicht gefunden');

    const delimiter = options.delimiter || ';';
    const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());

    if (lines.length < 2) {
      throw new BadRequestException('CSV muss mindestens eine Kopfzeile und eine Datenzeile haben');
    }

    const header = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const transactions: ParsedTransaction[] = [];

    // Auto-detect column mapping
    const colMap = this.detectColumns(header);

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i], delimiter);
      if (cols.length < 2) continue;

      try {
        const dateStr = cols[colMap.date]?.replace(/"/g, '').trim();
        const amountStr = cols[colMap.amount]?.replace(/"/g, '').trim();

        if (!dateStr || !amountStr) continue;

        const date = this.parseDate(dateStr, options.dateFormat);
        const amount = this.parseAmount(amountStr);

        const tx: ParsedTransaction = {
          date,
          amount,
          purpose: colMap.purpose !== -1 ? cols[colMap.purpose]?.replace(/"/g, '').trim() : undefined,
          counterpartName: colMap.counterpartName !== -1 ? cols[colMap.counterpartName]?.replace(/"/g, '').trim() : undefined,
          counterpartIban: colMap.counterpartIban !== -1 ? cols[colMap.counterpartIban]?.replace(/"/g, '').trim() : undefined,
          currency: account.currency,
          type: amount >= 0 ? 'INCOME' : 'EXPENSE',
        };
        transactions.push(tx);
      } catch {
        // Skip unparseable rows
      }
    }

    if (transactions.length === 0) {
      throw new BadRequestException('Keine Transaktionen in der CSV-Datei gefunden');
    }

    // Bulk create
    const result = await this.prisma.transaction.createMany({
      data: transactions.map((tx) => ({
        bankAccountId,
        amount: tx.amount,
        currency: tx.currency,
        date: tx.date,
        purpose: tx.purpose || null,
        counterpartName: tx.counterpartName || null,
        counterpartIban: tx.counterpartIban || null,
        type: tx.type,
      })),
      skipDuplicates: true,
    });

    return {
      imported: result.count,
      total: transactions.length,
      skipped: transactions.length - result.count,
    };
  }

  async importMt940(userId: string, bankAccountId: string, mt940Content: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
    });
    if (!account) throw new BadRequestException('Konto nicht gefunden');

    const transactions: ParsedTransaction[] = [];
    const lines = mt940Content.split('\n');

    let currentDate: Date | null = null;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // :60F: or :60M: - Opening balance (contains date)
      if (line.startsWith(':60F:') || line.startsWith(':60M:')) {
        // Format: :60F:C260325EUR1234,56 -> date is YYMMDD at positions 5-11
        const balStr = line.substring(5);
        if (balStr.length >= 10) {
          const dateStr = balStr.substring(1, 7); // YYMMDD
          const year = 2000 + parseInt(dateStr.substring(0, 2));
          const month = parseInt(dateStr.substring(2, 4)) - 1;
          const day = parseInt(dateStr.substring(4, 6));
          currentDate = new Date(year, month, day);
        }
      }

      // :61: - Transaction line
      if (line.startsWith(':61:')) {
        const txLine = line.substring(4);
        // Format: YYMMDD[MMDD]C/DamountN... e.g., 2603250326C1234,56NTRFNONREF
        const dateStr = txLine.substring(0, 6);
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4)) - 1;
        const day = parseInt(dateStr.substring(4, 6));
        const date = new Date(year, month, day);

        // Find C (credit) or D (debit)
        let offset = 6;
        if (txLine.length > 10 && /^\d{4}/.test(txLine.substring(6))) {
          offset = 10; // Optional booking date MMDD
        }

        const isCredit = txLine[offset] === 'C';
        offset += 1;
        if (txLine[offset] === 'R') offset += 1; // Reversal indicator

        // Parse amount (digits and comma until N)
        const amountMatch = txLine.substring(offset).match(/^([\d,]+)/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(',', '.'));
          const finalAmount = isCredit ? amount : -amount;

          // :86: - Purpose (next or following line)
          let purpose = '';
          let counterpartName = '';
          let j = i + 1;
          while (j < lines.length && !lines[j].trim().startsWith(':6')) {
            const nextLine = lines[j].trim();
            if (nextLine.startsWith(':86:')) {
              purpose = nextLine.substring(4);
            } else if (purpose && !nextLine.startsWith(':')) {
              purpose += ' ' + nextLine;
            }
            j++;
          }

          // Extract counterpart from purpose (common pattern: /NAME+counterpart)
          const nameMatch = purpose.match(/\/NAME\+([^/]+)/);
          if (nameMatch) counterpartName = nameMatch[1].trim();

          transactions.push({
            date,
            amount: finalAmount,
            purpose: purpose || undefined,
            counterpartName: counterpartName || undefined,
            currency: account.currency,
            type: isCredit ? 'INCOME' : 'EXPENSE',
          });
        }
      }
      i++;
    }

    if (transactions.length === 0) {
      throw new BadRequestException('Keine Transaktionen im MT940-Format gefunden');
    }

    const result = await this.prisma.transaction.createMany({
      data: transactions.map((tx) => ({
        bankAccountId,
        amount: tx.amount,
        currency: tx.currency,
        date: tx.date,
        purpose: tx.purpose || null,
        counterpartName: tx.counterpartName || null,
        type: tx.type,
      })),
      skipDuplicates: true,
    });

    return {
      imported: result.count,
      total: transactions.length,
      skipped: transactions.length - result.count,
    };
  }

  private detectColumns(header: string[]): {
    date: number; amount: number; purpose: number;
    counterpartName: number; counterpartIban: number;
  } {
    const dateKeywords = ['datum', 'date', 'buchungstag', 'valuta', 'buchungsdatum'];
    const amountKeywords = ['betrag', 'amount', 'umsatz', 'soll/haben'];
    const purposeKeywords = ['verwendungszweck', 'purpose', 'buchungstext', 'text', 'beschreibung'];
    const nameKeywords = ['empfänger', 'auftraggeber', 'name', 'beguenstigter', 'counterpart', 'gegenkonto name'];
    const ibanKeywords = ['iban', 'kontonummer', 'gegenkonto'];

    const findCol = (keywords: string[]) =>
      header.findIndex((h) => keywords.some((k) => h.includes(k)));

    const dateCol = findCol(dateKeywords);
    const amountCol = findCol(amountKeywords);

    if (dateCol === -1 || amountCol === -1) {
      throw new BadRequestException(
        'Konnte Datum- und Betrag-Spalten nicht erkennen. Erwartete Spalten: Datum, Betrag',
      );
    }

    return {
      date: dateCol,
      amount: amountCol,
      purpose: findCol(purposeKeywords),
      counterpartName: findCol(nameKeywords),
      counterpartIban: findCol(ibanKeywords),
    };
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private parseDate(dateStr: string, format?: string): Date {
    // Try DD.MM.YYYY (German default)
    const deMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (deMatch) {
      const year = deMatch[3].length === 2 ? 2000 + parseInt(deMatch[3]) : parseInt(deMatch[3]);
      return new Date(year, parseInt(deMatch[2]) - 1, parseInt(deMatch[1]));
    }

    // Try YYYY-MM-DD (ISO)
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    // Try MM/DD/YYYY (US)
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      return new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    }

    throw new Error(`Unbekanntes Datumsformat: ${dateStr}`);
  }

  private parseAmount(amountStr: string): number {
    // Remove currency symbols and whitespace
    let cleaned = amountStr.replace(/[€$£\s]/g, '');

    // German format: 1.234,56 -> 1234.56
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }

    const num = parseFloat(cleaned);
    if (isNaN(num)) throw new Error(`Ungültiger Betrag: ${amountStr}`);
    return num;
  }
}
