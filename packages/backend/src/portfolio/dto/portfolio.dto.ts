import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateHoldingDto {
  @IsString() symbol: string;
  @IsString() name: string;
  @IsString() holdingType: string;
  @IsNumber() quantity: number;
  @IsNumber() avgBuyPrice: number;
  @IsNumber() currentPrice: number;
  @IsString() @IsOptional() currency?: string;
  @IsString() @IsOptional() exchange?: string;
  @IsString() @IsOptional() isin?: string;
}

export class UpdateHoldingDto {
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsOptional() quantity?: number;
  @IsNumber() @IsOptional() avgBuyPrice?: number;
  @IsNumber() @IsOptional() currentPrice?: number;
  @IsString() @IsOptional() exchange?: string;
  @IsString() @IsOptional() isin?: string;
}
