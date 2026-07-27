import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto, UpdateRecipeDto } from './dto/recipe.dto';

@ApiTags('Recipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('mealType') mealType?: string,
    @Query('dietary') dietary?: string,
    @Query('difficulty') difficulty?: string,
    @Query('favorite') favorite?: string,
    @Query('maxTotalMinutes') maxTotalMinutes?: string,
  ) {
    return this.recipesService.findAll(req.user!.id, {
      search,
      mealType,
      dietary,
      difficulty,
      favorite: favorite === 'true',
      maxTotalMinutes: maxTotalMinutes ? parseInt(maxTotalMinutes, 10) || undefined : undefined,
    });
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    return this.recipesService.findOne(req.user!.id, id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateRecipeDto) {
    return this.recipesService.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(req.user!.id, id, dto);
  }

  @Post(':id/favorite')
  async toggleFavorite(@Req() req: Request, @Param('id') id: string) {
    return this.recipesService.toggleFavorite(req.user!.id, id);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.recipesService.remove(req.user!.id, id);
  }
}
