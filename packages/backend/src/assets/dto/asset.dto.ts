import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ example: 'Eigentumswohnung' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'REAL_ESTATE' })
  @IsString()
  assetType: string;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ required: false, example: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isLiability?: boolean;

  @ApiProperty({ required: false, example: 3.5 })
  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @ApiProperty({ required: false, example: 'Deutsche Bank' })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiProperty({ required: false, example: 'Gekauft 2020' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  assetType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isLiability?: boolean;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
