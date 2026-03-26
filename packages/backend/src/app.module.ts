import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { AccountsModule } from './accounts/accounts.module';
import { BudgetsModule } from './budgets/budgets.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BankingModule } from './banking/banking.module';
import { RecurringPaymentsModule } from './recurring-payments/recurring-payments.module';
import { SavingsGoalsModule } from './savings-goals/savings-goals.module';
import { ContractsModule } from './contracts/contracts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CategorizationRulesModule } from './categorization-rules/categorization-rules.module';
import { ReportsModule } from './reports/reports.module';
import { AssetsModule } from './assets/assets.module';
import { SharedExpensesModule } from './shared-expenses/shared-expenses.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { ImportModule } from './import/import.module';
import { PortfolioModule } from './portfolio/portfolio.module';

@Module({
  imports: [
    // Konfiguration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env' : '../../.env',
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Scheduled Tasks
    ScheduleModule.forRoot(),

    // Core Modules
    PrismaModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    AccountsModule,
    BudgetsModule,
    DashboardModule,
    BankingModule,
    RecurringPaymentsModule,
    SavingsGoalsModule,
    ContractsModule,
    NotificationsModule,
    CategorizationRulesModule,
    ReportsModule,
    AssetsModule,
    SharedExpensesModule,
    CashflowModule,
    ImportModule,
    PortfolioModule,
  ],
})
export class AppModule {}
