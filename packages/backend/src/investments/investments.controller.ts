import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto, UpdateInvestmentDto, UpdatePriceDto } from './dto/investment.dto';

@ApiTags('Investments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private service: InvestmentsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.service.findAll(req.user!.id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateInvestmentDto) {
    return this.service.create(req.user!.id, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInvestmentDto) {
    return this.service.update(req.user!.id, id, dto);
  }

  @Post(':id/price')
  updatePrice(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePriceDto) {
    return this.service.updatePrice(req.user!.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user!.id, id);
  }
}
