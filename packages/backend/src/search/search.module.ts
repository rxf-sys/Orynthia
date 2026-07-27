import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TasksModule } from '../modules/tasks/tasks.module';
import { CalendarModule } from '../modules/calendar/calendar.module';
import { RecipesModule } from '../modules/recipes/recipes.module';
import { ListsModule } from '../modules/lists/lists.module';
import { NotesModule } from '../modules/notes/notes.module';
import { TripsModule } from '../modules/trips/trips.module';
import { DocumentsModule } from '../modules/documents/documents.module';

@Module({
  imports: [
    TasksModule,
    CalendarModule,
    RecipesModule,
    ListsModule,
    NotesModule,
    TripsModule,
    DocumentsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
