import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContractDto {
  @ApiProperty({ example: 'Haftpflichtversicherung' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Allianz' })
  @IsString()
  provider: string;

  @ApiProperty({ enum: ['INSURANCE_LIABILITY', 'INSURANCE_HOUSEHOLD', 'INSURANCE_HEALTH', 'INSURANCE_DENTAL', 'INSURANCE_LIFE', 'INSURANCE_CAR', 'INSURANCE_LEGAL', 'INSURANCE_DISABILITY', 'INSURANCE_OTHER', 'ENERGY_ELECTRICITY', 'ENERGY_GAS', 'TELECOM_MOBILE', 'TELECOM_INTERNET', 'TELECOM_LANDLINE', 'STREAMING', 'GYM', 'SUBSCRIPTION', 'RENT', 'LEASE', 'LOAN', 'OTHER'] })
  @IsString()
  contractType: string;

  @ApiProperty({ required: false, example: 15.99 })
  @IsOptional()
  @IsNumber()
  monthlyCost?: number;

  @ApiProperty({ required: false, example: 191.88 })
  @IsOptional()
  @IsNumber()
  yearlyCost?: number;

  @ApiProperty({ required: false, enum: ['MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY'] })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cancellationDate?: string;

  @ApiProperty({ required: false, example: '3 Monate' })
  @IsOptional()
  @IsString()
  noticePeriod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartIban?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() monthlyCost?: number;
  @IsOptional() @IsNumber() yearlyCost?: number;
  @IsOptional() @IsString() billingCycle?: string;
  @IsOptional() @IsString() contractNumber?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() cancellationDate?: string;
  @IsOptional() @IsString() noticePeriod?: string;
  @IsOptional() @IsBoolean() autoRenewal?: boolean;
  @IsOptional() @IsObject() details?: Record<string, any>;
  @IsOptional() @IsString() counterpartName?: string;
  @IsOptional() @IsString() counterpartIban?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
