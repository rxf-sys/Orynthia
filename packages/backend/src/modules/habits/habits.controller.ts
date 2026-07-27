import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { HabitsService } from './habits.service';
import { CreateHabitDto, ToggleHabitEntryDto, UpdateHabitDto } from './dto/habit.dto';

@ApiTags('Habits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private habitsService: HabitsService) {}

  @Get()
  async findAll(@Req() req: Request, @Query('includeArchived') includeArchived?: string) {
    return this.habitsService.findAll(req.user!.id, {
      includeArchived: includeArchived === 'true',
    });
  }

  @Get('summary')
  async summary(@Req() req: Request) {
    return this.habitsService.getSummary(req.user!.id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateHabitDto) {
    return this.habitsService.update(req.user!.id, id, dto);
  }

  @Post(':id/toggle')
  async toggle(@Req() req: Request, @Param('id') id: string, @Body() dto: ToggleHabitEntryDto) {
    return this.habitsService.toggleEntry(req.user!.id, id, dto?.date);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.habitsService.remove(req.user!.id, id);
  }
}
