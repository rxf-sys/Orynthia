import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  getMonthlyReport(
    @Req() req: Request,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    return this.reportsService.getMonthlyReport((req.user as any).id, y, m);
  }

  @Get('yearly')
  getYearlyReport(@Req() req: Request, @Query('year') year: number) {
    const y = year || new Date().getFullYear();
    return this.reportsService.getYearlyReport((req.user as any).id, y);
  }

  @Get('export/csv')
  async exportCsv(
    @Req() req: Request,
    @Res() res: Response,
    @Query('year') year: number,
    @Query('month') month?: number,
  ) {
    const y = year || new Date().getFullYear();
    const csv = await this.reportsService.generateReportCsv((req.user as any).id, y, month);
    const filename = month
      ? `Orynthia_Bericht_${y}_${String(month).padStart(2, '0')}.csv`
      : `Orynthia_Jahresbericht_${y}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
