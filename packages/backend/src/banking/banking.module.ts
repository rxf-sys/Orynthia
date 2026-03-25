import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { GoCardlessProvider } from './providers/gocardless.provider';
import { FinApiProvider } from './providers/finapi.provider';

@Module({
  controllers: [BankingController],
  providers: [BankingService, GoCardlessProvider, FinApiProvider],
  exports: [BankingService],
})
export class BankingModule {}
