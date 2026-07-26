import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ required: false, example: 'WLAN-Zugang Ferienwohnung' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false, default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  content?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiProperty({ required: false, example: '#fda481' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class UpdateNoteDto extends CreateNoteDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
