import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ListType } from '@prisma/client';

export class CreateListDto {
  @ApiProperty({ example: 'Wocheneinkauf' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ListType, required: false, default: 'SHOPPING' })
  @IsOptional()
  @IsEnum(ListType)
  type?: ListType;

  @ApiProperty({ required: false, example: '🛒' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;
}

export class UpdateListDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ enum: ListType, required: false })
  @IsOptional()
  @IsEnum(ListType)
  type?: ListType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;
}

export class CreateListItemDto {
  @ApiProperty({ example: 'Tomaten' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99_999)
  amount?: number;

  @ApiProperty({ required: false, example: 'g' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;
}

export class UpdateListItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99_999)
  amount?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** Zutaten eines Rezepts in eine Liste übernehmen (Cross-Module-Flow). */
export class AddFromRecipeDto {
  @ApiProperty({ description: 'Quell-Rezept' })
  @IsUUID()
  recipeId: string;

  @ApiProperty({
    required: false,
    description: 'Gewünschte Portionen; skaliert die Mengen gegenüber dem Rezept',
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  servings?: number;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Nur diese Zutaten-IDs übernehmen; ohne Angabe alle',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ingredientIds?: string[];
}

export class ReorderItemsDto {
  @ApiProperty({ type: [String], description: 'Item-IDs in gewünschter Reihenfolge' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  itemIds: string[];
}

export class BulkItemsDto {
  @ApiProperty({ type: [CreateListItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateListItemDto)
  items: CreateListItemDto[];
}
