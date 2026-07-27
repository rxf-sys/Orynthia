import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { DocumentsService, MAX_DOCUMENT_BYTES } from './documents.service';
import { UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  async findAll(@Req() req: Request, @Query('search') search?: string, @Query('tag') tag?: string) {
    return this.documentsService.findAll(req.user!.id, { search, tag });
  }

  @Get('tags')
  async getTags(@Req() req: Request) {
    return this.documentsService.getTags(req.user!.id);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    return this.documentsService.findOne(req.user!.id, id);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.upload(req.user!.id, file, dto);
  }

  /**
   * Download. Wird bewusst immer als Anhang ausgeliefert und niemals
   * inline gerendert: so kann selbst eine getarnte Datei im Browser
   * keinen Code im Kontext der App ausführen.
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Datei entschlüsselt herunterladen (immer als Anhang)' })
  async download(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const { document, content } = await this.documentsService.getContent(req.user!.id, id);

    // RFC-5987-Kodierung, damit Umlaute im Dateinamen nicht zerbrechen
    const encodedName = encodeURIComponent(document.filename);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', content.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(content);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(req.user!.id, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.documentsService.remove(req.user!.id, id);
  }
}
