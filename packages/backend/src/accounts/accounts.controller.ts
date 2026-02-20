import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountsService } from './accounts.service';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.accountsService.findAll(req.user.id);
  }

  @Get('balance')
  async getTotalBalance(@Req() req: any) {
    return this.accountsService.getTotalBalance(req.user.id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.accountsService.create(req.user.id, body);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.accountsService.update(req.user.id, id, body);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.accountsService.remove(req.user.id, id);
  }
}
