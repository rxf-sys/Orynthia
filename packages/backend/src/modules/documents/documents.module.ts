import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentStorageService } from './document-storage.service';
import { LinksModule } from '../../platform/links/links.module';

@Module({
  imports: [LinksModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentStorageService],
  // Der Storage wird zusätzlich vom Demo-Seed genutzt, damit auch
  // Demo-Dokumente denselben Verschlüsselungsweg nehmen.
  exports: [DocumentsService, DocumentStorageService],
})
export class DocumentsModule {}
