import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSavingsGoalDto {
  @ApiProperty({ example: 'Urlaub 2026' })
  @IsString()
  name: string;

  @ApiProperty({ example: 3000 })
  @IsNumber()
  @Min(1)
  targetAmount: number;

  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deadline?: string;

  @ApiProperty({ required: false, example: '🏖️' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false, example: '#3b82f6' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateSavingsGoalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class AddAmountDto {
  @ApiProperty({ example: 100, description: 'Betrag zum Einzahlen (positiv) oder Abheben (negativ)' })
  @IsNumber()
  amount: number;
}
