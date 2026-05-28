import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Req() req: Request) {
    return this.dashboardService.getDashboardData(req.user!.id);
  }

  @Get('forecast')
  async getForecast(@Req() req: Request, @Query('days') days?: string) {
    return this.dashboardService.getForecast(req.user!.id, days ? parseInt(days, 10) : 30);
  }

  @Get('savings-potential')
  async getSavingsPotential(@Req() req: Request) {
    return this.dashboardService.getSavingsPotential(req.user!.id);
  }
}
