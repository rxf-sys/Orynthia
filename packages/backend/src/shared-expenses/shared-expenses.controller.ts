import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SharedExpensesService } from './shared-expenses.service';
import { CreateHouseholdDto, AddMemberDto, CreateSharedExpenseDto } from './dto/shared-expense.dto';

@Controller('shared-expenses')
@UseGuards(AuthGuard('jwt'))
export class SharedExpensesController {
  constructor(private readonly service: SharedExpensesService) {}

  @Get('households')
  getHouseholds(@Req() req: Request) {
    return this.service.getHouseholds((req.user as any).id);
  }

  @Post('households')
  createHousehold(@Req() req: Request, @Body() dto: CreateHouseholdDto) {
    return this.service.createHousehold((req.user as any).id, dto);
  }

  @Post('households/:id/members')
  addMember(@Req() req: Request, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.service.addMember((req.user as any).id, id, dto);
  }

  @Post()
  createExpense(@Req() req: Request, @Body() dto: CreateSharedExpenseDto) {
    return this.service.createExpense((req.user as any).id, dto);
  }

  @Get('balances/:householdId')
  getBalances(@Req() req: Request, @Param('householdId') householdId: string) {
    return this.service.getBalances((req.user as any).id, householdId);
  }

  @Post('settle/:shareId')
  settleShare(@Req() req: Request, @Param('shareId') shareId: string) {
    return this.service.settleShare((req.user as any).id, shareId);
  }

  @Delete(':id')
  removeExpense(@Req() req: Request, @Param('id') id: string) {
    return this.service.removeExpense((req.user as any).id, id);
  }
}
