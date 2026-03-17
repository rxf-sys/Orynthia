import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get()
  async findAll(@Req() req: Request) {
    return this.accountsService.findAll((req.user as any).id);
  }

  @Get('balance')
  async getTotalBalance(@Req() req: Request) {
    return this.accountsService.getTotalBalance((req.user as any).id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateAccountDto) {
    return this.accountsService.create((req.user as any).id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update((req.user as any).id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.accountsService.remove((req.user as any).id, id);
  }
}
