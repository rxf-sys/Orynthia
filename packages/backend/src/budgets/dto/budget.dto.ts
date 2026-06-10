import { IsUUID, IsNumber, IsOptional, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

const MAX_AMOUNT = 999_999_999.99;

export class CreateBudgetDto {
  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount: number;

  @ApiProperty({ enum: BudgetPeriod, required: false, default: 'MONTHLY' })
  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;
}

export class UpdateBudgetDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount?: number;

  @ApiProperty({ enum: BudgetPeriod, required: false })
  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
