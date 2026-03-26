import { Module } from '@nestjs/common';
import { CategorizationRulesController } from './categorization-rules.controller';
import { CategorizationRulesService } from './categorization-rules.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CategorizationRulesController],
  providers: [CategorizationRulesService],
  exports: [CategorizationRulesService],
})
export class CategorizationRulesModule {}
