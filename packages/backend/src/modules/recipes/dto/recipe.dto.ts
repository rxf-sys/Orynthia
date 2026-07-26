import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RecipeDifficulty } from '@prisma/client';

export class IngredientDto {
  @ApiProperty({ example: 'Mehl' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ required: false, example: 200 })
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

export class CreateRecipeDto {
  @ApiProperty({ example: 'Spaghetti Bolognese' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  prepMinutes?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  cookMinutes?: number;

  @ApiProperty({ required: false, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  servings?: number;

  @ApiProperty({ enum: RecipeDifficulty, required: false, default: 'EASY' })
  @IsOptional()
  @IsEnum(RecipeDifficulty)
  difficulty?: RecipeDifficulty;

  @ApiProperty({ required: false, type: [String], example: ['dinner'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  mealTypes?: string[];

  @ApiProperty({ required: false, type: [String], example: ['vegetarian'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  dietary?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiProperty({ required: false, type: [String], example: ['Zwiebeln anbraten', 'Nudeln kochen'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  instructions?: string[];

  @ApiProperty({ required: false, type: [IngredientDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[];
}

export class UpdateRecipeDto extends CreateRecipeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
