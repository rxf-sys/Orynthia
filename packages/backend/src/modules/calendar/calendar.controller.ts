import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CalendarService } from './calendar.service';
import { CreateCalendarDto, CreateEventDto, UpdateCalendarDto, UpdateEventDto } from './dto/calendar.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  // ---------- Kalender ----------

  @Get('calendars')
  async findAllCalendars(@Req() req: Request) {
    return this.calendarService.findAllCalendars(req.user!.id);
  }

  @Post('calendars')
  async createCalendar(@Req() req: Request, @Body() dto: CreateCalendarDto) {
    return this.calendarService.createCalendar(req.user!.id, dto);
  }

  @Patch('calendars/:id')
  async updateCalendar(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateCalendarDto) {
    return this.calendarService.updateCalendar(req.user!.id, id, dto);
  }

  @Delete('calendars/:id')
  async removeCalendar(@Req() req: Request, @Param('id') id: string) {
    return this.calendarService.removeCalendar(req.user!.id, id);
  }

  // ---------- Termine ----------

  @Get('events')
  async findEvents(@Req() req: Request, @Query('from') from: string, @Query('to') to: string) {
    return this.calendarService.findEvents(req.user!.id, from, to);
  }

  @Get('events/upcoming')
  async upcoming(@Req() req: Request, @Query('days') days?: string, @Query('limit') limit?: string) {
    return this.calendarService.getUpcoming(
      req.user!.id,
      days ? Math.min(parseInt(days, 10) || 7, 60) : 7,
      limit ? parseInt(limit, 10) || 10 : 10,
    );
  }

  @Post('events')
  async createEvent(@Req() req: Request, @Body() dto: CreateEventDto) {
    return this.calendarService.createEvent(req.user!.id, dto);
  }

  @Patch('events/:id')
  async updateEvent(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.calendarService.updateEvent(req.user!.id, id, dto);
  }

  @Delete('events/:id')
  async removeEvent(@Req() req: Request, @Param('id') id: string) {
    return this.calendarService.removeEvent(req.user!.id, id);
  }
}
