import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, UpdateTransactionDto, TransactionFilterDto } from './dto/transaction.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Transaktion erstellen' })
  async create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Transaktionen auflisten (mit Filtern)' })
  async findAll(@Req() req: any, @Query() filters: TransactionFilterDto) {
    return this.transactionsService.findAll(req.user.id, filters);
  }

  @Get('expenses-by-category')
  @ApiOperation({ summary: 'Ausgaben nach Kategorie' })
  async getExpensesByCategory(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    return this.transactionsService.getExpensesByCategory(req.user.id, start, end);
  }

  @Get('monthly-overview')
  @ApiOperation({ summary: 'Monatliche Einnahmen/Ausgaben Übersicht' })
  async getMonthlyOverview(@Req() req: any, @Query('months') months?: number) {
    return this.transactionsService.getMonthlyOverview(req.user.id, months || 6);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne Transaktion' })
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.transactionsService.findById(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Transaktion aktualisieren' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Transaktion löschen' })
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.transactionsService.remove(req.user.id, id);
  }
}
