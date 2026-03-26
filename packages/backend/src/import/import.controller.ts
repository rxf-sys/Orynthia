import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ImportService } from './import.service';

@Controller('import')
@UseGuards(AuthGuard('jwt'))
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('csv')
  importCsv(
    @Req() req: Request,
    @Body() body: { bankAccountId: string; csvContent: string; delimiter?: string; dateFormat?: string },
  ) {
    return this.importService.importCsv(
      (req.user as any).id,
      body.bankAccountId,
      body.csvContent,
      { delimiter: body.delimiter, dateFormat: body.dateFormat },
    );
  }

  @Post('mt940')
  importMt940(
    @Req() req: Request,
    @Body() body: { bankAccountId: string; content: string },
  ) {
    return this.importService.importMt940(
      (req.user as any).id,
      body.bankAccountId,
      body.content,
    );
  }
}
