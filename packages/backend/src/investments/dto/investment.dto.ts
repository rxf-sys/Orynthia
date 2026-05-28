import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InvestmentType } from '@prisma/client';

export class CreateInvestmentDto {
  @ApiProperty({ example: 'AAPL' })
  @IsString()
  @MaxLength(64)
  symbol: string;

  @ApiProperty({ example: 'Apple Inc.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: InvestmentType, required: false })
  @IsOptional()
  @IsEnum(InvestmentType)
  type?: InvestmentType;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.00000001)
  quantity: number;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  @Min(0)
  averagePrice: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentPrice?: number;

  @ApiProperty({ required: false, example: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateInvestmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  symbol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(InvestmentType)
  type?: InvestmentType;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePriceDto {
  @IsNumber()
  @Min(0)
  currentPrice: number;
}
