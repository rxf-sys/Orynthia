import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CashflowService } from './cashflow.service';

@Controller('cashflow')
@UseGuards(AuthGuard('jwt'))
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @Get('forecast')
  getForecast(@Req() req: Request, @Query('months') months?: number) {
    return this.cashflowService.getForecast((req.user as any).id, months || 3);
  }
}
