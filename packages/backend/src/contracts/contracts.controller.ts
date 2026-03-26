import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Vertrag erstellen' })
  async create(@Req() req: Request, @Body() dto: CreateContractDto) {
    return this.service.create((req.user as any).id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Alle Verträge auflisten' })
  async findAll(@Req() req: Request) {
    return this.service.findAll((req.user as any).id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Vertrag aktualisieren' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.service.update((req.user as any).id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Vertrag löschen' })
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.service.remove((req.user as any).id, id);
  }

  @Get('detect')
  @ApiOperation({ summary: 'Verträge automatisch aus Transaktionen erkennen' })
  async detectContracts(@Req() req: Request) {
    return this.service.detectContracts((req.user as any).id);
  }

  @Post('from-detection')
  @ApiOperation({ summary: 'Vertrag aus Auto-Erkennung erstellen' })
  async createFromDetection(@Req() req: Request, @Body() body: {
    counterpartName: string;
    counterpartIban?: string;
    avgAmount: number;
    frequency: string;
    contractType: string;
    name?: string;
    provider?: string;
  }) {
    return this.service.createFromDetection((req.user as any).id, body);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Anbietervergleich: aktuelle Kosten vs. Marktdurchschnitt' })
  async compareProviders(@Req() req: Request) {
    return this.service.compareProviders((req.user as any).id);
  }
}
