import { IsString, IsOptional } from 'class-validator';

export class ImportOptionsDto {
  @IsString() bankAccountId: string;
  @IsString() @IsOptional() dateFormat?: string; // default: DD.MM.YYYY
  @IsString() @IsOptional() delimiter?: string; // default: ;
  @IsString() @IsOptional() encoding?: string; // default: utf-8
}
