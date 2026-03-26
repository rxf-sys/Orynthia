import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHouseholdDto {
  @IsString() name: string;
  @IsArray() @IsOptional() memberNames?: string[];
}

export class AddMemberDto {
  @IsString() name: string;
  @IsString() @IsOptional() userId?: string;
}

class ShareDto {
  @IsString() memberId: string;
  @IsNumber() amount: number;
}

export class CreateSharedExpenseDto {
  @IsString() householdId: string;
  @IsString() description: string;
  @IsNumber() amount: number;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() splitType?: string;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ShareDto) shares?: ShareDto[];
}

export class SettleShareDto {
  @IsString() shareId: string;
}
