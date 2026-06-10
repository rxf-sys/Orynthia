import { IsString, IsNumber, IsOptional, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const MAX_AMOUNT = 999_999_999.99;

export class CreateSavingsGoalDto {
  @ApiProperty({ example: 'Urlaub 2026' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 3000 })
  @IsNumber()
  @Min(1)
  @Max(MAX_AMOUNT)
  targetAmount: number;

  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  currentAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ required: false, example: '🏖️' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @ApiProperty({ required: false, example: '#3b82f6' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}

export class UpdateSavingsGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_AMOUNT)
  targetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  currentAmount?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}

export class AddAmountDto {
  @ApiProperty({ example: 100, description: 'Betrag zum Einzahlen (positiv) oder Abheben (negativ)' })
  @IsNumber()
  @Min(-MAX_AMOUNT)
  @Max(MAX_AMOUNT)
  amount: number;
}
