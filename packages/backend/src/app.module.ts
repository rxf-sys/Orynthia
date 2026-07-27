import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './platform/config/env.validation';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './platform/prisma/prisma.module';
import { MailModule } from './platform/mail/mail.module';
import { AuthModule } from './platform/auth/auth.module';
import { UsersModule } from './platform/users/users.module';
import { TransactionsModule } from './modules/finance/transactions/transactions.module';
import { CategoriesModule } from './modules/finance/categories/categories.module';
import { AccountsModule } from './modules/finance/accounts/accounts.module';
import { BudgetsModule } from './modules/finance/budgets/budgets.module';
import { DashboardModule } from './modules/finance/dashboard/dashboard.module';
import { BankingModule } from './modules/finance/banking/banking.module';
import { RecurringPaymentsModule } from './modules/finance/recurring-payments/recurring-payments.module';
import { SavingsGoalsModule } from './modules/finance/savings-goals/savings-goals.module';
import { ContractsModule } from './modules/finance/contracts/contracts.module';
import { NotificationsModule } from './platform/notifications/notifications.module';
import { ChatModule } from './assistant/chat/chat.module';
import { InvestmentsModule } from './modules/finance/investments/investments.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { ListsModule } from './modules/lists/lists.module';
import { NotesModule } from './modules/notes/notes.module';
import { TripsModule } from './modules/trips/trips.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HabitsModule } from './modules/habits/habits.module';
import { SearchModule } from './search/search.module';
import { DemoSeedModule } from './demo-seed/demo-seed.module';
import { HealthModule } from './platform/health/health.module';

@Module({
  imports: [
    // Konfiguration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env' : '../../.env',
      validate: validateEnv,
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
    MailModule,
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
    ChatModule,
    InvestmentsModule,
    TasksModule,
    CalendarModule,
    RecipesModule,
    ListsModule,
    NotesModule,
    TripsModule,
    DocumentsModule,
    HabitsModule,
    SearchModule,
    DemoSeedModule,
    HealthModule,
  ],
})
export class AppModule {}
