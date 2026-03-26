import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecurringPaymentDto {
  @ApiProperty({ example: 'Netflix' })
  @IsString()
  name: string;

  @ApiProperty({ example: -12.99 })
  @IsNumber()
  amount: number;

  @ApiProperty({ required: false, enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY'] })
  @IsOptional()
  @IsEnum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY'])
  frequency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nextDueDate?: string;
}

export class UpdateRecurringPaymentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsEnum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY'])
  frequency?: string;

  @IsOptional()
  @IsString()
  counterpartName?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  nextDueDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
