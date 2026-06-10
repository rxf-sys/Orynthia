import { IsString, IsNumber, IsOptional, IsBoolean, IsObject, IsIn, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const CONTRACT_TYPES = [
  'INSURANCE_LIABILITY', 'INSURANCE_HOUSEHOLD', 'INSURANCE_HEALTH', 'INSURANCE_DENTAL',
  'INSURANCE_LIFE', 'INSURANCE_CAR', 'INSURANCE_LEGAL', 'INSURANCE_DISABILITY', 'INSURANCE_OTHER',
  'ENERGY_ELECTRICITY', 'ENERGY_GAS', 'TELECOM_MOBILE', 'TELECOM_INTERNET', 'TELECOM_LANDLINE',
  'STREAMING', 'GYM', 'SUBSCRIPTION', 'RENT', 'LEASE', 'LOAN', 'OTHER',
] as const;

export const BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY'] as const;

// Realistische Obergrenze für Vertragskosten; verhindert Tippfehler-Billionen.
const MAX_COST = 999_999.99;

export class CreateContractDto {
  @ApiProperty({ example: 'Haftpflichtversicherung' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'Allianz' })
  @IsString()
  @MaxLength(200)
  provider: string;

  @ApiProperty({ enum: CONTRACT_TYPES })
  @IsIn(CONTRACT_TYPES)
  contractType: string;

  @ApiProperty({ required: false, example: 15.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_COST)
  monthlyCost?: number;

  @ApiProperty({ required: false, example: 191.88 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_COST)
  yearlyCost?: number;

  @ApiProperty({ required: false, enum: BILLING_CYCLES })
  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contractNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  cancellationDate?: string;

  @ApiProperty({ required: false, example: '3 Monate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  noticePeriod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterpartName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  counterpartIban?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) provider?: string;
  @IsOptional() @IsIn(CONTRACT_TYPES) contractType?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(MAX_COST) monthlyCost?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(MAX_COST) yearlyCost?: number;
  @IsOptional() @IsIn(BILLING_CYCLES) billingCycle?: string;
  @IsOptional() @IsString() @MaxLength(100) contractNumber?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsDateString() cancellationDate?: string;
  @IsOptional() @IsString() @MaxLength(100) noticePeriod?: string;
  @IsOptional() @IsBoolean() autoRenewal?: boolean;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(200) counterpartName?: string;
  @IsOptional() @IsString() @MaxLength(34) counterpartIban?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
