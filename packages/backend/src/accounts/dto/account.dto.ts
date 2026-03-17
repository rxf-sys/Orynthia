import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ example: 'Sparkasse' })
  @IsString()
  bankName: string;

  @ApiProperty({ example: 'Girokonto' })
  @IsString()
  accountName: string;

  @ApiProperty({ required: false, example: 'DE89370400440532013000' })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiProperty({ required: false, example: 'COBADEFFXXX' })
  @IsOptional()
  @IsString()
  bic?: string;

  @ApiProperty({ enum: AccountType, required: false, default: 'CHECKING' })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiProperty({ required: false, example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  balance?: number;
}

export class UpdateAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bic?: string;

  @ApiProperty({ enum: AccountType, required: false })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;
}
