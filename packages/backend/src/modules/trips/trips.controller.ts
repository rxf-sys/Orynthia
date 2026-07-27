import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { TripsService } from './trips.service';
import { CreateTripDto, LinkEntityDto, UpdateTripDto } from './dto/trip.dto';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  async findAll(@Req() req: Request) {
    return this.tripsService.findAll(req.user!.id);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    return this.tripsService.findOne(req.user!.id, id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateTripDto) {
    return this.tripsService.create(req.user!.id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(req.user!.id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.tripsService.remove(req.user!.id, id);
  }

  @Post(':id/links')
  @ApiOperation({ summary: 'Termin, Liste, Notiz oder Rezept mit der Reise verknüpfen' })
  async link(@Req() req: Request, @Param('id') id: string, @Body() dto: LinkEntityDto) {
    return this.tripsService.link(req.user!.id, id, dto);
  }

  @Delete(':id/links/:linkId')
  async unlink(@Req() req: Request, @Param('id') id: string, @Param('linkId') linkId: string) {
    return this.tripsService.unlink(req.user!.id, id, linkId);
  }

  @Post(':id/packing-list')
  @ApiOperation({ summary: 'Packliste anlegen und mit der Reise verknüpfen' })
  async createPackingList(@Req() req: Request, @Param('id') id: string) {
    return this.tripsService.createPackingList(req.user!.id, id);
  }
}
