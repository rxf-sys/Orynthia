import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecurringPaymentsService } from './recurring-payments.service';
import { CreateRecurringPaymentDto, UpdateRecurringPaymentDto } from './dto/recurring-payment.dto';

@ApiTags('Recurring Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring-payments')
export class RecurringPaymentsController {
  constructor(private service: RecurringPaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Wiederkehrende Zahlung erstellen' })
  async create(@Req() req: Request, @Body() dto: CreateRecurringPaymentDto) {
    return this.service.create((req.user as any).id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Alle wiederkehrenden Zahlungen auflisten' })
  async findAll(@Req() req: Request) {
    return this.service.findAll((req.user as any).id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Wiederkehrende Zahlung aktualisieren' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateRecurringPaymentDto) {
    return this.service.update((req.user as any).id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Wiederkehrende Zahlung löschen' })
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.service.remove((req.user as any).id, id);
  }
}
