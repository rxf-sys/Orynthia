import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BankingService } from './banking.service';
import { ConnectBankDto, SyncAccountDto, BankCallbackDto } from './dto/banking.dto';

@ApiTags('Banking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('banking')
export class BankingController {
  constructor(private bankingService: BankingService) {}

  @Get('institutions')
  @ApiOperation({ summary: 'Verfügbare Banken auflisten' })
  @ApiQuery({ name: 'country', required: false, example: 'DE' })
  async getInstitutions(@Query('country') country?: string) {
    return this.bankingService.getInstitutions(country || 'DE');
  }

  @Post('connect')
  @ApiOperation({ summary: 'Bank-Verbindung starten' })
  async connectBank(@Req() req: Request, @Body() dto: ConnectBankDto) {
    return this.bankingService.connectBank((req.user as any).id, dto.institutionId);
  }

  @Post('callback/:connectionId')
  @ApiOperation({ summary: 'Bank-Verbindung abschließen und Konten importieren' })
  async handleCallback(
    @Req() req: Request,
    @Param('connectionId') connectionId: string,
    @Body() dto: BankCallbackDto,
  ) {
    return this.bankingService.handleCallback((req.user as any).id, connectionId, dto.code);
  }

  @Post('sync/:accountId')
  @ApiOperation({ summary: 'Einzelnes Konto synchronisieren' })
  async syncAccount(@Req() req: Request, @Param('accountId') accountId: string, @Body() dto: SyncAccountDto) {
    return this.bankingService.syncAccount((req.user as any).id, accountId, dto.dateFrom);
  }

  @Post('sync-all')
  @ApiOperation({ summary: 'Alle verbundenen Konten synchronisieren' })
  async syncAllAccounts(@Req() req: Request) {
    return this.bankingService.syncAllAccounts((req.user as any).id);
  }

  @Get('connections')
  @ApiOperation({ summary: 'Aktive Bank-Verbindungen auflisten' })
  async getConnections(@Req() req: Request) {
    return this.bankingService.getConnections((req.user as any).id);
  }

  @Delete('connections/:connectionId')
  @ApiOperation({ summary: 'Bank-Verbindung entfernen' })
  async removeConnection(@Req() req: Request, @Param('connectionId') connectionId: string) {
    return this.bankingService.removeConnection((req.user as any).id, connectionId);
  }
}
