import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto, UpdateRuleDto, SplitTransactionDto } from './dto/categorization-rule.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CategorizationRulesService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string) {
    return this.prisma.categorizationRule.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { priority: 'desc' },
    });
  }

  async create(userId: string, dto: CreateRuleDto) {
    return this.prisma.categorizationRule.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        field: dto.field,
        operator: dto.operator,
        value: dto.value,
        priority: dto.priority ?? 0,
      },
      include: { category: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateRuleDto) {
    const rule = await this.prisma.categorizationRule.findFirst({
      where: { id, userId },
    });
    if (!rule) throw new NotFoundException('Regel nicht gefunden');

    return this.prisma.categorizationRule.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.field !== undefined && { field: dto.field }),
        ...(dto.operator !== undefined && { operator: dto.operator }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    const rule = await this.prisma.categorizationRule.findFirst({
      where: { id, userId },
    });
    if (!rule) throw new NotFoundException('Regel nicht gefunden');

    await this.prisma.categorizationRule.delete({ where: { id } });
    return { message: 'Regel gelöscht' };
  }

  async applyRules(userId: string, transaction: any): Promise<string | null> {
    const rules = await this.prisma.categorizationRule.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      if (this.evaluateRule(rule, transaction)) {
        await this.prisma.categorizationRule.update({
          where: { id: rule.id },
          data: { appliedCount: { increment: 1 } },
        });
        return rule.categoryId;
      }
    }

    return null;
  }

  async applyRulesToTransaction(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: { select: { userId: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaktion nicht gefunden');
    if (transaction.bankAccount.userId !== userId) throw new ForbiddenException();

    const categoryId = await this.applyRules(userId, transaction);

    if (categoryId) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { categoryId },
      });
    }

    return { categoryId, applied: categoryId !== null };
  }

  async learnFromCorrection(userId: string, transactionId: string, newCategoryId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: { select: { userId: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaktion nicht gefunden');
    if (transaction.bankAccount.userId !== userId) throw new ForbiddenException();

    // Update the transaction category
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId: newCategoryId },
    });

    // Auto-create a CONTAINS rule from counterpartName if it exists
    if (transaction.counterpartName) {
      // Check if a similar rule already exists
      const existingRule = await this.prisma.categorizationRule.findFirst({
        where: {
          userId,
          categoryId: newCategoryId,
          field: 'COUNTERPART_NAME',
          operator: 'CONTAINS',
          value: transaction.counterpartName,
        },
      });

      if (!existingRule) {
        return this.prisma.categorizationRule.create({
          data: {
            userId,
            categoryId: newCategoryId,
            field: 'COUNTERPART_NAME',
            operator: 'CONTAINS',
            value: transaction.counterpartName,
            priority: 0,
          },
          include: { category: true },
        });
      }

      return existingRule;
    }

    return { message: 'Kategorie aktualisiert, keine Regel erstellt (kein Gegenpartei-Name)' };
  }

  async splitTransaction(userId: string, dto: SplitTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { bankAccount: { select: { userId: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaktion nicht gefunden');
    if (transaction.bankAccount.userId !== userId) throw new ForbiddenException();

    // Validate that split amounts sum to transaction amount
    const transactionAmount = Math.abs(Number(transaction.amount));
    const splitSum = dto.splits.reduce((sum, s) => sum + s.amount, 0);
    const tolerance = 0.01;

    if (Math.abs(splitSum - transactionAmount) > tolerance) {
      throw new BadRequestException(
        `Summe der Splits (${splitSum.toFixed(2)}) stimmt nicht mit dem Transaktionsbetrag (${transactionAmount.toFixed(2)}) überein`,
      );
    }

    // Delete existing splits for this transaction
    await this.prisma.transactionSplit.deleteMany({
      where: { transactionId: dto.transactionId },
    });

    // Create new splits
    const splits = await Promise.all(
      dto.splits.map((split) =>
        this.prisma.transactionSplit.create({
          data: {
            transactionId: dto.transactionId,
            categoryId: split.categoryId,
            amount: new Decimal(split.amount),
            note: split.note,
          },
          include: { category: true },
        }),
      ),
    );

    return splits;
  }

  async getSplits(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: { select: { userId: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaktion nicht gefunden');
    if (transaction.bankAccount.userId !== userId) throw new ForbiddenException();

    return this.prisma.transactionSplit.findMany({
      where: { transactionId },
      include: { category: true },
    });
  }

  // --- Private Helpers ---

  private evaluateRule(rule: { field: string; operator: string; value: string }, transaction: any): boolean {
    let fieldValue: string | number | undefined;

    switch (rule.field) {
      case 'COUNTERPART_NAME':
        fieldValue = transaction.counterpartName;
        break;
      case 'COUNTERPART_IBAN':
        fieldValue = transaction.counterpartIban;
        break;
      case 'PURPOSE':
        fieldValue = transaction.purpose;
        break;
      case 'AMOUNT_MIN':
      case 'AMOUNT_MAX':
        fieldValue = Math.abs(Number(transaction.amount));
        break;
      default:
        return false;
    }

    if (fieldValue === undefined || fieldValue === null) return false;

    // For amount fields, compare numerically
    if (rule.field === 'AMOUNT_MIN' || rule.field === 'AMOUNT_MAX') {
      const numValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
      const ruleValue = parseFloat(rule.value);
      if (isNaN(numValue) || isNaN(ruleValue)) return false;

      switch (rule.operator) {
        case 'GREATER_THAN':
          return numValue > ruleValue;
        case 'LESS_THAN':
          return numValue < ruleValue;
        case 'EQUALS':
          return Math.abs(numValue - ruleValue) < 0.01;
        default:
          return false;
      }
    }

    // For string fields
    const strValue = String(fieldValue).toLowerCase();
    const ruleValue = rule.value.toLowerCase();

    switch (rule.operator) {
      case 'EQUALS':
        return strValue === ruleValue;
      case 'CONTAINS':
        return strValue.includes(ruleValue);
      case 'STARTS_WITH':
        return strValue.startsWith(ruleValue);
      case 'ENDS_WITH':
        return strValue.endsWith(ruleValue);
      case 'REGEX':
        try {
          return new RegExp(rule.value, 'i').test(String(fieldValue));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}
