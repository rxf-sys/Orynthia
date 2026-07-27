import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

const MAX_BALANCE = 999_999_999.99;

export class CreateAccountDto {
  @ApiProperty({ example: 'Sparkasse' })
  @IsString()
  @MaxLength(200)
  bankName: string;

  @ApiProperty({ example: 'Girokonto' })
  @IsString()
  @MaxLength(200)
  accountName: string;

  @ApiProperty({ required: false, example: 'DE89370400440532013000' })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @ApiProperty({ required: false, example: 'COBADEFFXXX' })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  bic?: string;

  @ApiProperty({ enum: AccountType, required: false, default: 'CHECKING' })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiProperty({ required: false, example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(-MAX_BALANCE)
  @Max(MAX_BALANCE)
  balance?: number;
}

export class UpdateAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  bic?: string;

  @ApiProperty({ enum: AccountType, required: false })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;
}
