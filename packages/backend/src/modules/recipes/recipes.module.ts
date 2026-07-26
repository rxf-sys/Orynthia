import { Module } from '@nestjs/common';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { MealPlanController } from './meal-plan.controller';
import { MealPlanService } from './meal-plan.service';
import { ListsModule } from '../lists/lists.module';

@Module({
  imports: [ListsModule],
  controllers: [RecipesController, MealPlanController],
  providers: [RecipesService, MealPlanService],
  exports: [RecipesService, MealPlanService],
})
export class RecipesModule {}
