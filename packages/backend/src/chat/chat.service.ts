import { Injectable, Logger, ServiceUnavailableException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT_STATIC = `Du bist Orynthia AI, ein hilfsbereiter Finanz-Assistent für persönliche Finanzverwaltung.

Deine Aufgaben:
- Beantworte Fragen zu Ausgaben, Einnahmen, Budgets, Konten, Verträgen, Sparzielen und wiederkehrenden Zahlungen anhand der bereitgestellten Nutzerdaten.
- Gib konkrete, datenbasierte Antworten. Beziehe dich auf Zahlen und Posten aus dem Kontext.
- Schlage Sparmaßnahmen vor, wenn es Sinn ergibt (z.B. Verträge über Marktdurchschnitt, ungenutzte Abos, Kategorien-Überzüge).
- Wenn eine Information nicht im Kontext steht, sag das ehrlich – erfinde keine Zahlen oder Konten.
- Sei sachlich und prägnant. Format: kurze Absätze, ggf. Stichpunkte. Beträge in Euro mit Tausenderpunkt.
- Schreibe immer auf Deutsch.

Du hast KEINEN Zugriff auf Echtzeit-Daten, externe Banken oder Web-APIs. Du arbeitest ausschließlich mit dem Kontext, den ich dir pro Anfrage mitliefere.

Antworte nicht auf Themen außerhalb persönlicher Finanzen – lenke dann freundlich zurück zum Finanz-Thema.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private client: Anthropic | null = null;
  private readonly model: string;
  // Kostenkontrolle: Tages-Token-Budget pro User (0 = unbegrenzt).
  private readonly dailyTokenLimit: number;
  private usageByUser = new Map<string, { day: string; tokens: number }>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.model = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-opus-4-8';
    this.dailyTokenLimit = Number(this.config.get('CHAT_DAILY_TOKEN_LIMIT') || 0);
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey && apiKey.trim().length > 0) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Anthropic-Client bereit (Modell: ' + this.model + ').');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY nicht gesetzt – KI-Assistent deaktiviert.');
    }
  }

  isEnabled() {
    return this.client !== null;
  }

  async sendMessage(userId: string, messages: ChatMessage[]) {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'KI-Assistent ist nicht konfiguriert. Bitte ANTHROPIC_API_KEY setzen.',
      );
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('Mindestens eine Nachricht erforderlich.');
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || !last.content?.trim()) {
      throw new BadRequestException('Die letzte Nachricht muss vom Typ "user" sein und Inhalt haben.');
    }

    this.assertWithinDailyBudget(userId);

    const context = await this.buildUserContext(userId);
    const apiMessages: Anthropic.MessageParam[] = messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT_STATIC,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `--- Nutzer-Kontext (Stand: ${new Date().toLocaleString('de-DE')}) ---\n${context}`,
          },
        ],
        messages: apiMessages,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
      });
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Anthropic-API-Fehler (user=${userId}): ${reason}`);
      throw new ServiceUnavailableException(
        'KI-Assistent ist gerade nicht erreichbar. Bitte später erneut versuchen.',
      );
    }

    this.trackUsage(userId, response.usage.input_tokens + response.usage.output_tokens);
    this.logger.log(
      `Chat-Usage user=${userId}: in=${response.usage.input_tokens} out=${response.usage.output_tokens} ` +
        `cacheRead=${response.usage.cache_read_input_tokens ?? 0} cacheWrite=${response.usage.cache_creation_input_tokens ?? 0}`,
    );

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return {
      role: 'assistant' as const,
      content: textBlock?.text ?? '',
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }

  private assertWithinDailyBudget(userId: string) {
    if (this.dailyTokenLimit <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.usageByUser.get(userId);
    if (entry && entry.day === today && entry.tokens >= this.dailyTokenLimit) {
      throw new HttpException(
        'Tageslimit für den KI-Assistenten erreicht. Bitte morgen erneut versuchen.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private trackUsage(userId: string, tokens: number) {
    if (this.dailyTokenLimit <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.usageByUser.get(userId);
    if (entry && entry.day === today) entry.tokens += tokens;
    else this.usageByUser.set(userId, { day: today, tokens });
  }

  /** Aggregiert eine kompakte Finanzübersicht des Users als Markdown. */
  private async buildUserContext(userId: string): Promise<string> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [accounts, budgets, recentTx, expensesAgg, recurring, contracts, savingsGoals] =
      await Promise.all([
        this.prisma.bankAccount.findMany({
          where: { userId, isActive: true },
          select: { bankName: true, accountName: true, accountType: true, balance: true },
          take: 20,
        }),
        this.prisma.budget.findMany({
          where: { userId, isActive: true },
          include: { category: { select: { name: true } } },
          take: 25,
        }),
        this.prisma.transaction.findMany({
          where: { bankAccount: { userId } },
          orderBy: { date: 'desc' },
          take: 15,
          select: {
            amount: true,
            date: true,
            counterpartName: true,
            purpose: true,
            category: { select: { name: true } },
          },
        }),
        this.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            bankAccount: { userId },
            amount: { lt: 0 },
            date: { gte: monthStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.recurringPayment.findMany({
          where: { userId, isActive: true },
          select: { name: true, amount: true, frequency: true, nextDueDate: true },
          take: 30,
        }),
        this.prisma.contract.findMany({
          where: { userId, isActive: true },
          select: { name: true, provider: true, monthlyCost: true, billingCycle: true },
          take: 30,
        }),
        this.prisma.savingsGoal.findMany({
          where: { userId, isCompleted: false },
          select: { name: true, targetAmount: true, currentAmount: true, deadline: true },
          take: 20,
        }),
      ]);

    const catIds = expensesAgg.map((e) => e.categoryId).filter(Boolean) as string[];
    const categories =
      catIds.length > 0
        ? await this.prisma.category.findMany({
            where: { id: { in: catIds } },
            select: { id: true, name: true },
          })
        : [];
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const sections: string[] = [];

    sections.push(`## Konten\nGesamtsaldo: ${fmt(totalBalance)} €`);
    if (accounts.length > 0) {
      sections.push(
        accounts
          .map(
            (a) =>
              `- ${a.bankName} ${a.accountName} (${a.accountType}): ${fmt(Number(a.balance))} €`,
          )
          .join('\n'),
      );
    } else {
      sections.push('Keine Konten erfasst.');
    }

    sections.push(`\n## Ausgaben dieser Monat (nach Kategorie)`);
    if (expensesAgg.length === 0) {
      sections.push('Noch keine Ausgaben in diesem Monat.');
    } else {
      const top = expensesAgg
        .map((e) => ({
          name: e.categoryId ? catMap.get(e.categoryId) ?? 'Unkategorisiert' : 'Unkategorisiert',
          amount: Math.abs(Number(e._sum.amount ?? 0)),
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
      sections.push(top.map((t) => `- ${t.name}: ${fmt(t.amount)} €`).join('\n'));
    }

    sections.push(`\n## Budgets (Monat)`);
    if (budgets.length === 0) {
      sections.push('Keine Budgets gesetzt.');
    } else {
      sections.push(
        budgets
          .map((b) => `- ${b.category.name}: ${fmt(Number(b.amount))} € / Monat`)
          .join('\n'),
      );
    }

    sections.push(`\n## Wiederkehrende Zahlungen`);
    if (recurring.length === 0) {
      sections.push('Keine wiederkehrenden Zahlungen erfasst.');
    } else {
      sections.push(
        recurring
          .map(
            (r) =>
              `- ${r.name}: ${fmt(Math.abs(Number(r.amount)))} € (${r.frequency})${
                r.nextDueDate ? `, nächste Buchung ${r.nextDueDate.toLocaleDateString('de-DE')}` : ''
              }`,
          )
          .join('\n'),
      );
    }

    sections.push(`\n## Verträge`);
    if (contracts.length === 0) {
      sections.push('Keine Verträge erfasst.');
    } else {
      sections.push(
        contracts
          .map(
            (c) =>
              `- ${c.name} (${c.provider}): ${fmt(Number(c.monthlyCost ?? 0))} € / Monat, Abrechnung ${c.billingCycle}`,
          )
          .join('\n'),
      );
    }

    sections.push(`\n## Sparziele`);
    if (savingsGoals.length === 0) {
      sections.push('Keine offenen Sparziele.');
    } else {
      sections.push(
        savingsGoals
          .map(
            (g) =>
              `- ${g.name}: ${fmt(Number(g.currentAmount))} € / ${fmt(Number(g.targetAmount))} €${
                g.deadline ? `, Frist ${g.deadline.toLocaleDateString('de-DE')}` : ''
              }`,
          )
          .join('\n'),
      );
    }

    sections.push(`\n## Letzte 15 Transaktionen`);
    if (recentTx.length === 0) {
      sections.push('Keine Transaktionen.');
    } else {
      sections.push(
        recentTx
          .map((t) => {
            const amt = Number(t.amount);
            const sign = amt >= 0 ? '+' : '';
            return `- ${t.date.toLocaleDateString('de-DE')}: ${sign}${fmt(amt)} € – ${
              t.counterpartName ?? t.purpose ?? 'unbekannt'
            } (${t.category?.name ?? 'Unkategorisiert'})`;
          })
          .join('\n'),
      );
    }

    return sections.join('\n');
  }
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
