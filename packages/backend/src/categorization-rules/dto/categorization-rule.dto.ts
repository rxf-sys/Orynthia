import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum RuleField {
  COUNTERPART_NAME = 'COUNTERPART_NAME',
  COUNTERPART_IBAN = 'COUNTERPART_IBAN',
  PURPOSE = 'PURPOSE',
  AMOUNT_MIN = 'AMOUNT_MIN',
  AMOUNT_MAX = 'AMOUNT_MAX',
}

export enum RuleOperator {
  EQUALS = 'EQUALS',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  REGEX = 'REGEX',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
}

export class CreateRuleDto {
  @ApiProperty({ example: 'uuid-of-category' })
  @IsString()
  categoryId: string;

  @ApiProperty({ enum: RuleField, example: RuleField.COUNTERPART_NAME })
  @IsEnum(RuleField)
  field: RuleField;

  @ApiProperty({ enum: RuleOperator, example: RuleOperator.CONTAINS })
  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ApiProperty({ example: 'Amazon' })
  @IsString()
  value: string;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @IsNumber()
  priority?: number;
}

export class UpdateRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, enum: RuleField })
  @IsOptional()
  @IsEnum(RuleField)
  field?: RuleField;

  @ApiProperty({ required: false, enum: RuleOperator })
  @IsOptional()
  @IsEnum(RuleOperator)
  operator?: RuleOperator;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SplitItemDto {
  @ApiProperty({ example: 'uuid-of-category' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, example: 'Teilbetrag für Lebensmittel' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SplitTransactionDto {
  @ApiProperty({ example: 'uuid-of-transaction' })
  @IsString()
  transactionId: string;

  @ApiProperty({ type: [SplitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  splits: SplitItemDto[];
}

export class LearnFromCorrectionDto {
  @ApiProperty({ example: 'uuid-of-transaction' })
  @IsString()
  transactionId: string;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsString()
  categoryId: string;
}
