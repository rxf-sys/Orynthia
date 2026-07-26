import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@ApiTags('Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private notesService: NotesService) {}

  @Get()
  async findAll(@Req() req: Request, @Query('search') search?: string, @Query('tag') tag?: string) {
    return this.notesService.findAll(req.user!.id, { search, tag });
  }

  @Get('tags')
  async getTags(@Req() req: Request) {
    return this.notesService.getTags(req.user!.id);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    return this.notesService.findOne(req.user!.id, id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateNoteDto) {
    return this.notesService.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(req.user!.id, id, dto);
  }

  @Post(':id/pin')
  async togglePin(@Req() req: Request, @Param('id') id: string) {
    return this.notesService.togglePin(req.user!.id, id);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.notesService.remove(req.user!.id, id);
  }
}
