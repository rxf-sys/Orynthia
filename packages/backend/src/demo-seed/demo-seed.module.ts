import { Module } from '@nestjs/common';
import { DemoSeedService } from './demo-seed.service';
import { DocumentsModule } from '../modules/documents/documents.module';

@Module({
  imports: [DocumentsModule],
  providers: [DemoSeedService],
})
export class DemoSeedModule {}
