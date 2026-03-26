import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategorizationRulesService } from './categorization-rules.service';
import { CreateRuleDto, UpdateRuleDto, SplitTransactionDto, LearnFromCorrectionDto } from './dto/categorization-rule.dto';

@ApiTags('Categorization Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categorization-rules')
export class CategorizationRulesController {
  constructor(private categorizationRulesService: CategorizationRulesService) {}

  @Get()
  async findAll(@Req() req: Request) {
    return this.categorizationRulesService.getAll((req.user as any).id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateRuleDto) {
    return this.categorizationRulesService.create((req.user as any).id, dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.categorizationRulesService.update((req.user as any).id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.categorizationRulesService.remove((req.user as any).id, id);
  }

  @Post('apply/:transactionId')
  async applyRules(@Req() req: Request, @Param('transactionId') transactionId: string) {
    return this.categorizationRulesService.applyRulesToTransaction((req.user as any).id, transactionId);
  }

  @Post('learn')
  async learnFromCorrection(@Req() req: Request, @Body() dto: LearnFromCorrectionDto) {
    return this.categorizationRulesService.learnFromCorrection(
      (req.user as any).id,
      dto.transactionId,
      dto.categoryId,
    );
  }

  @Post('split')
  async splitTransaction(@Req() req: Request, @Body() dto: SplitTransactionDto) {
    return this.categorizationRulesService.splitTransaction((req.user as any).id, dto);
  }

  @Get('splits/:transactionId')
  async getSplits(@Req() req: Request, @Param('transactionId') transactionId: string) {
    return this.categorizationRulesService.getSplits((req.user as any).id, transactionId);
  }
}
