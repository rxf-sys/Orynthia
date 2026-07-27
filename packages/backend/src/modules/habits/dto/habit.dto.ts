import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { HabitFrequency } from '@prisma/client';

export class CreateHabitDto {
  @ApiProperty({ example: 'Täglich 30 Minuten lesen' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ enum: HabitFrequency, required: false, default: 'DAILY' })
  @IsOptional()
  @IsEnum(HabitFrequency)
  frequency?: HabitFrequency;

  @ApiProperty({ required: false, default: 1, description: 'Zielanzahl je Periode' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  targetPerPeriod?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;
}

export class UpdateHabitDto extends CreateHabitDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class ToggleHabitEntryDto {
  @ApiProperty({ required: false, description: 'Tag; ohne Angabe heute', example: '2026-08-03' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
