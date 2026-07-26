import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto, CreateTaskListDto, UpdateTaskDto, UpdateTaskListDto } from './dto/task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('status') status?: 'open' | 'completed' | 'all',
    @Query('taskListId') taskListId?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('dueAfter') dueAfter?: string,
  ) {
    return this.tasksService.findAll(req.user!.id, { status, taskListId, dueBefore, dueAfter });
  }

  @Get('summary')
  async summary(@Req() req: Request) {
    return this.tasksService.getSummary(req.user!.id);
  }

  @Get('lists')
  async findAllLists(@Req() req: Request) {
    return this.tasksService.findAllLists(req.user!.id);
  }

  @Post('lists')
  async createList(@Req() req: Request, @Body() dto: CreateTaskListDto) {
    return this.tasksService.createList(req.user!.id, dto);
  }

  @Patch('lists/:id')
  async updateList(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTaskListDto) {
    return this.tasksService.updateList(req.user!.id, id, dto);
  }

  @Delete('lists/:id')
  async removeList(@Req() req: Request, @Param('id') id: string) {
    return this.tasksService.removeList(req.user!.id, id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(req.user!.id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.tasksService.remove(req.user!.id, id);
  }
}
