import { Module } from '@nestjs/common';
import { LinksService } from './links.service';

@Module({
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
