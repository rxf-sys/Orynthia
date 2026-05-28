import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { EnableBankingProvider } from './providers/enable-banking.provider';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BankingController],
  providers: [BankingService, EnableBankingProvider],
  exports: [BankingService],
})
export class BankingModule {}
