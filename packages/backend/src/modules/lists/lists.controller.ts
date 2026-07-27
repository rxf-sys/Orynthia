import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { ListsService } from './lists.service';
import {
  AddFromRecipeDto,
  BulkItemsDto,
  CreateListDto,
  CreateListItemDto,
  ReorderItemsDto,
  UpdateListDto,
  UpdateListItemDto,
} from './dto/list.dto';

@ApiTags('Lists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListsController {
  constructor(private listsService: ListsService) {}

  @Get()
  async findAll(@Req() req: Request) {
    return this.listsService.findAll(req.user!.id);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    return this.listsService.findOne(req.user!.id, id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateListDto) {
    return this.listsService.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateListDto) {
    return this.listsService.update(req.user!.id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.listsService.remove(req.user!.id, id);
  }

  // ---------- Einträge ----------

  @Post(':id/items')
  async addItem(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateListItemDto) {
    return this.listsService.addItem(req.user!.id, id, dto);
  }

  @Post(':id/items/bulk')
  async addItems(@Req() req: Request, @Param('id') id: string, @Body() dto: BulkItemsDto) {
    return this.listsService.addItems(req.user!.id, id, dto);
  }

  @Post(':id/from-recipe')
  async addFromRecipe(@Req() req: Request, @Param('id') id: string, @Body() dto: AddFromRecipeDto) {
    return this.listsService.addFromRecipe(req.user!.id, id, dto);
  }

  @Post(':id/reorder')
  async reorder(@Req() req: Request, @Param('id') id: string, @Body() dto: ReorderItemsDto) {
    return this.listsService.reorder(req.user!.id, id, dto);
  }

  @Delete(':id/checked')
  async clearChecked(@Req() req: Request, @Param('id') id: string) {
    return this.listsService.clearChecked(req.user!.id, id);
  }

  @Patch('items/:itemId')
  async updateItem(@Req() req: Request, @Param('itemId') itemId: string, @Body() dto: UpdateListItemDto) {
    return this.listsService.updateItem(req.user!.id, itemId, dto);
  }

  @Delete('items/:itemId')
  async removeItem(@Req() req: Request, @Param('itemId') itemId: string) {
    return this.listsService.removeItem(req.user!.id, itemId);
  }
}
