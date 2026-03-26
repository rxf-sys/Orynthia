import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

@Controller('assets')
@UseGuards(AuthGuard('jwt'))
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  getAll(@Req() req: Request) {
    return this.assetsService.getAll((req.user as any).id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateAssetDto) {
    return this.assetsService.create((req.user as any).id, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update((req.user as any).id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.assetsService.remove((req.user as any).id, id);
  }

  @Get('net-worth')
  getNetWorth(@Req() req: Request) {
    return this.assetsService.getNetWorth((req.user as any).id);
  }

  @Get('net-worth/history')
  getNetWorthHistory(@Req() req: Request, @Query('months') months?: number) {
    return this.assetsService.getNetWorthHistory((req.user as any).id, months || 12);
  }

  @Post('snapshot')
  createSnapshot(@Req() req: Request) {
    return this.assetsService.createSnapshot((req.user as any).id);
  }
}
