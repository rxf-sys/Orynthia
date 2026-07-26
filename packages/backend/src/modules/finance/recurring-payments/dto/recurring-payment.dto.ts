import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsDateString, IsUUID, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY'] as const;
const MAX_AMOUNT = 999_999_999.99;

export class CreateRecurringPaymentDto {
  @ApiProperty({ example: 'Netflix' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: -12.99 })
  @IsNumber()
  @Min(-MAX_AMOUNT)
  @Max(MAX_AMOUNT)
  amount: number;

  @ApiProperty({ required: false, enum: FREQUENCIES })
  @IsOptional()
  @IsEnum(FREQUENCIES)
  frequency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterpartName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;
}

export class UpdateRecurringPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(-MAX_AMOUNT)
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @IsEnum(FREQUENCIES)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterpartName?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
