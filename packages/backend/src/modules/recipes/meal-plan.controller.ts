import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { MealPlanService } from './meal-plan.service';
import {
  CreateMealPlanEntryDto,
  MealPlanToListDto,
  UpdateMealPlanEntryDto,
} from './dto/meal-plan.dto';

@ApiTags('Meal-Planner')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meal-plan')
export class MealPlanController {
  constructor(private mealPlan: MealPlanService) {}

  @Get()
  async findRange(@Req() req: Request, @Query('from') from: string, @Query('to') to: string) {
    return this.mealPlan.findRange(req.user!.id, from, to);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateMealPlanEntryDto) {
    return this.mealPlan.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateMealPlanEntryDto) {
    return this.mealPlan.update(req.user!.id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.mealPlan.remove(req.user!.id, id);
  }

  @Post('to-list')
  @ApiOperation({ summary: 'Zutaten aller geplanten Mahlzeiten eines Zeitraums in eine Liste' })
  async addRangeToList(@Req() req: Request, @Body() dto: MealPlanToListDto) {
    return this.mealPlan.addRangeToList(req.user!.id, dto);
  }
}
