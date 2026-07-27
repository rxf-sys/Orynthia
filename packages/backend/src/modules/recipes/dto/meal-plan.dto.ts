import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MealSlot } from '@prisma/client';

export class CreateMealPlanEntryDto {
  @ApiProperty({ required: false, description: 'Rezept; ohne Angabe zählt der Freitext-Titel' })
  @IsOptional()
  @IsUUID()
  recipeId?: string;

  @ApiProperty({ required: false, example: 'Reste vom Vortag' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ example: '2026-08-03' })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: MealSlot, required: false, default: 'DINNER' })
  @IsOptional()
  @IsEnum(MealSlot)
  slot?: MealSlot;

  @ApiProperty({ required: false, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  servings?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateMealPlanEntryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ enum: MealSlot, required: false })
  @IsOptional()
  @IsEnum(MealSlot)
  slot?: MealSlot;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  servings?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Zutaten aller geplanten Mahlzeiten eines Zeitraums in eine Liste übernehmen. */
export class MealPlanToListDto {
  @ApiProperty({ description: 'Ziel-Liste' })
  @IsUUID()
  listId: string;

  @ApiProperty({ example: '2026-08-03' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-08-09' })
  @IsDateString()
  to: string;
}
