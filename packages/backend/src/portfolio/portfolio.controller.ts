import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PortfolioService } from './portfolio.service';
import { CreateHoldingDto, UpdateHoldingDto } from './dto/portfolio.dto';

@Controller('portfolio')
@UseGuards(AuthGuard('jwt'))
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  getAll(@Req() req: Request) {
    return this.portfolioService.getAll((req.user as any).id);
  }

  @Get('summary')
  getSummary(@Req() req: Request) {
    return this.portfolioService.getSummary((req.user as any).id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateHoldingDto) {
    return this.portfolioService.create((req.user as any).id, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateHoldingDto) {
    return this.portfolioService.update((req.user as any).id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.portfolioService.remove((req.user as any).id, id);
  }
}
