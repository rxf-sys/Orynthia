import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SavingsGoalsService } from './savings-goals.service';
import { CreateSavingsGoalDto, UpdateSavingsGoalDto, AddAmountDto } from './dto/savings-goal.dto';

@ApiTags('Savings Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('savings-goals')
export class SavingsGoalsController {
  constructor(private service: SavingsGoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Sparziel erstellen' })
  async create(@Req() req: Request, @Body() dto: CreateSavingsGoalDto) {
    return this.service.create((req.user as any).id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Alle Sparziele auflisten' })
  async findAll(@Req() req: Request) {
    return this.service.findAll((req.user as any).id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sparziel aktualisieren' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSavingsGoalDto) {
    return this.service.update((req.user as any).id, id, dto);
  }

  @Post(':id/add')
  @ApiOperation({ summary: 'Betrag zum Sparziel hinzufügen/abheben' })
  async addAmount(@Req() req: Request, @Param('id') id: string, @Body() dto: AddAmountDto) {
    return this.service.addAmount((req.user as any).id, id, dto.amount);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Sparziel löschen' })
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.service.remove((req.user as any).id, id);
  }
}
